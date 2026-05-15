"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * 폴더의 부모/순서 변경.
 *
 * - newParentId = null 이면 루트로 이동.
 * - newOrder 가 undefined 면 새 부모의 끝 (max + 1) 에 추가. 같은 부모 안 reorder
 *   는 newOrder 지정.
 * - newOrder 지정 시 같은 부모 안 형제들 모두 0..N 으로 재정렬 (한 트랜잭션).
 *
 * 거부 케이스:
 * - 자기 자신/후손을 부모로 (사이클)
 * - 다른 프로젝트의 폴더를 부모로
 * - isLocked (시스템 예약 폴더)
 */
export async function moveFolder(args: {
  id: string;
  newParentId: string | null;
  /** 같은 부모 안 형제들 사이의 순서 (0-indexed). 미지정 시 끝에 추가. */
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

  // newOrder 없이 같은 부모 안 그대로 → no-op.
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

    // 사이클 검사 — newParent 의 조상 사슬에 args.id 가 있으면 거부
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
    // 끝에 추가 (기존 동작).
    const maxOrder = await db.folder.aggregate({
      where: { projectId: folder.projectId, parentId: args.newParentId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    await db.folder.update({
      where: { id: args.id },
      data: { parentId: args.newParentId, order: nextOrder },
    });
  } else {
    // 새 위치 (newOrder) 에 삽입 + 같은 부모 안 모든 형제 재정렬.
    await db.$transaction(async (tx) => {
      // 1. 우선 새 parent 로 이동 (order 는 추후 일괄 갱신).
      await tx.folder.update({
        where: { id: args.id },
        data: { parentId: args.newParentId },
      });

      // 2. 같은 부모 (this id 제외) 형제들 현재 순서.
      const others = await tx.folder.findMany({
        where: {
          projectId: folder.projectId,
          parentId: args.newParentId,
          id: { not: args.id },
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      // 3. newOrder 위치에 args.id 삽입.
      const clampedOrder = Math.max(0, Math.min(args.newOrder!, others.length));
      const final: { id: string }[] = [];
      for (let i = 0; i < others.length; i++) {
        if (i === clampedOrder) final.push({ id: args.id });
        final.push(others[i]);
      }
      if (clampedOrder >= others.length) final.push({ id: args.id });

      // 4. 0..N 으로 order 재배치.
      for (let i = 0; i < final.length; i++) {
        await tx.folder.update({
          where: { id: final[i].id },
          data: { order: i },
        });
      }
    });
  }

  revalidatePath(`/projects/${folder.project.slug}`);
}
