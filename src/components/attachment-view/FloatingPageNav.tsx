"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  current: number;
  /** total 이 Infinity 면 "X / Y" 의 Y 와 next 버튼 disable 을 생략 (HTML deck 처럼
   * 총 페이지 수를 알 수 없는 경우). */
  total: number;
  onGoTo: (page: number) => void;
}

/**
 * PDF / PPTX 페이지 nav pill (D-039).
 * - 위치: 부모(flex column) 안에서 콘텐츠(슬라이드/페이지) 바로 아래 12px.
 *   FloatingPageNav 자체는 in-flow — 부모가 flex-col + gap-3 으로 12px 부여.
 * - 기능: 처음으로 (reset), 이전, 페이지 직접 입력, 다음.
 * - 입력은 Enter / blur 시 commit, ESC 로 취소. clamp(1..total).
 */
export function FloatingPageNav({ current, total, onGoTo }: Props) {
  const [inputValue, setInputValue] = useState(String(current));

  // 외부 current 변경 시 input 도 동기화 (prev/next 클릭 / 자동 변경).
  useEffect(() => {
    setInputValue(String(current));
  }, [current]);

  if (total === 0) return null;

  const isUnbounded = !Number.isFinite(total);

  function commit() {
    const n = parseInt(inputValue, 10);
    if (!Number.isFinite(n)) {
      setInputValue(String(current));
      return;
    }
    const clamped = isUnbounded
      ? Math.max(1, n)
      : Math.max(1, Math.min(total, n));
    if (clamped !== current) onGoTo(clamped);
    setInputValue(String(clamped));
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white/90 px-2 py-1 shadow-lg backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
      <Button
        size="xs"
        variant="ghost"
        onClick={() => onGoTo(current - 1)}
        disabled={current <= 1}
        aria-label="이전"
        title="이전"
        className="rounded-full"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-1 px-1 font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
        <input
          type="number"
          min={1}
          max={isUnbounded ? undefined : total}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setInputValue(String(current));
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={commit}
          aria-label="페이지 번호"
          className="w-10 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-center text-xs tabular-nums outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {!isUnbounded && (
          <>
            <span>/</span>
            <span>{total}</span>
          </>
        )}
      </div>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => onGoTo(current + 1)}
        disabled={!isUnbounded && current >= total}
        aria-label="다음"
        title="다음"
        className="rounded-full"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => onGoTo(1)}
        disabled={current <= 1}
        aria-label="처음으로"
        title="처음으로 (Reset)"
        className="rounded-full"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
