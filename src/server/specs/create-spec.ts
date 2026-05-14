"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { SpecType } from "@/generated/prisma/enums";

const VALID_TYPES = new Set<string>(Object.values(SpecType));

/**
 * 새 Spec 생성. 성공 시 `/projects/<slug>/specs/<id>` 로 redirect.
 */
export async function createSpec(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const folderIdRaw = String(formData.get("folderId") ?? "");
  const folderId = folderIdRaw === "" ? null : folderIdRaw;

  if (!projectId) throw new Error("projectId 누락.");
  if (title.length < 1 || title.length > 200) {
    throw new Error("title 은 1~200 자.");
  }
  if (!VALID_TYPES.has(type)) {
    throw new Error(`type 은 ${[...VALID_TYPES].join(" / ")} 중 하나.`);
  }

  const userId = await getCurrentUserId();
  const project = await db.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    select: { id: true, slug: true },
  });
  if (!project) throw new Error("프로젝트 권한 없음.");

  if (folderId) {
    const folder = await db.folder.findFirst({
      where: { id: folderId, projectId },
      select: { id: true },
    });
    if (!folder) throw new Error("폴더를 찾을 수 없음.");
  }

  const spec = await db.spec.create({
    data: {
      projectId,
      folderId,
      title,
      type: type as SpecType,
    },
    select: { id: true },
  });

  revalidatePath(`/projects/${project.slug}`);
  redirect(`/projects/${project.slug}/specs/${spec.id}`);
}
