"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { SpecType } from "@/generated/prisma/enums";

const VALID_TYPES = new Set<string>(Object.values(SpecType));

/**
 * Spec 메타데이터 수정 — title / type / folderId.
 * 본문 markdown 은 Revision/Version 으로 별도 (Phase 1-E / 1-F).
 */
export async function updateSpec(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const folderIdRaw = String(formData.get("folderId") ?? "");
  const folderId = folderIdRaw === "" ? null : folderIdRaw;

  if (!id) throw new Error("id 누락.");
  if (title.length < 1 || title.length > 200) {
    throw new Error("title 은 1~200 자.");
  }
  if (!VALID_TYPES.has(type)) {
    throw new Error(`type 은 ${[...VALID_TYPES].join(" / ")} 중 하나.`);
  }

  const userId = await getCurrentUserId();
  const existing = await db.spec.findFirst({
    where: { id, project: { members: { some: { userId } } } },
    select: { projectId: true, project: { select: { slug: true } } },
  });
  if (!existing) throw new Error("Spec 을 찾을 수 없거나 권한 없음.");

  if (folderId) {
    const folder = await db.folder.findFirst({
      where: { id: folderId, projectId: existing.projectId },
      select: { id: true },
    });
    if (!folder) throw new Error("폴더를 찾을 수 없음.");
  }

  await db.spec.update({
    where: { id },
    data: { title, type: type as SpecType, folderId },
  });

  revalidatePath(`/projects/${existing.project.slug}`);
  revalidatePath(`/projects/${existing.project.slug}/specs/${id}`);
}
