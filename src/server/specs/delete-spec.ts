"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * Spec 삭제. 연결된 SpecVersion / Revision / SpecRelation 은 schema 의
 * onDelete: Cascade 로 함께 제거. PRD 17.4 — 프로젝트는 archive 만, Spec 은
 * 실제 삭제 허용 (작성 도중 정리 빈도가 높음).
 */
export async function deleteSpec(id: string): Promise<void> {
  if (!id) throw new Error("id 누락.");

  const userId = await getCurrentUserId();
  const spec = await db.spec.findFirst({
    where: { id, project: { members: { some: { userId } } } },
    select: { project: { select: { slug: true } } },
  });
  if (!spec) throw new Error("Spec 을 찾을 수 없거나 권한 없음.");

  await db.spec.delete({ where: { id } });

  revalidatePath(`/projects/${spec.project.slug}`);
  redirect(`/projects/${spec.project.slug}`);
}
