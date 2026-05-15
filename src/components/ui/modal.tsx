"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** width preset. 기본 md. */
  size?: "sm" | "md" | "lg";
}

/**
 * 최소 Modal. backdrop click / Esc 로 닫힘. 외부 deps 없음.
 *
 * 사용:
 *   <Modal open={open} onClose={close} title="제목">
 *     <div className="p-5">...본문...</div>
 *   </Modal>
 *
 * 본문 안 padding 은 호출 측에서 — 폼 / 단순 텍스트 따라 다르게.
 */
export function Modal({ open, onClose, children, title, size = "md" }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "w-full overflow-hidden rounded-lg bg-white shadow-xl dark:bg-zinc-900",
          size === "sm" && "max-w-sm",
          size === "md" && "max-w-md",
          size === "lg" && "max-w-2xl",
        )}
      >
        {title && (
          <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
