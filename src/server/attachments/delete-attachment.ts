"use server";

import { revalidatePath } from "next/cache";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { uploadRoot } from "./upload-paths";

/**
 * Attachment 삭제. DB row + 디스크 파일 둘 다 제거.
 * 디스크 unlink 실패해도 DB 삭제는 진행 (orphan 파일은 별도 cleanup 으로 처리).
 */
export async function deleteAttachment(id: string): Promise<void> {
  if (!id) throw new Error("id 누락.");

  const userId = await getCurrentUserId();
  const a = await db.attachment.findFirst({
    where: { id, project: { members: { some: { userId } } } },
    select: {
      id: true,
      projectId: true,
      storedName: true,
      project: { select: { slug: true } },
    },
  });
  if (!a) throw new Error("첨부를 찾을 수 없거나 권한 없음.");

  await db.attachment.delete({ where: { id } });

  // 디스크 파일 삭제 (best-effort)
  try {
    const filePath = path.join(uploadRoot(), a.projectId, a.storedName);
    await unlink(filePath);
  } catch {
    /* swallow — orphan 파일은 별도 정리 */
  }

  revalidatePath(`/projects/${a.project.slug}`);
}
