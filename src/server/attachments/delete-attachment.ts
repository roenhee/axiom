"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { uploadRoot } from "./upload-paths";

/**
 * Attachment 삭제. DB row + 디스크 파일 둘 다 제거.
 * 디스크 unlink 실패해도 DB 삭제는 진행 (orphan 파일은 별도 cleanup 으로 처리).
 * 삭제 후 프로젝트 루트로 redirect — 사용자가 첨부 페이지를 열어둔 상태였다면
 * notFound() 가 터지지 않도록.
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
      previewPath: true,
      project: { select: { slug: true } },
    },
  });
  if (!a) throw new Error("첨부를 찾을 수 없거나 권한 없음.");

  await db.attachment.delete({ where: { id } });

  // 디스크 파일 삭제 (best-effort) — 원본 + D-045 preview PDF 양쪽 다.
  const root = uploadRoot();
  try {
    await unlink(path.join(root, a.projectId, a.storedName));
  } catch {
    /* swallow — orphan 파일은 별도 정리 */
  }
  if (a.previewPath) {
    try {
      await unlink(path.join(root, a.previewPath));
    } catch {
      /* swallow */
    }
  }

  revalidatePath(`/projects/${a.project.slug}`);
  redirect(`/projects/${a.project.slug}`);
}
