"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  childTypeRejectionReason,
  isChildTypeAllowed,
} from "@/lib/spec-type-hierarchy";

type SiblingItem =
  | { kind: "folder"; id: string; order: number; isLocked: boolean }
  | { kind: "spec"; id: string; order: number };

/**
 * Spec 의 위치/순서 변경.
 *
 * 트리 표시 규칙: parentSpecId 가 있으면 그 Spec 밑에 표시, 없으면 folderId 따라 폴더/루트.
 *
 * newOrder 미지정: 끝에 추가 (folder/root 레벨이면 folder + spec 통합 max + 1).
 * newOrder 지정: 같은 부모 안 형제 0..N 으로 재정렬.
 *   - folder/root 레벨(parentSpecId null): 폴더 + spec 형제 통합 재정렬 (D-036).
 *   - sub-spec 레벨: 동일 부모 spec 의 sub-spec 만 재정렬.
 *
 * 거부 케이스: 자기 자신/후손 / 다른 프로젝트 / 위계 위배 (D-035).
 */
export async function moveSpec(args: {
  id: string;
  newFolderId?: string | null;
  newParentSpecId?: string | null;
  newOrder?: number;
}): Promise<void> {
  const userId = await getCurrentUserId();

  const spec = await db.spec.findUnique({
    where: { id: args.id },
    select: {
      id: true,
      projectId: true,
      folderId: true,
      parentSpecId: true,
      type: true,
      project: {
        select: { slug: true, members: { where: { userId }, select: { id: true } } },
      },
    },
  });
  if (!spec) throw new Error("Spec 없음.");
  if (spec.project.members.length === 0) throw new Error("권한 없음.");

  if (args.newFolderId !== undefined && args.newFolderId !== null) {
    const folder = await db.folder.findUnique({
      where: { id: args.newFolderId },
      select: { projectId: true },
    });
    if (!folder) throw new Error("폴더를 찾을 수 없음.");
    if (folder.projectId !== spec.projectId) {
      throw new Error("다른 프로젝트로는 이동 불가.");
    }
  }

  if (args.newParentSpecId !== undefined && args.newParentSpecId !== null) {
    if (args.newParentSpecId === args.id) {
      throw new Error("자기 자신을 부모로 둘 수 없음.");
    }
    const parent = await db.spec.findUnique({
      where: { id: args.newParentSpecId },
      select: { id: true, projectId: true, parentSpecId: true, type: true },
    });
    if (!parent) throw new Error("부모 Spec 을 찾을 수 없음.");
    if (parent.projectId !== spec.projectId) {
      throw new Error("다른 프로젝트로는 이동 불가.");
    }
    if (!isChildTypeAllowed(parent.type, spec.type)) {
      throw new Error(childTypeRejectionReason(parent.type, spec.type));
    }
    // 사이클 검사
    let cursor: string | null = parent.parentSpecId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === args.id) {
        throw new Error("자기 후손을 부모로 둘 수 없음.");
      }
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const ancestor: { parentSpecId: string | null } | null =
        await db.spec.findUnique({
          where: { id: cursor },
          select: { parentSpecId: true },
        });
      cursor = ancestor?.parentSpecId ?? null;
    }
  }

  const targetFolderId =
    args.newFolderId !== undefined ? args.newFolderId : spec.folderId;
  const targetParentSpecId =
    args.newParentSpecId !== undefined ? args.newParentSpecId : spec.parentSpecId;

  const isSameParent =
    targetFolderId === spec.folderId && targetParentSpecId === spec.parentSpecId;
  if (isSameParent && args.newOrder === undefined) return;

  if (args.newOrder === undefined) {
    // 끝에 추가.
    let nextOrder: number;
    if (targetParentSpecId !== null) {
      // sub-spec 레벨: spec siblings 만.
      const maxSpec = await db.spec.aggregate({
        where: {
          projectId: spec.projectId,
          parentSpecId: targetParentSpecId,
        },
        _max: { order: true },
      });
      nextOrder = (maxSpec._max.order ?? -1) + 1;
    } else {
      // folder/root 레벨: folder + spec 통합 max + 1.
      const [maxFolder, maxSpec] = await Promise.all([
        db.folder.aggregate({
          where: { projectId: spec.projectId, parentId: targetFolderId },
          _max: { order: true },
        }),
        db.spec.aggregate({
          where: {
            projectId: spec.projectId,
            folderId: targetFolderId,
            parentSpecId: null,
          },
          _max: { order: true },
        }),
      ]);
      nextOrder =
        Math.max(maxFolder._max.order ?? -1, maxSpec._max.order ?? -1) + 1;
    }

    await db.spec.update({
      where: { id: args.id },
      data: {
        folderId: targetFolderId,
        parentSpecId: targetParentSpecId,
        order: nextOrder,
      },
    });
  } else {
    await db.$transaction(async (tx) => {
      await tx.spec.update({
        where: { id: args.id },
        data: {
          folderId: targetFolderId,
          parentSpecId: targetParentSpecId,
        },
      });

      if (targetParentSpecId !== null) {
        // sub-spec 레벨: spec sibling 만 재정렬.
        const others = await tx.spec.findMany({
          where: {
            projectId: spec.projectId,
            parentSpecId: targetParentSpecId,
            id: { not: args.id },
          },
          orderBy: [{ order: "asc" }, { title: "asc" }],
          select: { id: true },
        });
        const clamped = Math.max(
          0,
          Math.min(args.newOrder!, others.length),
        );
        const final: { id: string }[] = [];
        for (let i = 0; i < others.length; i++) {
          if (i === clamped) final.push({ id: args.id });
          final.push(others[i]);
        }
        if (clamped >= others.length) final.push({ id: args.id });

        for (let i = 0; i < final.length; i++) {
          await tx.spec.update({
            where: { id: final[i].id },
            data: { order: i },
          });
        }
      } else {
        // folder/root 레벨: folder + spec 통합 재정렬.
        const [folders, specs] = await Promise.all([
          tx.folder.findMany({
            where: {
              projectId: spec.projectId,
              parentId: targetFolderId,
            },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            select: { id: true, order: true, isLocked: true },
          }),
          tx.spec.findMany({
            where: {
              projectId: spec.projectId,
              folderId: targetFolderId,
              parentSpecId: null,
              id: { not: args.id },
            },
            orderBy: [{ order: "asc" }, { title: "asc" }],
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
            final.push({ kind: "spec", id: args.id, order: 0 });
          }
          final.push(others[i]);
        }
        if (clamped >= others.length) {
          final.push({ kind: "spec", id: args.id, order: 0 });
        }

        for (let i = 0; i < final.length; i++) {
          const item = final[i];
          if (item.kind === "folder") {
            await tx.folder.update({
              where: { id: item.id },
              data: { order: i },
            });
          } else {
            await tx.spec.update({
              where: { id: item.id },
              data: { order: i },
            });
          }
        }
      }
    });
  }

  revalidatePath(`/projects/${spec.project.slug}`);
}
