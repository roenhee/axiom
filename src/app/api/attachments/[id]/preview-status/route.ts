import { NextResponse } from "next/server";
import { getAttachment } from "@/server/attachments/get-attachment";

/**
 * D-045. 첨부 PDF 미리보기 변환 상태 조회.
 * AttachmentView 가 변환 중일 때 ~2초 간격으로 polling.
 * 권한 체크는 getAttachment 가 처리 (404 if not member).
 *
 * Response: { status: "converting"|"ready"|"failed"|null, error: string|null }
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const a = await getAttachment(id);
  if (!a) {
    return NextResponse.json(
      { error: "찾을 수 없거나 권한 없음." },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { status: a.previewStatus, error: a.previewError },
    { headers: { "Cache-Control": "no-store" } },
  );
}
