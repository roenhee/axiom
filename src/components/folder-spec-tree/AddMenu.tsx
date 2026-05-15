"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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

interface Props {
  items: AddMenuEntry[];
  trigger: ReactNode;
  /** 메뉴 정렬 — 트리거 기준. 좌측 트리에선 right 가 자연스러움. */
  align?: "left" | "right";
}

/**
 * 폴더/Spec 추가 메뉴. 트리거 클릭 → dropdown.
 * outside-click / Esc 로 닫힘. 작은 자체 구현이라 외부 deps 없음.
 */
export function AddMenu({ items, trigger, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="contents"
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-md border border-zinc-200 bg-white py-1 text-xs shadow-md dark:border-zinc-800 dark:bg-zinc-900",
            align === "left" ? "left-0" : "right-0",
          )}
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
      )}
    </div>
  );
}
