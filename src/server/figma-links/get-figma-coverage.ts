"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import type { FigmaCoverage } from "./types";

/**
 * PRD 8.3 Figma Coverage. MVP 에선 단순히 등록된 frame 의 required level 분포만 반환.
 * D-049 — PRD 의 "N / M connected" 형태에서 M (expected) 은 Scenario 모델이 들어오는
 * 시점 (Phase 5) 에 재정의. 일단 required+recommended 합산을 사용.
 */
export async function getFigmaCoverage(specId: string): Promise<FigmaCoverage> {
  const userId = await getCurrentUserId();

  const spec = await db.spec.findFirst({
    where: { id: specId, project: { members: { some: { userId } } } },
    select: { id: true },
  });

  const empty: FigmaCoverage = {
    total: 0,
    byLevel: { required: 0, recommended: 0, optional: 0, not_needed: 0 },
    expectedCount: 0,
    connectedCount: 0,
  };
  if (!spec) return empty;

  const grouped = await db.specFigmaLink.groupBy({
    by: ["requiredLevel"],
    where: { specId },
    _count: { _all: true },
  });

  const byLevel = { ...empty.byLevel };
  for (const g of grouped) {
    byLevel[g.requiredLevel] = g._count._all;
  }
  const total = byLevel.required + byLevel.recommended + byLevel.optional + byLevel.not_needed;
  const expectedCount = byLevel.required + byLevel.recommended;

  return {
    total,
    byLevel,
    expectedCount,
    connectedCount: expectedCount,
  };
}
