import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAttachment } from "@/server/attachments/get-attachment";
import { uploadRoot } from "@/server/attachments/upload-paths";

/**
 * 첨부 파일 다운로드/미리보기.
 * 권한 체크는 getAttachment 가 멤버십 검증으로 처리.
 *
 * ?inline=1 이면 Content-Disposition inline (브라우저 임베드 / iframe 용),
 * 기본은 attachment (다운로드 강제).
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

  const url = new URL(req.url);
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
