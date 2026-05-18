"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * 가장 최근 Revision 의 apiSpec 반환. 없으면 빈 문자열.
 * API 탭 에디터 초기 본문 채우기에 사용 (D-040).
 */
export async function getLatestApiSpec(specId: string): Promise<string> {
  const userId = await getCurrentUserId();

  const spec = await db.spec.findFirst({
    where: {
      id: specId,
      project: { members: { some: { userId } } },
    },
    select: { id: true },
  });
  if (!spec) throw new Error("Spec 을 찾을 수 없거나 권한 없음.");

  const latest = await db.revision.findFirst({
    where: { specId },
    orderBy: { createdAt: "desc" },
    select: { apiSpec: true },
  });
  return latest?.apiSpec ?? "";
}
