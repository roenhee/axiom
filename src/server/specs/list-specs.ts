"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import type { SpecType } from "@/generated/prisma/enums";

export interface SpecListItem {
  id: string;
  title: string;
  type: SpecType;
  folderId: string | null;
  updatedAt: Date;
}

/**
 * 프로젝트 내 모든 Spec — 폴더 / 타입 / 제목 순.
 * 1-D 단계는 필터 없음. 폴더 기반 필터는 후속 polish.
 */
export async function listSpecs(projectId: string): Promise<SpecListItem[]> {
  const userId = await getCurrentUserId();

  const project = await db.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    select: { id: true },
  });
  if (!project) throw new Error("프로젝트 권한 없음.");

  return db.spec.findMany({
    where: { projectId },
    orderBy: [{ folderId: "asc" }, { type: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      folderId: true,
      updatedAt: true,
    },
  });
}
