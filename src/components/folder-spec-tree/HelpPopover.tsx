"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HelpCircle,
  Layers,
  Sparkles,
  Component as ComponentIcon,
  PanelTop,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocTypeEntry {
  Icon: LucideIcon;
  label: string;
  iconColor: string;
  description: string;
}

const DOC_TYPES: DocTypeEntry[] = [
  {
    Icon: Layers,
    label: "Feature Group / Epic",
    iconColor: "text-purple-600 dark:text-purple-300",
    description: "여러 Feature 를 묶는 상위 단위. 문제 정의 · 목표 · 전체 흐름 · 공통 정책 · 릴리즈 범위. 직접 목업으로 이어지지 않고 하위 Feature 로 분해.",
  },
  {
    Icon: Sparkles,
    label: "Feature",
    iconColor: "text-blue-600 dark:text-blue-300",
    description: "기능 한 개의 명세. 목적 · 사용자 시나리오 · 정책 · 포함되는 Component / Tab / State.",
  },
  {
    Icon: ComponentIcon,
    label: "Component",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    description: "UI 컴포넌트 한 개의 동작. 입력/출력 · 상태값 · 인터랙션 · validation · error/empty/loading.",
  },
  {
    Icon: PanelTop,
    label: "Tab",
    iconColor: "text-amber-600 dark:text-amber-300",
    description: "탭 또는 화면 내 주요 구간. 탭 내 Slot 구성 · 노출 조건 · 탭 전환 동작.",
  },
  {
    Icon: Activity,
    label: "State",
    iconColor: "text-zinc-500 dark:text-zinc-400",
    description: "특정 상태 (loading, empty, error, validation 실패, 권한 없음, 네트워크 실패 등). Scenario-based prototype 에서 중요.",
  },
];

const POPOVER_WIDTH = 320;

/**
 * 트리 헤더 옆 ? 아이콘. 클릭 시 5 개 문서 타입 설명 popover.
 * 좌측 트리 aside 의 overflow-hidden 에 갇히지 않도록 body 에 portal 로 렌더.
 * outside-click / Esc 로 닫힘. window resize 시 위치 재계산.
 */
export function HelpPopover() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // 위치 계산 — 트리거 아래 + 6px.
  function recomputePosition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, left: rect.left });
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onResize() {
      recomputePosition();
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
    if (!open) recomputePosition();
    setOpen((o) => !o);
  }

  const popoverContent =
    open && position && mounted ? (
      <div
        ref={popoverRef}
        role="dialog"
        className="fixed z-50 rounded-md border border-zinc-200 bg-white p-3 shadow-md dark:border-zinc-800 dark:bg-zinc-900"
        style={{
          top: position.top,
          left: position.left,
          width: POPOVER_WIDTH,
        }}
      >
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          문서 타입
        </div>
        <dl className="space-y-2.5">
          {DOC_TYPES.map(({ Icon, label, iconColor, description }) => (
            <div key={label}>
              <dt className="flex items-center gap-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
                {label}
              </dt>
              <dd className="mt-0.5 pl-5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
        aria-label="문서 타입 도움말"
        title="문서 타입 도움말"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {popoverContent && mounted && createPortal(popoverContent, document.body)}
    </>
  );
}
