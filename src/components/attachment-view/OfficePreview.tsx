"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Download, RefreshCw } from "lucide-react";

const PdfPreview = dynamic(
  () => import("./PdfPreview").then((m) => ({ default: m.PdfPreview })),
  {
    ssr: false,
    loading: () => <CenterMessage text="PDF 로딩 중…" tone="muted" />,
  },
);

interface Props {
  attachmentId: string;
  fileName: string;
  initialStatus: string | null; // null | "converting" | "ready" | "failed"
  initialError: string | null;
  downloadUrl: string; // 원본 파일 다운로드 (실패 fallback)
}

const POLL_INTERVAL_MS = 2000;
const POLL_BACKOFF_MS = 5000;

/**
 * D-045. PPTX/DOCX/XLSX 같은 office 첨부 미리보기 — 서버에서 LibreOffice 가 변환한
 * PDF 를 PdfPreview 컴포넌트(react-pdf)로 렌더링.
 *
 * 상태 머신:
 *   null   ──[1차 mount 시 enqueue]──▶ converting
 *   converting ──[poll until done]──▶ ready | failed
 *   ready  → <PdfPreview url=/api/attachments/<id>?preview=1>
 *   failed → 에러 메시지 + 다운로드 / 다시 시도 버튼
 */
export function OfficePreview({
  attachmentId,
  fileName,
  initialStatus,
  initialError,
  downloadUrl,
}: Props) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [error, setError] = useState<string | null>(initialError);
  // 폴링용 타이머 ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1) null 이면 (예: D-045 이전 업로드된 legacy 첨부) lazy 변환 시작.
  useEffect(() => {
    if (status === null) {
      setStatus("converting");
      void fetch(`/api/attachments/${attachmentId}/trigger-preview`, {
        method: "POST",
      }).catch(() => {
        /* 네트워크 일시 오류 — polling 이 결국 상태를 잡거나 사용자가 retry */
      });
    }
    // status 가 "ready" / "failed" 면 아무것도 안 함.
    // status 가 "converting" 이면 아래 polling effect 가 처리.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentId]);

  // 2) 변환 중일 때만 폴링.
  useEffect(() => {
    if (status !== "converting") return;
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      try {
        const r = await fetch(`/api/attachments/${attachmentId}/preview-status`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`status ${r.status}`);
        const data = (await r.json()) as { status: string | null; error: string | null };
        if (cancelled) return;
        if (data.status !== status) {
          setStatus(data.status);
          setError(data.error);
        }
        if (data.status === "converting") {
          timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) {
          timerRef.current = setTimeout(tick, POLL_BACKOFF_MS);
        }
      }
    }
    timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, attachmentId]);

  function handleRetry() {
    setStatus("converting");
    setError(null);
    void fetch(`/api/attachments/${attachmentId}/trigger-preview`, {
      method: "POST",
    }).catch(() => {
      /* 사용자가 또 retry 가능 */
    });
  }

  if (status === "ready") {
    return <PdfPreview url={`/api/attachments/${attachmentId}?preview=1`} />;
  }

  if (status === "failed") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-50 px-6 text-center dark:bg-zinc-900/30">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            미리보기를 만들지 못했습니다
          </p>
          <p className="text-xs text-zinc-500">
            원본 파일을 다운로드해서 확인해 주세요.
          </p>
          {error && (
            <details className="mx-auto mt-2 max-w-md text-left text-[11px] text-zinc-400">
              <summary className="cursor-pointer">자세히</summary>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                {error}
              </pre>
            </details>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={downloadUrl}
            download={fileName}
            className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <Download className="h-3.5 w-3.5" />
            다운로드
          </a>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // status === null (mount 직후 잠깐) 또는 "converting"
  return (
    <CenterMessage
      text="미리보기 변환 중… (Office 파일은 처음 한 번만 약 10초 걸립니다)"
      tone="muted"
    />
  );
}

function CenterMessage({ text, tone }: { text: string; tone: "muted" | "error" }) {
  return (
    <div
      className={`flex h-full items-center justify-center px-4 text-center text-xs ${
        tone === "muted" ? "text-zinc-500" : "text-red-600 dark:text-red-400"
      }`}
    >
      {text}
    </div>
  );
}
