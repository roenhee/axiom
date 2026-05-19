"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { DesignFramePane } from "./DesignFramePane";

type ViewKey = "design" | "slot" | "full";

const VIEWS: { key: ViewKey; label: string; phase: string }[] = [
  { key: "design", label: "디자인 프레임", phase: "Phase 2" },
  { key: "slot", label: "슬롯 목업", phase: "Phase 3" },
  { key: "full", label: "전체 목업", phase: "Phase 3" },
];

/**
 * 가운데 패널 (D-020). 세 가지 렌더링 뷰의 컨테이너.
 *
 * - 디자인 프레임: Spec 에 연결된 Figma frame embed (Phase 2 — 구현됨, D-047).
 * - 슬롯 목업: 선택된 Slot 의 working mock (Phase 3 에서 채워짐).
 * - 전체 목업: Surface 를 합성한 mock (Phase 3 에서 채워짐).
 *
 * Spec id 는 URL 의 [id] params 로부터 client side 로 추출.
 * /projects/[slug]/settings 같이 spec id 가 없는 경로에서는 null.
 */
export function CenterPane() {
  const params = useParams();
  const specId = typeof params?.id === "string" ? params.id : null;
  const [view, setView] = useState<ViewKey>("design");
  const current = VIEWS.find((v) => v.key === view)!;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition",
              view === v.key
                ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800",
            )}
          >
            {v.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-400">
          {current.phase}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        {view === "design" && <DesignFramePane specId={specId} />}
        {view !== "design" && (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-sm space-y-2 text-center">
              <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                {current.label}
              </div>
              <p className="text-xs text-zinc-500">
                {current.phase} 에서 채워집니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
