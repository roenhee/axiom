import "server-only";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import type { FigmaRequiredLevel } from "@/generated/prisma/enums";

export interface FigmaCoverage {
  /** 총 연결된 frame 수 */
  total: number;
  /** required level 별 분포 */
  byLevel: Record<FigmaRequiredLevel, number>;
  /** required 와 recommended 의 합계 — "필요 / 권장" 의 의미 */
  expectedCount: number;
  /** required 와 recommended 중 실제 연결된 수 (현재는 expectedCount 와 같음 — Phase 5+ 에서
   *  Scenario / Slot 등 "기대되지만 연결 안된" 단위가 들어올 때 분리됨) */
  connectedCount: number;
}

/**
 * PRD 8.3 Figma Coverage. MVP 에선 단순히 등록된 frame 의 required level 분포만 반환.
 * PRD 의 "N / M connected" 형태에서 M (expected) 은 Scenario 모델이 들어오는 시점에
 * 재정의 — 일단 required+recommended 합산을 사용.
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
