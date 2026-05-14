"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * Spec 의 현재 본문 (최신 Revision) 을 새 SpecVersion 으로 발행.
 *
 * 정책 (PRD 7):
 * - versionLabel 은 자동 증가 — 기존 "vN" 중 max(N) + 1. 첫 발행은 "v1".
 * - 발행 즉시 status=Published, publishedAt=now. Draft 상태는 추후 워크플로 용도로 유지.
 * - snapshot 은 최신 Revision 의 markdown — 없으면 빈 문자열.
 *
 * 동시성: prisma transaction + unique([specId, versionLabel]) 로 보호. 동시 발행 충돌 시
 * 두 번째는 unique violation 으로 throw.
 */
export async function publishSpecVersion(formData: FormData): Promise<void> {
  const specId = String(formData.get("specId") ?? "");
  const changeSummary =
    String(formData.get("changeSummary") ?? "").trim() || null;
  const changeType =
    String(formData.get("changeType") ?? "").trim() || null;

  if (!specId) throw new Error("specId 누락.");

  const userId = await getCurrentUserId();

  const spec = await db.spec.findFirst({
    where: { id: specId, project: { members: { some: { userId } } } },
    select: { id: true, project: { select: { slug: true } } },
  });
  if (!spec) throw new Error("Spec 을 찾을 수 없거나 권한 없음.");

  const latestRevision = await db.revision.findFirst({
    where: { specId },
    orderBy: { createdAt: "desc" },
    select: { markdown: true },
  });
  const markdown = latestRevision?.markdown ?? "";

  await db.$transaction(async (tx) => {
    const latestVersion = await tx.specVersion.findFirst({
      where: { specId },
      orderBy: { createdAt: "desc" },
      select: { versionLabel: true },
    });
    const nextN = parseVersionLabel(latestVersion?.versionLabel) + 1;

    await tx.specVersion.create({
      data: {
        specId,
        versionLabel: `v${nextN}`,
        status: "Published",
        markdown,
        changeSummary,
        changeType,
        createdById: userId,
        publishedAt: new Date(),
      },
    });
  });

  revalidatePath(`/projects/${spec.project.slug}/specs/${specId}`);
  revalidatePath(`/projects/${spec.project.slug}/specs/${specId}/versions`);
}

/** "v3" → 3. 파싱 실패 시 0. */
function parseVersionLabel(label: string | undefined): number {
  if (!label) return 0;
  const m = /^v(\d+)$/.exec(label);
  if (!m) return 0;
  return Number(m[1]);
}
