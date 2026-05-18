import { notFound } from "next/navigation";
import { getAttachment } from "@/server/attachments/get-attachment";
import { AttachmentView } from "@/components/attachment-view/AttachmentView";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

/**
 * 첨부 미리보기 — 우측 패널에 렌더.
 * 라우트가 spec 과 같은 layout 안에 있어서 좌 트리 / 가운데 / 우 패널 그대로 유지.
 */
export default async function AttachmentPage({ params }: PageProps) {
  const { id } = await params;
  const attachment = await getAttachment(id);
  if (!attachment) notFound();

  return <AttachmentView attachment={attachment} />;
}
