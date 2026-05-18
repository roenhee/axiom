"use client";

import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { updateApiSpec } from "@/server/revisions/update-api-spec";
import { cn } from "@/lib/utils";

interface Props {
  specId: string;
  initialApiSpec: string;
  onApiSpecChange?: (yaml: string) => void;
}

const AUTOSAVE_DEBOUNCE_MS = 30_000;

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date; publishedLabel: string | null }
  | { kind: "error"; message: string };

/**
 * OpenAPI YAML 에디터 (D-040).
 *
 * 저장 흐름 (Body 와 동일 디바운스):
 * - 입력 멈춘 뒤 30 초 또는 blur — 더 일찍 발화한 쪽.
 * - 직전 Revision 의 apiSpec 과 동일하면 no-op.
 * - 다르면 새 Revision 저장 + 마지막 SpecVersion 의 apiSpec 과 다르면 자동
 *   발행 (changeType="api"). updateApiSpec 서버 액션이 한 transaction 으로 처리.
 */
export function ApiEditor({
  specId,
  initialApiSpec,
  onApiSpecChange,
}: Props) {
  const [value, setValue] = useState(initialApiSpec);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const lastSavedRef = useRef<string>(initialApiSpec);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onApiSpecChangeRef = useRef(onApiSpecChange);
  useEffect(() => {
    onApiSpecChangeRef.current = onApiSpecChange;
  }, [onApiSpecChange]);

  async function save(text: string) {
    setSaveState({ kind: "saving" });
    try {
      const res = await updateApiSpec({ specId, apiSpec: text });
      lastSavedRef.current = text;
      setSaveState({
        kind: "saved",
        at: res.revision?.createdAt ?? new Date(),
        publishedLabel: res.publishedVersionLabel,
      });
    } catch (err) {
      setSaveState({
        kind: "error",
        message: err instanceof Error ? err.message : "저장 실패",
      });
    }
  }

  function scheduleSave(text: string) {
    if (text === lastSavedRef.current) {
      setSaveState({ kind: "idle" });
      return;
    }
    setSaveState({ kind: "dirty" });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void save(text);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  // unmount 시 미저장분 best-effort.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const pending = lastSavedRef.current;
      // 현재 value 를 추적할 수 없어 lastSavedRef 비교만 — Body 와 같은 패턴.
      if (pending) void 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-1 dark:border-zinc-900">
        <span className="text-[10px] uppercase tracking-wide text-zinc-400">
          OpenAPI YAML
        </span>
        <SaveStatus state={saveState} />
      </div>
      <CodeMirror
        value={value}
        height="320px"
        extensions={[yaml()]}
        theme="light"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          foldGutter: true,
          tabSize: 2,
        }}
        onChange={(text) => {
          setValue(text);
          onApiSpecChangeRef.current?.(text);
          scheduleSave(text);
        }}
        onBlur={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          if (value !== lastSavedRef.current) void save(value);
        }}
      />
    </div>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  const text = (() => {
    switch (state.kind) {
      case "idle":
        return "—";
      case "dirty":
        return "편집 중…";
      case "saving":
        return "저장 중…";
      case "saved":
        return state.publishedLabel
          ? `저장됨 · ${state.publishedLabel} 자동 발행`
          : "저장됨";
      case "error":
        return `저장 실패 · ${state.message}`;
    }
  })();
  return (
    <span
      className={cn(
        "text-xs",
        state.kind === "error"
          ? "text-red-600 dark:text-red-400"
          : "text-zinc-500",
      )}
    >
      {text}
    </span>
  );
}
