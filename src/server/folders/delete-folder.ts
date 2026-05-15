"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * 폴더 삭제. API 명세대로 "안에 Spec/하위 폴더 없을 때만" 허용.
 */
export async function deleteFolder(args: { id: string }): Promise<void> {
  const userId = await getCurrentUserId();

  const folder = await db.folder.findUnique({
    where: { id: args.id },
    select: {
      projectId: true,
      isLocked: true,
      _count: { select: { children: true, specs: true } },
      project: { select: { slug: true, members: { where: { userId } } } },
    },
  });
  if (!folder) throw new Error("폴더 없음.");
  if (folder.project.members.length === 0) throw new Error("권한 없음.");
  if (folder.isLocked) {
    throw new Error("시스템 예약 폴더 — 삭제할 수 없습니다.");
  }

  if (folder._count.children > 0) {
    throw new Error("하위 폴더가 있어 삭제 불가. 먼저 하위를 비우세요.");
  }
  if (folder._count.specs > 0) {
    throw new Error("안에 Spec 이 있어 삭제 불가. 먼저 Spec 을 옮기거나 지우세요.");
  }

  await db.folder.delete({ where: { id: args.id } });

  revalidatePath(`/projects/${folder.project.slug}`);
}
