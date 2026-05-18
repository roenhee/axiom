"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * Spec 본문 Revision 한 건 저장.
 *
 * PRD 7.2 — 자동 저장 이력. AI / Export 기준 아님.
 * 같은 markdown 이면 새 row 안 만듦 (중복 방지).
 * revalidatePath 안 부름 — 자주 호출되는 자동저장이라 SC 리렌더 트리거하면 무의미한 깜빡임.
 * 사용자가 Version Publish 누를 때나 새로고침 시 페이지가 최신 본문을 다시 받음.
 */
export async function createRevision(args: {
  specId: string;
  markdown: string;
}): Promise<{ id: string; createdAt: Date } | null> {
  const userId = await getCurrentUserId();

  // 멤버십 + spec 존재 확인을 한 쿼리로
  const spec = await db.spec.findFirst({
    where: {
      id: args.specId,
      project: { members: { some: { userId } } },
    },
    select: { id: true },
  });
  if (!spec) throw new Error("Spec 을 찾을 수 없거나 권한 없음.");

  // 직전 Revision 과 동일하면 skip
  const latest = await db.revision.findFirst({
    where: { specId: args.specId },
    orderBy: { createdAt: "desc" },
    select: { markdown: true, apiSpec: true },
  });
  if (latest && latest.markdown === args.markdown) {
    return null;
  }

  // apiSpec 은 본문 변경과 무관하게 직전 값을 그대로 carry-forward (full snapshot 원칙, D-040).
  const rev = await db.revision.create({
    data: {
      specId: args.specId,
      authorId: userId,
      markdown: args.markdown,
      apiSpec: latest?.apiSpec ?? null,
    },
    select: { id: true, createdAt: true },
  });
  return rev;
}
