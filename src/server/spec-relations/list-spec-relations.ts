"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import type { SpecRelationType, SpecType } from "@/generated/prisma/enums";

export interface RelationEdge {
  id: string;
  type: SpecRelationType;
  other: {
    id: string;
    title: string;
    type: SpecType;
  };
}

export interface SpecRelations {
  /** 이 Spec 이 fromId 인 관계들 — "이 Spec → 다른 Spec" */
  outgoing: RelationEdge[];
  /** 이 Spec 이 toId 인 관계들 — "다른 Spec → 이 Spec" */
  incoming: RelationEdge[];
}

/**
 * 특정 Spec 의 양방향 관계.
 * outgoing 은 "이 Spec contains / depends_on 등 다른 Spec",
 * incoming 은 그 역방향 — 다른 Spec 이 이 Spec 을 contain / depend_on 하는 것.
 */
export async function listSpecRelations(specId: string): Promise<SpecRelations> {
  const userId = await getCurrentUserId();

  const spec = await db.spec.findFirst({
    where: { id: specId, project: { members: { some: { userId } } } },
    select: { id: true },
  });
  if (!spec) throw new Error("Spec 을 찾을 수 없거나 권한 없음.");

  const [out, inc] = await Promise.all([
    db.specRelation.findMany({
      where: { fromId: specId },
      select: {
        id: true,
        type: true,
        to: { select: { id: true, title: true, type: true } },
      },
      orderBy: [{ type: "asc" }],
    }),
    db.specRelation.findMany({
      where: { toId: specId },
      select: {
        id: true,
        type: true,
        from: { select: { id: true, title: true, type: true } },
      },
      orderBy: [{ type: "asc" }],
    }),
  ]);

  return {
    outgoing: out.map((r) => ({ id: r.id, type: r.type, other: r.to })),
    incoming: inc.map((r) => ({ id: r.id, type: r.type, other: r.from })),
  };
}
