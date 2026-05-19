"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * FigmaFrame.label 변경 — 같은 frame 을 공유하는 모든 Spec 의 link 에 반영된다.
 * Phase 2 MVP 에선 link 별 별칭 분리 안 함 (PRD 8.3 의 "라벨" 은 frame 1개당 1개라고 본다).
 */
export async function renameFigmaFrame(formData: FormData): Promise<void> {
  const frameId = String(formData.get("frameId") ?? "");
  const label = String(formData.get("label") ?? "").trim();

  if (!frameId) throw new Error("frameId 누락.");
  if (label.length === 0) throw new Error("라벨이 비어 있습니다.");

  const userId = await getCurrentUserId();

  const frame = await db.figmaFrame.findFirst({
    where: {
      id: frameId,
      project: { members: { some: { userId } } },
    },
    select: {
      projectId: true,
      project: { select: { slug: true } },
      links: { select: { specId: true } },
    },
  });
  if (!frame) throw new Error("Figma frame 을 찾을 수 없거나 권한 없음.");

  await db.figmaFrame.update({
    where: { id: frameId },
    data: { label: label.slice(0, 200) },
  });

  // 이 frame 을 참조하는 모든 Spec 페이지 revalidate.
  for (const link of frame.links) {
    revalidatePath(`/projects/${frame.project.slug}/specs/${link.specId}`);
  }
}
