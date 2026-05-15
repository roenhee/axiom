"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * 폴더의 부모를 변경. newParentId = null 이면 루트로 이동.
 * 새 위치의 가장 끝 (max order + 1) 으로 자동 정렬.
 *
 * 거부 케이스:
 * - 자기 자신을 부모로
 * - 자기 후손을 부모로 (사이클)
 * - 다른 프로젝트의 폴더를 부모로
 */
export async function moveFolder(args: {
  id: string;
  newParentId: string | null;
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

  // 이미 그 부모 밑에 있다면 no-op.
  if (folder.parentId === args.newParentId) return;

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

  const maxOrder = await db.folder.aggregate({
    where: { projectId: folder.projectId, parentId: args.newParentId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  await db.folder.update({
    where: { id: args.id },
    data: { parentId: args.newParentId, order: nextOrder },
  });

  revalidatePath(`/projects/${folder.project.slug}`);
}
