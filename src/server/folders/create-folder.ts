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
  /** 빈 문자열 / 공백 만이면 "폴더 YYYY-MM-DD" 로 자동 생성 (중복 시 (N) suffix). */
  name: string;
}): Promise<{ id: string }> {
  const trimmed = args.name.trim();
  if (trimmed.length > 100) {
    throw new Error("폴더 이름은 100 자 이하.");
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

  const name = trimmed.length > 0
    ? trimmed
    : await generateDefaultFolderName(args.projectId, args.parentId);

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

/** 같은 위치에 "폴더 YYYY-MM-DD" 가 이미 있으면 (2), (3) ... suffix. */
async function generateDefaultFolderName(
  projectId: string,
  parentId: string | null,
): Promise<string> {
  const date = new Date().toISOString().slice(0, 10);
  const base = `폴더 ${date}`;
  const existing = await db.folder.findMany({
    where: { projectId, parentId, name: { startsWith: base } },
    select: { name: true },
  });
  if (existing.length === 0) return base;
  const used = new Set(existing.map((f) => f.name));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}
