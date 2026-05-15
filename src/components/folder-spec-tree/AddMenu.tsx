"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type AddMenuEntry =
  | {
      kind: "item";
      label: string;
      description?: string;
      onSelect: () => void;
      icon?: ReactNode;
    }
  | { kind: "divider" };

interface Props {
  items: AddMenuEntry[];
  trigger: ReactNode;
}

const POPOVER_MIN_WIDTH = 160;
const POPOVER_GAP = 4;

/**
 * 폴더/Spec 행에서 사용하는 dropdown 메뉴 (추가 / 더보기 등).
 * 트리거 클릭 → body 에 portal 로 렌더. 위치는 항상 트리거의 오른쪽 아래
 * (left = trigger.left, top = trigger.bottom + GAP).
 * outside-click(mousedown) / Escape / scroll / resize 시 위치 재계산 또는 닫힘.
 *
 * 좌측 트리 aside 가 overflow-hidden 이라 absolute popover 가 잘리는 문제를
 * portal 로 회피. align prop 은 두지 않음 — 위치 일관성을 강제.
 */
export function AddMenu({ items, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const triggerWrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  function recompute() {
    if (!triggerWrapperRef.current) return;
    const rect = triggerWrapperRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + POPOVER_GAP, left: rect.left });
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
          top: position.top,
          left: position.left,
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
    <div ref={triggerWrapperRef} className="relative inline-flex">
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
