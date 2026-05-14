"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

export async function deleteSpecRelation(id: string): Promise<void> {
  if (!id) throw new Error("id 누락.");

  const userId = await getCurrentUserId();

  const rel = await db.specRelation.findFirst({
    where: {
      id,
      from: { project: { members: { some: { userId } } } },
    },
    select: {
      fromId: true,
      toId: true,
      from: { select: { project: { select: { slug: true } } } },
    },
  });
  if (!rel) throw new Error("관계를 찾을 수 없거나 권한 없음.");

  await db.specRelation.delete({ where: { id } });

  revalidatePath(`/projects/${rel.from.project.slug}/specs/${rel.fromId}`);
  revalidatePath(`/projects/${rel.from.project.slug}/specs/${rel.toId}`);
}
