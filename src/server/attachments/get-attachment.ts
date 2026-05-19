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
  /// D-045. office preview 변환 상태 (PPTX/DOCX/XLSX 만 해당).
  /// null/"converting"/"ready"/"failed".
  previewStatus: string | null;
  previewError: string | null;
  /// D-045. uploadRoot 기준 상대경로 (`<projectId>/<stored>.preview.pdf`).
  /// "ready" 상태일 때만 의미 있음. UI 는 직접 사용 안 함 — `/api/attachments/<id>?preview=1` 로 fetch.
  previewPath: string | null;
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
      previewStatus: true,
      previewError: true,
      previewPath: true,
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
    previewStatus: a.previewStatus,
    previewError: a.previewError,
    previewPath: a.previewPath,
  };
}
