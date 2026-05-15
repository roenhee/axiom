"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * Spec 이름 (title) 만 변경. 인라인 rename 전용 — 메타 탭의 updateSpec 와 별개.
 * (updateSpec 은 title/type/folderId 모두 받음. rename 에서 굳이 type/folder
 * 까지 직렬화 보낼 필요 없어 별도.)
 */
export async function renameSpec(args: {
  id: string;
  title: string;
}): Promise<void> {
  const title = args.title.trim();
  if (title.length < 1 || title.length > 200) {
    throw new Error("Spec 제목은 1~200 자.");
  }

  const userId = await getCurrentUserId();

  const spec = await db.spec.findUnique({
    where: { id: args.id },
    select: {
      project: { select: { slug: true, members: { where: { userId }, select: { id: true } } } },
    },
  });
  if (!spec) throw new Error("Spec 없음.");
  if (spec.project.members.length === 0) throw new Error("권한 없음.");

  await db.spec.update({
    where: { id: args.id },
    data: { title },
  });

  revalidatePath(`/projects/${spec.project.slug}`);
  revalidatePath(`/projects/${spec.project.slug}/specs/${args.id}`);
}
