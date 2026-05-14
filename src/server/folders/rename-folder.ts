"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

export async function renameFolder(args: {
  id: string;
  name: string;
}): Promise<void> {
  const name = args.name.trim();
  if (name.length < 1 || name.length > 100) {
    throw new Error("폴더 이름은 1~100 자.");
  }

  const userId = await getCurrentUserId();

  const folder = await db.folder.findUnique({
    where: { id: args.id },
    select: {
      projectId: true,
      project: { select: { slug: true, members: { where: { userId } } } },
    },
  });
  if (!folder) throw new Error("폴더 없음.");
  if (folder.project.members.length === 0) throw new Error("권한 없음.");

  await db.folder.update({
    where: { id: args.id },
    data: { name },
  });

  revalidatePath(`/projects/${folder.project.slug}`);
}
