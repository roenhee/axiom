"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * 프로젝트 이름만 수정. slug 변경은 외부 링크가 깨질 수 있어 보류 (필요해지면 별도 액션 + 리다이렉트 처리).
 */
export async function updateProject(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!id) throw new Error("id 누락.");
  if (name.length < 1 || name.length > 100) {
    throw new Error("name 은 1~100 자.");
  }

  const userId = await getCurrentUserId();
  const project = await db.project.findFirst({
    where: { id, members: { some: { userId } } },
    select: { slug: true },
  });
  if (!project) throw new Error("프로젝트를 찾을 수 없거나 권한 없음.");

  await db.project.update({
    where: { id },
    data: { name },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${project.slug}`);
  revalidatePath(`/projects/${project.slug}/settings`);
}
