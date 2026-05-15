"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * 특정 SpecVersion 의 markdown 본문만 반환. 히스토리 탭의 lazy expand 용.
 * 멤버십 체크 포함.
 */
export async function getSpecVersionMarkdown(versionId: string): Promise<string> {
  const userId = await getCurrentUserId();

  const version = await db.specVersion.findFirst({
    where: {
      id: versionId,
      spec: { project: { members: { some: { userId } } } },
    },
    select: { markdown: true },
  });
  if (!version) throw new Error("버전을 찾을 수 없거나 권한 없음.");
  return version.markdown;
}
