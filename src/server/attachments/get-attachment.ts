"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

export interface AttachmentDetail {
  id: string;
  projectId: string;
  projectSlug: string;
  folderId: string | null;
  fileName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedBy: { name: string | null; email: string };
}

/**
 * 첨부 단건 조회 + 멤버십 체크. 우측 패널 미리보기와 API 다운로드 양쪽에서 사용.
 */
export async function getAttachment(
  id: string,
): Promise<AttachmentDetail | null> {
  const userId = await getCurrentUserId();

  const a = await db.attachment.findFirst({
    where: { id, project: { members: { some: { userId } } } },
    select: {
      id: true,
      projectId: true,
      project: { select: { slug: true } },
      folderId: true,
      fileName: true,
      storedName: true,
      mimeType: true,
      size: true,
      createdAt: true,
      uploadedBy: { select: { name: true, email: true } },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    projectId: a.projectId,
    projectSlug: a.project.slug,
    folderId: a.folderId,
    fileName: a.fileName,
    storedName: a.storedName,
    mimeType: a.mimeType,
    size: a.size,
    createdAt: a.createdAt,
    uploadedBy: a.uploadedBy,
  };
}
