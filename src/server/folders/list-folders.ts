"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  isLocked: boolean;
}

/**
 * 프로젝트의 모든 폴더 플랫 리스트로 반환 (order 오름차순).
 * 클라이언트가 parentId 로 트리 재구성.
 * 멤버십 체크 포함.
 */
export async function listFolders(projectId: string): Promise<FolderNode[]> {
  const userId = await getCurrentUserId();

  const membership = await db.userRole.findFirst({
    where: { userId, projectId },
    select: { id: true },
  });
  if (!membership) throw new Error("프로젝트 권한 없음.");

  const folders = await db.folder.findMany({
    where: { projectId },
    orderBy: [{ parentId: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      parentId: true,
      order: true,
      isLocked: true,
    },
  });
  return folders;
}
