import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAttachment } from "@/server/attachments/get-attachment";
import { uploadRoot } from "@/server/attachments/upload-paths";

/**
 * 첨부 파일 다운로드/미리보기.
 * 권한 체크는 getAttachment 가 멤버십 검증으로 처리.
 *
 * Query params:
 * - `?inline=1` — Content-Disposition inline (브라우저 임베드 / iframe 용).
 *                  기본은 attachment (다운로드 강제).
 * - `?preview=1` — D-045. office 첨부의 변환된 PDF 미리보기를 반환 (Content-Type=application/pdf).
 *                  preview 가 아직 ready 아니면 425 / 404. 항상 inline.
 *                  inline=1 과 무관 — preview=1 이면 무조건 inline.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const attachment = await getAttachment(id);
  if (!attachment) {
    return NextResponse.json(
      { error: "찾을 수 없거나 권한 없음." },
      { status: 404 },
    );
  }

  const url = new URL(req.url);
  const wantPreview = url.searchParams.get("preview") === "1";

  // D-045. preview 분기 — 변환된 PDF 반환
  if (wantPreview) {
    if (attachment.previewStatus !== "ready" || !attachment.previewPath) {
      return NextResponse.json(
        {
          error: "미리보기 준비 안 됨.",
          status: attachment.previewStatus,
        },
        { status: 425 }, // Too Early — 클라이언트는 잠시 후 재요청 또는 polling
      );
    }
    const previewAbs = path.join(uploadRoot(), attachment.previewPath);
    let pbuf: Buffer;
    try {
      pbuf = await readFile(previewAbs);
    } catch {
      return NextResponse.json(
        { error: "미리보기 파일이 디스크에서 사라짐." },
        { status: 410 },
      );
    }
    const encodedName = encodeURIComponent(
      attachment.fileName.replace(/\.(pptx|ppt|docx|doc|xlsx|xls)$/i, "") + ".pdf",
    );
    return new NextResponse(new Uint8Array(pbuf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pbuf.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  // 원본 파일 (다운로드 또는 inline 미리보기)
  const filePath = path.join(
    uploadRoot(),
    attachment.projectId,
    attachment.storedName,
  );
  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch {
    return NextResponse.json(
      { error: "파일이 디스크에서 사라짐." },
      { status: 410 },
    );
  }

  const inline = url.searchParams.get("inline") === "1";
  const encodedName = encodeURIComponent(attachment.fileName);

  // Buffer 를 BodyInit 로 직접 넘기면 타입 충돌 — Uint8Array 로 감싸 안전하게 전달.
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
