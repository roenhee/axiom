"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * Spec 의 API spec (OpenAPI YAML/JSON 텍스트) 자동 저장 + 변경 시 자동 발행 (D-040).
 *
 * 흐름:
 * 1. 멤버십 확인.
 * 2. 직전 Revision 의 apiSpec 과 동일하면 no-op.
 * 3. 새 Revision 생성 — markdown 은 직전 값 carry-forward, apiSpec 은 새 값.
 * 4. 마지막 SpecVersion 의 apiSpec 과 다르면 자동으로 새 SpecVersion 발행
 *    (changeType="api", changeSummary="API 스펙 자동 발행 vN").
 *
 * 본문 (markdown) 은 수동 발행 그대로 — API 만 자동 발행.
 */
export async function updateApiSpec(args: {
  specId: string;
  apiSpec: string;
}): Promise<{
  revision: { id: string; createdAt: Date } | null;
  publishedVersionLabel: string | null;
}> {
  const userId = await getCurrentUserId();

  const spec = await db.spec.findFirst({
    where: { id: args.specId, project: { members: { some: { userId } } } },
    select: { id: true, project: { select: { slug: true } } },
  });
  if (!spec) throw new Error("Spec 을 찾을 수 없거나 권한 없음.");

  // 빈 문자열은 null 로 정규화 (clear 의도) — 단 latest.apiSpec 도 null 이면 no-op.
  const normalized = args.apiSpec.trim() === "" ? null : args.apiSpec;

  const latest = await db.revision.findFirst({
    where: { specId: args.specId },
    orderBy: { createdAt: "desc" },
    select: { markdown: true, apiSpec: true },
  });
  if ((latest?.apiSpec ?? null) === normalized) {
    return { revision: null, publishedVersionLabel: null };
  }

  // Revision 생성 + 필요 시 자동 발행 — 한 transaction.
  const result = await db.$transaction(async (tx) => {
    const rev = await tx.revision.create({
      data: {
        specId: args.specId,
        authorId: userId,
        markdown: latest?.markdown ?? "",
        apiSpec: normalized,
      },
      select: { id: true, createdAt: true },
    });

    const lastVersion = await tx.specVersion.findFirst({
      where: { specId: args.specId },
      orderBy: { createdAt: "desc" },
      select: { versionLabel: true, apiSpec: true },
    });

    // 마지막 발행본의 apiSpec 과 동일하면 발행 안 함.
    if ((lastVersion?.apiSpec ?? null) === normalized) {
      return { rev, publishedLabel: null as string | null };
    }

    const nextN = parseVersionLabel(lastVersion?.versionLabel) + 1;
    const label = `v${nextN}`;
    await tx.specVersion.create({
      data: {
        specId: args.specId,
        versionLabel: label,
        status: "Published",
        markdown: latest?.markdown ?? "",
        apiSpec: normalized,
        changeType: "api",
        changeSummary: `API 스펙 자동 발행 ${label}`,
        createdById: userId,
        publishedAt: new Date(),
      },
    });
    return { rev, publishedLabel: label };
  });

  // SpecVersion 발행되면 히스토리 탭에 반영 필요 → revalidate.
  if (result.publishedLabel) {
    revalidatePath(`/projects/${spec.project.slug}/specs/${args.specId}`);
  }

  return {
    revision: result.rev,
    publishedVersionLabel: result.publishedLabel,
  };
}

function parseVersionLabel(label: string | undefined): number {
  if (!label) return 0;
  const m = /^v(\d+)$/.exec(label);
  if (!m) return 0;
  return Number(m[1]);
}
