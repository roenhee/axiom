"use client";

import { useEffect, useRef, useState } from "react";
import { FloatingPageNav } from "./FloatingPageNav";

interface Previewer {
  currentIndex: number;
  slideCount: number;
  preview(buf: ArrayBuffer): Promise<unknown>;
  renderNextSlide(): void;
  renderPreSlide(): void;
  destroy?: () => void;
}

interface PptxPreviewModule {
  init: (
    dom: HTMLElement,
    opts: { width?: number; height?: number; mode?: "list" | "slide" },
  ) => Previewer;
}

interface Props {
  url: string;
}

const CONTAINER_PADDING = 16;
const SLIDE_ASPECT_RATIO = 16 / 9; // 슬라이드는 16:9 가정 — 4:3 PPTX 는 letterbox.
const RESIZE_DEBOUNCE_MS = 250;
const MIN_DIM = 240;
/** nav pill + gap-6 (24px) + 여유 — slide 높이 계산 시 컨테이너에서 빼는 공간. */
const NAV_BLOCK_HEIGHT = 62;

/**
 * PPTX 미리보기 (D-039).
 * - 패널 크기에 자동 fit — ResizeObserver + debounce 로 dimensions state 추적,
 *   pptx-preview re-init (lib 가 live resize API 없음).
 * - 16:9 슬라이드 가정. 컨테이너 가로/세로 중 작은 쪽 기준으로 fit.
 * - 가로/세로 중앙 정렬 (flex items-center justify-center).
 * - 페이지 nav 는 하단 floating pill — lib 자체 페이지네이션은 CSS 로 숨김
 *   (`.pptx-preview-host [class*="pagination"]` 등, globals.css).
 *
 * 한계: 라이브러리에 live resize API 없어서 dimensions 바뀔 때마다 re-init.
 * 따라서 패널 크기 드래그 중엔 잠시 빈 화면 → debounce 로 부드럽게.
 */
export function PptxPreview({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<Previewer | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(1);
  const [slideCount, setSlideCount] = useState(0);
  // 사용자가 마지막으로 본 페이지 — re-init 시 그 페이지로 복원.
  const lastSlideRef = useRef(1);

  // 1. 파일 다운로드 (한 번)
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`다운로드 실패 (${r.status})`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (!cancelled) setBuffer(buf);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "다운로드 실패");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // 2. 컨테이너 크기 추적 — debounce
  useEffect(() => {
    if (!containerRef.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function commitDimensions() {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth - CONTAINER_PADDING * 2;
      // slide + 12px gap + nav pill 이 컨테이너에 들어가야 하므로 nav 공간 제외.
      const availH =
        containerRef.current.clientHeight - CONTAINER_PADDING * 2 - NAV_BLOCK_HEIGHT;
      if (cw < MIN_DIM || availH < MIN_DIM) return;
      // 16:9 fit — width-bound 또는 height-bound 중 더 작은 쪽.
      const widthIfFitHeight = availH * SLIDE_ASPECT_RATIO;
      let slideW: number, slideH: number;
      if (widthIfFitHeight <= cw) {
        slideH = availH;
        slideW = widthIfFitHeight;
      } else {
        slideW = cw;
        slideH = cw / SLIDE_ASPECT_RATIO;
      }
      setDimensions((prev) => {
        const nw = Math.floor(slideW);
        const nh = Math.floor(slideH);
        if (prev && prev.width === nw && prev.height === nh) return prev;
        return { width: nw, height: nh };
      });
    }
    function debouncedCommit() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(commitDimensions, RESIZE_DEBOUNCE_MS);
    }
    commitDimensions(); // 첫 동기 측정
    const ro = new ResizeObserver(debouncedCommit);
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // 3. buffer + dimensions 준비되면 init/re-init
  useEffect(() => {
    if (!buffer || !dimensions || !slideRef.current) return;
    let cancelled = false;
    let p: Previewer | null = null;

    async function init() {
      try {
        const mod = (await import("pptx-preview")) as unknown as PptxPreviewModule;
        if (cancelled || !slideRef.current) return;
        // 이전 렌더 클리어 (re-init 시 노드 누적 방지)
        slideRef.current.innerHTML = "";
        p = mod.init(slideRef.current, {
          width: dimensions!.width,
          height: dimensions!.height,
          mode: "slide",
        });
        previewerRef.current = p;
        // ArrayBuffer 가 detach 될 수 있으니 slice 로 복사
        const bufCopy = buffer!.slice(0);
        await p.preview(bufCopy);
        if (cancelled) return;
        setSlideCount(p.slideCount);
        // 이전 페이지 복원
        const target = Math.min(Math.max(1, lastSlideRef.current), p.slideCount);
        for (let i = 1; i < target; i++) p.renderNextSlide();
        setCurrentIndex(p.currentIndex);
        setLoading(false);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "PPTX 로딩 실패");
          setLoading(false);
        }
      }
    }
    init();

    return () => {
      cancelled = true;
      try {
        p?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, [buffer, dimensions]);

  /**
   * 임의 페이지로 이동. pptx-preview lib 는 인접 이동만 (renderNext/PreSlide)
   * — 차이만큼 반복 호출. 큰 점프도 동기 루프지만 슬라이드 렌더가 가벼워 OK.
   */
  function goTo(target: number) {
    const p = previewerRef.current;
    if (!p) return;
    const clamped = Math.max(1, Math.min(p.slideCount, target));
    while (p.currentIndex < clamped) p.renderNextSlide();
    while (p.currentIndex > clamped) p.renderPreSlide();
    setCurrentIndex(p.currentIndex);
    lastSlideRef.current = p.currentIndex;
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full items-center justify-center overflow-auto bg-zinc-100 p-4 dark:bg-zinc-900"
    >
      <div className="flex flex-col items-center gap-6">
        <div
          ref={slideRef}
          className="pptx-preview-host bg-white shadow-md"
        />
        <FloatingPageNav
          current={currentIndex}
          total={slideCount}
          onGoTo={goTo}
        />
      </div>
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
          PPTX 로딩 중…
        </div>
      )}
      {error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-red-600 dark:text-red-400">
          PPTX 로딩 실패: {error}
        </div>
      )}
    </div>
  );
}
