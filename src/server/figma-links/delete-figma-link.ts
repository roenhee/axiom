"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * SpecFigmaLink 한 row 삭제. FigmaFrame 자체는 남긴다 (다른 Spec 이 같은 frame 을
 * 공유할 수 있음). 프로젝트 단위 frame 정리 UI 는 별도.
 */
export async function deleteFigmaLink(linkId: string): Promise<void> {
  if (!linkId) throw new Error("linkId 누락.");

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

  await db.specFigmaLink.delete({ where: { id: linkId } });

  revalidatePath(`/projects/${link.spec.project.slug}/specs/${link.specId}`);
}
