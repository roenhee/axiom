"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * slug 로 프로젝트 상세 조회. 현재 user 가 멤버여야 함.
 * 없거나 권한 없으면 null.
 */
export async function getProjectBySlug(slug: string) {
  const userId = await getCurrentUserId();
  return db.project.findFirst({
    where: {
      slug,
      members: { some: { userId } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      archived: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
