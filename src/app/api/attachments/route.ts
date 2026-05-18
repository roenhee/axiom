import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { uploadRoot } from "@/server/attachments/upload-paths";
import { revalidatePath } from "next/cache";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * 첨부 업로드 (multipart/form-data).
 * fields: file (File), projectId, folderId?
 * 디스크 저장 + Attachment row 생성 → JSON 응답.
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const projectId = String(form.get("projectId") ?? "");
  const folderIdRaw = String(form.get("folderId") ?? "");
  const folderId = folderIdRaw === "" ? null : folderIdRaw;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file 필드 누락." }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId 필드 누락." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "빈 파일." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `파일이 너무 큼 (max ${MAX_FILE_SIZE / 1024 / 1024}MB).` },
      { status: 413 },
    );
  }

  // 멤버십 + 폴더 검증
  const project = await db.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    select: { id: true, slug: true },
  });
  if (!project) {
    return NextResponse.json(
      { error: "프로젝트 없음 또는 권한 없음." },
      { status: 403 },
    );
  }
  if (folderId) {
    const folder = await db.folder.findFirst({
      where: { id: folderId, projectId },
      select: { id: true },
    });
    if (!folder) {
      return NextResponse.json({ error: "폴더 없음." }, { status: 400 });
    }
  }

  // 디스크 저장
  const ext = path.extname(file.name).slice(0, 16); // 확장자 최대 16자
  const storedName = `${randomBytes(12).toString("hex")}${ext}`;
  const dir = path.join(uploadRoot(), projectId);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedName), buffer);

  // order = 같은 부모의 max + 1 (folder/spec 통합 공간 D-036 과 일관성).
  // attachment 는 spec/folder 사이에 끼이지만, 일단 형제 attachments 중 max+1 로.
  const maxOrder = await db.attachment.aggregate({
    where: { projectId, folderId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const attachment = await db.attachment.create({
    data: {
      projectId,
      folderId,
      fileName: file.name,
      storedName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      uploadedById: userId,
      order,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      folderId: true,
      order: true,
    },
  });

  revalidatePath(`/projects/${project.slug}`);

  return NextResponse.json({ attachment });
}
