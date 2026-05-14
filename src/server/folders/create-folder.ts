"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * 폴더 생성. parentId = null 이면 루트 폴더.
 * 같은 parent 의 최대 order + 1 로 자동 정렬.
 */
export async function createFolder(args: {
  projectId: string;
  parentId: string | null;
  name: string;
}): Promise<{ id: string }> {
  const name = args.name.trim();
  if (name.length < 1 || name.length > 100) {
    throw new Error("폴더 이름은 1~100 자.");
  }

  const userId = await getCurrentUserId();
  const project = await db.project.findFirst({
    where: { id: args.projectId, members: { some: { userId } } },
    select: { id: true, slug: true },
  });
  if (!project) throw new Error("프로젝트 권한 없음.");

  if (args.parentId) {
    const parent = await db.folder.findFirst({
      where: { id: args.parentId, projectId: args.projectId },
      select: { id: true },
    });
    if (!parent) throw new Error("부모 폴더를 찾을 수 없음.");
  }

  const maxOrder = await db.folder.aggregate({
    where: { projectId: args.projectId, parentId: args.parentId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const folder = await db.folder.create({
    data: {
      projectId: args.projectId,
      parentId: args.parentId,
      name,
      order: nextOrder,
    },
    select: { id: true },
  });

  revalidatePath(`/projects/${project.slug}`);
  return folder;
}
