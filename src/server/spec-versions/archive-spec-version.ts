"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * SpecVersion 을 Archived 상태로. PRD 7.5 — "더 이상 사용하지 않는 과거 버전".
 * Published / Archived 사이만 토글. Draft 는 사용 안 함 (1-F 시점).
 */
export async function archiveSpecVersion(id: string): Promise<void> {
  if (!id) throw new Error("id 누락.");

  const userId = await getCurrentUserId();
  const version = await db.specVersion.findFirst({
    where: {
      id,
      spec: { project: { members: { some: { userId } } } },
    },
    select: {
      spec: {
        select: {
          id: true,
          project: { select: { slug: true } },
        },
      },
    },
  });
  if (!version) throw new Error("Version 을 찾을 수 없거나 권한 없음.");

  await db.specVersion.update({
    where: { id },
    data: { status: "Archived" },
  });

  revalidatePath(
    `/projects/${version.spec.project.slug}/specs/${version.spec.id}`,
  );
  revalidatePath(
    `/projects/${version.spec.project.slug}/specs/${version.spec.id}/versions`,
  );
  revalidatePath(
    `/projects/${version.spec.project.slug}/specs/${version.spec.id}/versions/${id}`,
  );
}
