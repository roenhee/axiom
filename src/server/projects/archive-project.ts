"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * 프로젝트 soft delete (archived=true). PRD 17.4: 하드 삭제는 안 함.
 * 성공 시 `/projects` 로 리다이렉트.
 */
export async function archiveProject(id: string): Promise<void> {
  if (!id) throw new Error("id 누락.");

  const userId = await getCurrentUserId();
  const project = await db.project.findFirst({
    where: { id, members: { some: { userId } } },
    select: { id: true },
  });
  if (!project) throw new Error("프로젝트를 찾을 수 없거나 권한 없음.");

  await db.project.update({
    where: { id },
    data: { archived: true },
  });

  revalidatePath("/projects");
  redirect("/projects");
}
