"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { FloatingPageNav } from "./FloatingPageNav";

// PDF.js worker — public/ 에 self-host (외부 CDN 금지, D-008).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface Props {
  url: string;
}

const CONTAINER_PADDING = 16;

/**
 * PDF 미리보기 (D-039).
 * - 패널 크기에 자동 fit — ResizeObserver 로 컨테이너 width 추적, react-pdf 의
 *   Page width prop 으로 반영. 가로 비율 유지.
 * - 가로/세로 중앙 정렬 (flex items-center justify-center).
 * - 페이지 nav 는 하단 floating pill.
 */
export function PdfPreview({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(
    undefined,
  );
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    function update() {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth - CONTAINER_PADDING * 2;
      setContainerWidth(w > 100 ? w : 100);
    }
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex h-full items-center justify-center overflow-auto bg-zinc-100 p-4 dark:bg-zinc-900"
    >
      <div className="flex flex-col items-center gap-6">
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            setPageNumber((p) => Math.min(p, numPages));
          }}
          onLoadError={() => setNumPages(0)}
          loading={
            <div className="py-8 text-xs text-zinc-500">PDF 로딩 중…</div>
          }
          error={
            <div className="py-8 text-xs text-red-600 dark:text-red-400">
              PDF 로딩 실패.
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            width={containerWidth}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            className="shadow-md"
          />
        </Document>
        <FloatingPageNav
          current={pageNumber}
          total={numPages}
          onGoTo={(n) => setPageNumber(Math.max(1, Math.min(numPages, n)))}
        />
      </div>
    </div>
  );
}
