"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * id 로 Spec 상세. 멤버십 체크 포함. 없거나 권한 없으면 null.
 */
export async function getSpec(id: string) {
  const userId = await getCurrentUserId();

  return db.spec.findFirst({
    where: {
      id,
      project: { members: { some: { userId } } },
    },
    select: {
      id: true,
      title: true,
      type: true,
      folderId: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      folder: {
        select: { id: true, name: true },
      },
    },
  });
}
