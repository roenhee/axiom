import { NextResponse } from "next/server";
import { getAttachment } from "@/server/attachments/get-attachment";
import { enqueuePreviewConversion } from "@/server/attachments/queue-preview-conversion";

/**
 * D-045. 첨부 PDF 미리보기 변환 trigger.
 * OfficePreview (client) 가 첫 mount 시 또는 retry 시 호출. 권한 체크는 getAttachment
 * 가 처리. enqueuePreviewConversion 는 fire-and-forget — 응답은 즉시 돌아옴.
 *
 * Idempotent — 이미 변환 중이면 skip (queue 모듈의 in-flight Set + status 체크).
 *
 * POST 사용 — side-effect 있는 트리거이므로 GET 부적합.
 */
export async function POST(
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
  // fire-and-forget — Node 가 응답 후에도 spawn 을 계속 진행
  void enqueuePreviewConversion(id);
  return NextResponse.json({ ok: true, status: a.previewStatus });
}
