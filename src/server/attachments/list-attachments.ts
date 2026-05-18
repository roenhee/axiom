"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

export interface AttachmentNode {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  order: number;
}

/**
 * 프로젝트의 모든 Attachment 플랫 리스트 (트리 재구성용).
 * 멤버십 체크.
 */
export async function listAttachments(
  projectId: string,
): Promise<AttachmentNode[]> {
  const userId = await getCurrentUserId();

  const membership = await db.userRole.findFirst({
    where: { userId, projectId },
    select: { id: true },
  });
  if (!membership) throw new Error("프로젝트 권한 없음.");

  const attachments = await db.attachment.findMany({
    where: { projectId },
    orderBy: [{ folderId: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      folderId: true,
      order: true,
    },
  });
  return attachments;
}
