"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { SpecRelationType } from "@/generated/prisma/enums";

const VALID_TYPES = new Set<string>(Object.values(SpecRelationType));

/**
 * 새 Spec→Spec 관계 생성.
 * 거부: self-relation, 다른 프로젝트의 Spec, 동일한 (from, to, type) 중복.
 *
 * 주의: contains / depends_on 같은 의미는 그래프 사이클이 가능하지만 (A depends_on B
 * & B depends_on A 가 가능) 1-G 에선 사이클 차단 안 함. PRD 명세 없음. Phase 5+ 검증 필요시 추가.
 */
export async function createSpecRelation(formData: FormData): Promise<void> {
  const fromId = String(formData.get("fromId") ?? "");
  const toId = String(formData.get("toId") ?? "");
  const type = String(formData.get("type") ?? "");

  if (!fromId) throw new Error("fromId 누락.");
  if (!toId) throw new Error("toId 누락.");
  if (fromId === toId) throw new Error("자기 자신과는 관계를 만들 수 없음.");
  if (!VALID_TYPES.has(type)) {
    throw new Error(
      `type 은 ${[...VALID_TYPES].join(" / ")} 중 하나.`,
    );
  }

  const userId = await getCurrentUserId();

  const from = await db.spec.findFirst({
    where: { id: fromId, project: { members: { some: { userId } } } },
    select: { projectId: true, project: { select: { slug: true } } },
  });
  if (!from) throw new Error("출발 Spec 을 찾을 수 없거나 권한 없음.");

  const to = await db.spec.findFirst({
    where: { id: toId, projectId: from.projectId },
    select: { id: true },
  });
  if (!to) {
    throw new Error("대상 Spec 이 다른 프로젝트에 있거나 없음.");
  }

  try {
    await db.specRelation.create({
      data: { fromId, toId, type: type as SpecRelationType },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique")) {
      throw new Error("이미 같은 관계가 있습니다.");
    }
    throw e;
  }

  revalidatePath(`/projects/${from.project.slug}/specs/${fromId}`);
  revalidatePath(`/projects/${from.project.slug}/specs/${toId}`);
}
