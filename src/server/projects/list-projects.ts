"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * 현재 user 가 멤버인 비-아카이브 프로젝트를 최근 수정 순으로 반환.
 * Phase 5 권한 enforcement 들어가면 여기서 filter 만 손보면 됨.
 */
export async function listMyProjects() {
  const userId = await getCurrentUserId();
  return db.project.findMany({
    where: {
      archived: false,
      members: { some: { userId } },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      updatedAt: true,
    },
  });
}
