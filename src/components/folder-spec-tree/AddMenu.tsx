"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type AddMenuEntry =
  | {
      kind: "item";
      label: string;
      description?: string;
      onSelect: () => void;
      icon?: ReactNode;
    }
  | { kind: "divider" };

/**
 * - "anchor": 트리거 바로 아래-왼쪽 정렬 (기본).
 * - "anchor-corner": 트리거의 우하단 모서리 기준 — popover top-left 가 trigger
 *   bottom-right 에 붙어 오른쪽-아래로 펼쳐짐. 트리거가 뷰포트 하반부에 있으면
 *   popover bottom-left 가 trigger top-right 에 붙어 오른쪽-위로 펼쳐짐.
 */
export type AddMenuPlacement = "anchor" | "anchor-corner";

interface Props {
  items: AddMenuEntry[];
  trigger: ReactNode;
  placement?: AddMenuPlacement;
  /** trigger wrapper layout. 기본은 inline-flex(content 너비). full-row 클릭 영역이
   * 필요하면 "block" 전달 → 부모 너비를 다 차지함. */
  triggerLayout?: "inline" | "block";
}

const POPOVER_MIN_WIDTH = 160;
const POPOVER_GAP = 4;
/** anchor-corner 에서 아래/위 결정 임계 — 팝업 하단이 뷰포트 하단 - 이 값 이내로
 * 들어오는 동안엔 계속 아래로 펼침. 넘어가면 위로 전환. */
const VIEWPORT_BOTTOM_MARGIN = 48;
/** 첫 렌더 시점에 실제 popover 높이를 모르므로 estimate. 5~6 항목 기준. */
const ESTIMATED_POPOVER_HEIGHT = 200;

type Position =
  | { top: number; left: number }
  | { bottom: number; left: number };

/**
 * 폴더/Spec 행에서 사용하는 dropdown 메뉴 (추가 / 더보기 등).
 * 트리거 클릭 → body 에 portal 로 렌더.
 * outside-click(mousedown) / Escape / scroll / resize 시 위치 재계산 또는 닫힘.
 *
 * 좌측 트리 aside 가 overflow-hidden 이라 absolute popover 가 잘리는 문제를
 * portal 로 회피.
 */
export function AddMenu({
  items,
  trigger,
  placement = "anchor",
  triggerLayout = "inline",
}: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerWrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  function recompute() {
    if (!triggerWrapperRef.current) return;
    // 트리거 내부에 [data-popover-anchor] 요소가 있으면 그 요소 기준으로 위치 계산.
    // 없으면 wrapper 자체 기준.
    const anchorEl =
      triggerWrapperRef.current.querySelector<HTMLElement>(
        "[data-popover-anchor]",
      ) ?? triggerWrapperRef.current;
    const rect = anchorEl.getBoundingClientRect();
    if (placement === "anchor-corner") {
      // 트리거 우하단 모서리 기준. 아래로 펼친 popover 의 추정 bottom 이
      // 뷰포트 하단 - VIEWPORT_BOTTOM_MARGIN 을 넘으면 위로 전환 — 그 전엔
      // 항상 아래로. 첫 측정엔 ESTIMATED_POPOVER_HEIGHT, 그 다음 effect 에서
      // 실측치로 재계산.
      const downBottom =
        rect.bottom + POPOVER_GAP + ESTIMATED_POPOVER_HEIGHT;
      if (downBottom > window.innerHeight - VIEWPORT_BOTTOM_MARGIN) {
        setPosition({
          bottom: window.innerHeight - rect.top + POPOVER_GAP,
          left: rect.right + POPOVER_GAP,
        });
      } else {
        setPosition({
          top: rect.bottom + POPOVER_GAP,
          left: rect.right + POPOVER_GAP,
        });
      }
    } else {
      setPosition({ top: rect.bottom + POPOVER_GAP, left: rect.left });
    }
  }

  useEffect(() => {
    if (!open) return;

    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (
        !triggerWrapperRef.current?.contains(t) &&
        !popoverRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onResize() {
      recompute();
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open]);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open) recompute();
    setOpen((o) => !o);
  }

  const popoverContent =
    open && position && mounted ? (
      <div
        ref={popoverRef}
        role="menu"
        className="fixed z-50 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 text-xs shadow-md dark:border-zinc-800 dark:bg-zinc-900"
        style={{
          ...position,
          minWidth: POPOVER_MIN_WIDTH,
        }}
      >
        {items.map((item, i) => {
          if (item.kind === "divider") {
            return (
              <div
                key={`d-${i}`}
                role="separator"
                className="my-1 border-t border-zinc-100 dark:border-zinc-800"
              />
            );
          }
          return (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {item.icon && (
                <span className="shrink-0 text-zinc-400">{item.icon}</span>
              )}
              <div className="flex-1">
                <div className="text-zinc-900 dark:text-zinc-100">
                  {item.label}
                </div>
                {item.description && (
                  <div className="text-[10px] text-zinc-500">
                    {item.description}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div
      ref={triggerWrapperRef}
      className={cn(
        "relative",
        triggerLayout === "block" ? "block w-full" : "inline-flex",
      )}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="contents"
      >
        {trigger}
      </button>
      {popoverContent && mounted && createPortal(popoverContent, document.body)}
    </div>
  );
}
