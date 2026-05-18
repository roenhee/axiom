"use client";

import { FileText } from "lucide-react";
import { SPEC_TEMPLATES, type SpecTemplate } from "@/lib/spec-templates";

interface Props {
  onSelect: (template: SpecTemplate) => void;
}

/**
 * 빈 spec 본문일 때 편집 영역에 떠서 템플릿을 고를 수 있게 하는 picker (D-041).
 * 사용자가 본문을 다 지우면 다시 노출됨.
 */
export function TemplatePicker({ onSelect }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 p-5 text-center">
      <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
        <FileText className="h-4 w-4" />
        <h3 className="text-sm font-semibold">
          빈 문서 — 템플릿으로 시작할까요?
        </h3>
      </div>
      <p className="max-w-xs text-xs text-zinc-500">
        템플릿을 골라 삽입하거나 그냥 빈 상태로 두고 직접 작성해도 됩니다.
        본문을 비우면 이 선택지가 다시 나타납니다.
      </p>
      <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
        {SPEC_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => onSelect(tmpl)}
            className="rounded-md border border-zinc-200 bg-white p-3 text-left transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {tmpl.name}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {tmpl.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
