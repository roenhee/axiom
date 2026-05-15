"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type ViewKey = "full" | "slot" | "design";

const VIEWS: { key: ViewKey; label: string; phase: string; description: string }[] = [
  {
    key: "full",
    label: "전체 목업",
    phase: "Phase 3",
    description:
      "Surface 전체를 합성한 working mock. Slot Registry 가 들어오면 채워집니다.",
  },
  {
    key: "slot",
    label: "슬롯 목업",
    phase: "Phase 3",
    description:
      "선택된 Slot 한 개의 동작 가능한 mock. AI 가 만든 patch 의 preview 가 여기에 표시됩니다.",
  },
  {
    key: "design",
    label: "디자인 프레임",
    phase: "Phase 2",
    description:
      "Spec 에 연결된 Figma frame embed. URL 을 paste 하면 좌/우 Compare 로 볼 수 있게 됩니다.",
  },
];

export function CenterPane() {
  const [view, setView] = useState<ViewKey>("full");
  const current = VIEWS.find((v) => v.key === view)!;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
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

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-sm space-y-2 text-center">
          <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            {current.label}
          </div>
          <p className="text-xs text-zinc-500">{current.description}</p>
          <p className="text-[10px] text-zinc-400">
            {current.phase} 에서 채워집니다.
          </p>
        </div>
      </div>
    </div>
  );
}
