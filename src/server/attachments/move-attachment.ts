"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

type SiblingItem =
  | { kind: "folder"; id: string; order: number; isLocked: boolean }
  | { kind: "spec"; id: string; order: number }
  | { kind: "attachment"; id: string; order: number };

/**
 * Attachment 의 위치/순서 변경 (D-038).
 *
 * 첨부는 폴더 트리의 folder/root 레벨에만 위치 — sub-spec 안엔 들어가지 않음.
 * newOrder 미지정: 끝에 추가 (folder + spec + attachment 통합 max + 1).
 * newOrder 지정: 같은 부모 안 folder + spec + attachment 통합 0..N 재정렬.
 */
export async function moveAttachment(args: {
  id: string;
  newFolderId?: string | null;
  newOrder?: number;
}): Promise<void> {
  const userId = await getCurrentUserId();

  const attachment = await db.attachment.findUnique({
    where: { id: args.id },
    select: {
      id: true,
      projectId: true,
      folderId: true,
      project: {
        select: {
          slug: true,
          members: { where: { userId }, select: { id: true } },
        },
      },
    },
  });
  if (!attachment) throw new Error("Attachment 없음.");
  if (attachment.project.members.length === 0) throw new Error("권한 없음.");

  if (args.newFolderId !== undefined && args.newFolderId !== null) {
    const folder = await db.folder.findUnique({
      where: { id: args.newFolderId },
      select: { projectId: true },
    });
    if (!folder) throw new Error("폴더를 찾을 수 없음.");
    if (folder.projectId !== attachment.projectId) {
      throw new Error("다른 프로젝트로는 이동 불가.");
    }
  }

  const targetFolderId =
    args.newFolderId !== undefined ? args.newFolderId : attachment.folderId;

  const isSameParent = targetFolderId === attachment.folderId;
  if (isSameParent && args.newOrder === undefined) return;

  if (args.newOrder === undefined) {
    const [maxFolder, maxSpec, maxAttachment] = await Promise.all([
      db.folder.aggregate({
        where: { projectId: attachment.projectId, parentId: targetFolderId },
        _max: { order: true },
      }),
      db.spec.aggregate({
        where: {
          projectId: attachment.projectId,
          folderId: targetFolderId,
          parentSpecId: null,
        },
        _max: { order: true },
      }),
      db.attachment.aggregate({
        where: { projectId: attachment.projectId, folderId: targetFolderId },
        _max: { order: true },
      }),
    ]);
    const nextOrder =
      Math.max(
        maxFolder._max.order ?? -1,
        maxSpec._max.order ?? -1,
        maxAttachment._max.order ?? -1,
      ) + 1;
    await db.attachment.update({
      where: { id: args.id },
      data: { folderId: targetFolderId, order: nextOrder },
    });
  } else {
    await db.$transaction(async (tx) => {
      await tx.attachment.update({
        where: { id: args.id },
        data: { folderId: targetFolderId },
      });

      const [folders, specs, attachments] = await Promise.all([
        tx.folder.findMany({
          where: {
            projectId: attachment.projectId,
            parentId: targetFolderId,
          },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, order: true, isLocked: true },
        }),
        tx.spec.findMany({
          where: {
            projectId: attachment.projectId,
            folderId: targetFolderId,
            parentSpecId: null,
          },
          orderBy: [{ order: "asc" }, { title: "asc" }],
          select: { id: true, order: true },
        }),
        tx.attachment.findMany({
          where: {
            projectId: attachment.projectId,
            folderId: targetFolderId,
            id: { not: args.id },
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
          final.push({ kind: "attachment", id: args.id, order: 0 });
        }
        final.push(others[i]);
      }
      if (clamped >= others.length) {
        final.push({ kind: "attachment", id: args.id, order: 0 });
      }

      for (let i = 0; i < final.length; i++) {
        const item = final[i];
        if (item.kind === "folder") {
          await tx.folder.update({ where: { id: item.id }, data: { order: i } });
        } else if (item.kind === "spec") {
          await tx.spec.update({ where: { id: item.id }, data: { order: i } });
        } else {
          await tx.attachment.update({
            where: { id: item.id },
            data: { order: i },
          });
        }
      }
    });
  }

  revalidatePath(`/projects/${attachment.project.slug}`);
}
