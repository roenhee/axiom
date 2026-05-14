"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

export async function getSpecVersion(id: string) {
  const userId = await getCurrentUserId();
  return db.specVersion.findFirst({
    where: {
      id,
      spec: {
        project: { members: { some: { userId } } },
      },
    },
    select: {
      id: true,
      versionLabel: true,
      status: true,
      markdown: true,
      changeSummary: true,
      changeType: true,
      publishedAt: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
      spec: {
        select: {
          id: true,
          title: true,
          type: true,
          project: { select: { slug: true } },
        },
      },
    },
  });
}
