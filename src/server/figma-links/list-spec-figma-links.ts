"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import type { SpecFigmaLinkItem } from "./types";

/**
 * 한 Spec 에 연결된 Figma frame 목록 — order asc, createdAt asc 기준.
 * 본인이 멤버인 프로젝트의 Spec 만 결과 반환 (다른 프로젝트는 빈 배열).
 */
export async function listSpecFigmaLinks(
  specId: string,
): Promise<SpecFigmaLinkItem[]> {
  const userId = await getCurrentUserId();

  const spec = await db.spec.findFirst({
    where: { id: specId, project: { members: { some: { userId } } } },
    select: { id: true },
  });
  if (!spec) return [];

  const links = await db.specFigmaLink.findMany({
    where: { specId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      requiredLevel: true,
      order: true,
      figmaFrame: {
        select: { id: true, fileKey: true, nodeId: true, label: true },
      },
    },
  });

  return links.map((l) => ({
    id: l.id,
    requiredLevel: l.requiredLevel,
    order: l.order,
    frame: l.figmaFrame,
  }));
}
