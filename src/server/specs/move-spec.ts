"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * Spec 의 폴더 변경. newFolderId = null 이면 루트로 이동.
 * 1-i 의 트리 DnD 에서 사용. 다른 메타(title/type)는 건드리지 않음.
 *
 * 거부 케이스:
 * - Spec 권한 없음
 * - 다른 프로젝트의 폴더로 이동
 */
export async function moveSpec(args: {
  id: string;
  newFolderId: string | null;
}): Promise<void> {
  const userId = await getCurrentUserId();

  const spec = await db.spec.findUnique({
    where: { id: args.id },
    select: {
      id: true,
      projectId: true,
      folderId: true,
      project: {
        select: { slug: true, members: { where: { userId }, select: { id: true } } },
      },
    },
  });
  if (!spec) throw new Error("Spec 없음.");
  if (spec.project.members.length === 0) throw new Error("권한 없음.");

  if (spec.folderId === args.newFolderId) return;

  if (args.newFolderId) {
    const folder = await db.folder.findUnique({
      where: { id: args.newFolderId },
      select: { projectId: true },
    });
    if (!folder) throw new Error("폴더를 찾을 수 없음.");
    if (folder.projectId !== spec.projectId) {
      throw new Error("다른 프로젝트로는 이동 불가.");
    }
  }

  await db.spec.update({
    where: { id: args.id },
    data: { folderId: args.newFolderId },
  });

  revalidatePath(`/projects/${spec.project.slug}`);
}
