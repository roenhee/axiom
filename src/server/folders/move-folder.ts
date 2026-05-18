"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

type SiblingItem =
  | { kind: "folder"; id: string; order: number; isLocked: boolean }
  | { kind: "spec"; id: string; order: number }
  | { kind: "attachment"; id: string; order: number };

/**
 * 폴더의 부모/순서 변경.
 *
 * - newParentId = null 이면 루트로 이동.
 * - newOrder 미지정: 새 부모의 끝 (folder + spec 통합 max + 1) 에 추가.
 * - newOrder 지정: 같은 부모 안 폴더+spec 형제 모두 0..N 으로 재정렬 — D-036 에
 *   따라 folder/spec 이 같은 order 공간을 공유 (시각적으로 섞일 수 있음).
 *
 * 거부: 자기 자신/후손을 부모 / 다른 프로젝트로 / isLocked 폴더 이동.
 */
export async function moveFolder(args: {
  id: string;
  newParentId: string | null;
  newOrder?: number;
}): Promise<void> {
  if (args.id === args.newParentId) {
    throw new Error("자기 자신을 부모로 둘 수 없음.");
  }

  const userId = await getCurrentUserId();

  const folder = await db.folder.findUnique({
    where: { id: args.id },
    select: {
      id: true,
      projectId: true,
      parentId: true,
      isLocked: true,
      project: { select: { slug: true, members: { where: { userId } } } },
    },
  });
  if (!folder) throw new Error("폴더 없음.");
  if (folder.project.members.length === 0) throw new Error("권한 없음.");
  if (folder.isLocked) {
    throw new Error("시스템 예약 폴더 — 이동할 수 없습니다.");
  }

  if (folder.parentId === args.newParentId && args.newOrder === undefined) {
    return;
  }

  if (args.newParentId) {
    const newParent = await db.folder.findUnique({
      where: { id: args.newParentId },
      select: { projectId: true },
    });
    if (!newParent) throw new Error("부모 폴더를 찾을 수 없음.");
    if (newParent.projectId !== folder.projectId) {
      throw new Error("다른 프로젝트로는 이동 불가.");
    }

    // 사이클 검사
    let cursor: string | null = args.newParentId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === args.id) {
        throw new Error("자기 후손을 부모로 둘 수 없음.");
      }
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const parent: { parentId: string | null } | null =
        await db.folder.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
      cursor = parent?.parentId ?? null;
    }
  }

  if (args.newOrder === undefined) {
    // 끝에 추가 — folder + spec + attachment 통합 max + 1 (D-038).
    const [maxFolderOrder, maxSpecOrder, maxAttachmentOrder] = await Promise.all([
      db.folder.aggregate({
        where: { projectId: folder.projectId, parentId: args.newParentId },
        _max: { order: true },
      }),
      db.spec.aggregate({
        where: {
          projectId: folder.projectId,
          folderId: args.newParentId,
          parentSpecId: null,
        },
        _max: { order: true },
      }),
      db.attachment.aggregate({
        where: { projectId: folder.projectId, folderId: args.newParentId },
        _max: { order: true },
      }),
    ]);
    const nextOrder =
      Math.max(
        maxFolderOrder._max.order ?? -1,
        maxSpecOrder._max.order ?? -1,
        maxAttachmentOrder._max.order ?? -1,
      ) + 1;

    await db.folder.update({
      where: { id: args.id },
      data: { parentId: args.newParentId, order: nextOrder },
    });
  } else {
    await db.$transaction(async (tx) => {
      // 1. 부모 변경.
      await tx.folder.update({
        where: { id: args.id },
        data: { parentId: args.newParentId },
      });

      // 2. 같은 부모 안 형제들 (folder + root-level spec + attachment) — 활성 폴더 제외.
      const [folders, specs, attachments] = await Promise.all([
        tx.folder.findMany({
          where: {
            projectId: folder.projectId,
            parentId: args.newParentId,
            id: { not: args.id },
          },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, order: true, isLocked: true },
        }),
        tx.spec.findMany({
          where: {
            projectId: folder.projectId,
            folderId: args.newParentId,
            parentSpecId: null,
          },
          orderBy: [{ order: "asc" }, { title: "asc" }],
          select: { id: true, order: true },
        }),
        tx.attachment.findMany({
          where: {
            projectId: folder.projectId,
            folderId: args.newParentId,
          },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, order: true },
        }),
      ]);

      const others: SiblingItem[] = [
        ...folders.map((f) => ({
          kind: "folder" as const,
          id: f.id,
          order: f.order,
          isLocked: f.isLocked,
        })),
        ...specs.map((s) => ({
          kind: "spec" as const,
          id: s.id,
          order: s.order,
        })),
        ...attachments.map((a) => ({
          kind: "attachment" as const,
          id: a.id,
          order: a.order,
        })),
      ];
      others.sort((a, b) => {
        const aLocked = a.kind === "folder" && a.isLocked;
        const bLocked = b.kind === "folder" && b.isLocked;
        if (aLocked !== bLocked) return aLocked ? -1 : 1;
        return a.order - b.order;
      });

      // 3. newOrder 위치에 삽입. locked 폴더 보다 앞엔 못 가도록 clamp.
      const lockedCount = others.filter(
        (o) => o.kind === "folder" && o.isLocked,
      ).length;
      const clamped = Math.max(
        lockedCount,
        Math.min(args.newOrder!, others.length),
      );

      const final: SiblingItem[] = [];
      for (let i = 0; i < others.length; i++) {
        if (i === clamped) {
          final.push({ kind: "folder", id: args.id, order: 0, isLocked: false });
        }
        final.push(others[i]);
      }
      if (clamped >= others.length) {
        final.push({ kind: "folder", id: args.id, order: 0, isLocked: false });
      }

      // 4. 0..N 으로 재배치.
      for (let i = 0; i < final.length; i++) {
        const item = final[i];
        if (item.kind === "folder") {
          await tx.folder.update({
            where: { id: item.id },
            data: { order: i },
          });
        } else if (item.kind === "spec") {
          await tx.spec.update({
            where: { id: item.id },
            data: { order: i },
          });
        } else {
          await tx.attachment.update({
            where: { id: item.id },
            data: { order: i },
          });
        }
      }
    });
  }

  revalidatePath(`/projects/${folder.project.slug}`);
}
