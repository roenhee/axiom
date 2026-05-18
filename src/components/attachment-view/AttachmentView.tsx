"use client";

import { useTransition, useState } from "react";
import dynamic from "next/dynamic";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteAttachment } from "@/server/attachments/delete-attachment";
import type { AttachmentDetail } from "@/server/attachments/get-attachment";
import { HtmlPreview } from "./HtmlPreview";

// react-pdf 와 pptx-preview 는 SSR 단계에서 DOMMatrix / canvas / window 등 브라우저
// 전용 API 를 참조 → 서버 렌더 시 ReferenceError. ssr:false 로 client-only 로드.
const PdfPreview = dynamic(
  () => import("./PdfPreview").then((m) => ({ default: m.PdfPreview })),
  { ssr: false, loading: () => <PreviewLoading message="PDF 로딩 중…" /> },
);
const PptxPreview = dynamic(
  () => import("./PptxPreview").then((m) => ({ default: m.PptxPreview })),
  { ssr: false, loading: () => <PreviewLoading message="PPTX 로딩 중…" /> },
);

function PreviewLoading({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-xs text-zinc-500">
      {message}
    </div>
  );
}

interface Props {
  attachment: AttachmentDetail;
}

/**
 * 우측 패널 첨부 미리보기 (D-038).
 * mime 타입에 따라 자동 분기:
 * - image/*  → <img>
 * - application/pdf  → <iframe>
 * - text/*  → 빈 placeholder + 다운로드 (텍스트 내용 표시는 후속)
 * - 그 외  → 다운로드 링크만
 *
 * 다운로드/embed URL 은 항상 /api/attachments/<id>  (?inline=1 옵션).
 */
export function AttachmentView({ attachment }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const inlineUrl = `/api/attachments/${attachment.id}?inline=1`;
  const downloadUrl = `/api/attachments/${attachment.id}`;

  function handleConfirmDelete() {
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        await deleteAttachment(attachment.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-400">
              <span className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                첨부
              </span>
              <span>{attachment.mimeType || "—"}</span>
              <span>· {formatSize(attachment.size)}</span>
            </div>
            <h2 className="mt-1 break-all text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {attachment.fileName}
            </h2>
            <div className="mt-1 text-[11px] text-zinc-500">
              {attachment.uploadedBy.name ?? attachment.uploadedBy.email} ·{" "}
              {attachment.createdAt.toISOString().slice(0, 16).replace("T", " ")}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <a
              href={downloadUrl}
              download={attachment.fileName}
              className="flex h-7 items-center justify-center rounded px-2 text-xs text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="다운로드"
            >
              다운로드
            </a>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              title="삭제"
              aria-label="삭제"
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PreviewBody attachment={attachment} inlineUrl={inlineUrl} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="이 파일을 삭제할까요?"
        message={
          <>
            <strong>{attachment.fileName}</strong> 파일이 영구 삭제됩니다.
          </>
        }
        confirmText="삭제"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function PreviewBody({
  attachment,
  inlineUrl,
}: {
  attachment: AttachmentDetail;
  inlineUrl: string;
}) {
  const mime = attachment.mimeType.toLowerCase();
  const name = attachment.fileName.toLowerCase();
  const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
  const isPptx = mime === PPTX_MIME || name.endsWith(".pptx");
  const isHtml =
    mime === "text/html" || name.endsWith(".html") || name.endsWith(".htm");

  // PDF / PPTX / HTML 는 자체 layout — outer padding 안 줌.
  if (isPdf) return <PdfPreview url={inlineUrl} />;
  if (isPptx) return <PptxPreview url={inlineUrl} />;
  if (isHtml)
    return <HtmlPreview url={inlineUrl} title={attachment.fileName} />;

  if (mime.startsWith("image/")) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-auto bg-zinc-50 p-4 dark:bg-zinc-900/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={inlineUrl}
          alt={attachment.fileName}
          className="max-h-full max-w-full rounded border border-zinc-200 bg-white shadow-sm dark:border-zinc-800"
        />
      </div>
    );
  }

  if (mime.startsWith("video/")) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-auto bg-zinc-50 p-4 dark:bg-zinc-900/30">
        <video
          src={inlineUrl}
          controls
          className="max-h-full max-w-full rounded border border-zinc-200 dark:border-zinc-800"
        />
      </div>
    );
  }

  if (mime.startsWith("audio/")) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-auto bg-zinc-50 p-4 dark:bg-zinc-900/30">
        <audio src={inlineUrl} controls className="w-full max-w-md" />
      </div>
    );
  }

  // 기타 (zip / doc / 등) — 미리보기 없음, 다운로드만 안내.
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 text-center text-xs text-zinc-500 dark:bg-zinc-900/30">
      이 형식은 브라우저에서 미리보기를 지원하지 않습니다. 상단 다운로드 버튼을
      사용하세요.
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
