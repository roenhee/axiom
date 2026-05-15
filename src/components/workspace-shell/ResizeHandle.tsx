"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** 마우스 이동 dx (오른쪽 = +). 호출 측에서 좌/우 패널의 width 에 어떻게 더할지 결정. */
  onDelta: (delta: number) => void;
}

/**
 * 두 패널 사이에 끼우는 4px 폭 drag handle.
 * mousedown → 매 mousemove 마다 clientX 변화량을 onDelta 로 흘려보냄 → mouseup 종료.
 * 드래그 중엔 body cursor 와 user-select 를 잠가서 텍스트 선택/포커스 깜빡임 방지.
 */
export function ResizeHandle({ onDelta }: Props) {
  const [dragging, setDragging] = useState(false);
  const lastXRef = useRef(0);

  useEffect(() => {
    if (!dragging) return;

    function onMove(e: MouseEvent) {
      const delta = e.clientX - lastXRef.current;
      lastXRef.current = e.clientX;
      if (delta !== 0) onDelta(delta);
    }
    function onUp() {
      setDragging(false);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, onDelta]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(e) => {
        e.preventDefault();
        lastXRef.current = e.clientX;
        setDragging(true);
      }}
      className={cn(
        "group relative w-1 shrink-0 cursor-col-resize transition-colors",
        dragging ? "bg-blue-400/60" : "hover:bg-blue-400/40",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",
          dragging
            ? "bg-transparent"
            : "bg-zinc-200 group-hover:bg-transparent dark:bg-zinc-800",
        )}
      />
    </div>
  );
}
