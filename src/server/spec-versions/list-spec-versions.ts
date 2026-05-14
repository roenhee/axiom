"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * Spec 의 SpecVersion 목록 — 최신 발행 순.
 * 멤버십 체크 포함.
 */
export async function listSpecVersions(specId: string) {
  const userId = await getCurrentUserId();

  const spec = await db.spec.findFirst({
    where: { id: specId, project: { members: { some: { userId } } } },
    select: { id: true },
  });
  if (!spec) throw new Error("Spec 을 찾을 수 없거나 권한 없음.");

  return db.specVersion.findMany({
    where: { specId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      versionLabel: true,
      status: true,
      changeSummary: true,
      changeType: true,
      publishedAt: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
}
