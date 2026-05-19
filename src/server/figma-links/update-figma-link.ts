"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { FigmaRequiredLevel } from "@/generated/prisma/enums";

const VALID_LEVELS = new Set<string>(Object.values(FigmaRequiredLevel));

/**
 * requiredLevel 변경 — frame chip 의 토글 콜백.
 * label 변경은 FigmaFrame 측이 아니라 link 별 별칭이 아니므로 update-figma-frame
 * 에서 처리 (Phase 2 MVP 에선 frame.label 만 직접 편집 — 별도 action 미제공).
 */
export async function updateFigmaLinkLevel(
  linkId: string,
  level: FigmaRequiredLevel,
): Promise<void> {
  if (!linkId) throw new Error("linkId 누락.");
  if (!VALID_LEVELS.has(level)) {
    throw new Error(`requiredLevel 은 ${[...VALID_LEVELS].join(" / ")} 중 하나.`);
  }

  const userId = await getCurrentUserId();

  const link = await db.specFigmaLink.findFirst({
    where: {
      id: linkId,
      spec: { project: { members: { some: { userId } } } },
    },
    select: {
      specId: true,
      spec: { select: { project: { select: { slug: true } } } },
    },
  });
  if (!link) throw new Error("Figma 연결을 찾을 수 없거나 권한 없음.");

  await db.specFigmaLink.update({
    where: { id: linkId },
    data: { requiredLevel: level },
  });

  revalidatePath(`/projects/${link.spec.project.slug}/specs/${link.specId}`);
}
