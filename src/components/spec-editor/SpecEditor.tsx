"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

interface MarkdownStorage {
  getMarkdown: () => string;
}

function readMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as { markdown?: MarkdownStorage };
  return storage.markdown?.getMarkdown() ?? "";
}
import { useEffect, useRef, useState } from "react";
import { createRevision } from "@/server/revisions/create-revision";
import { cn } from "@/lib/utils";

interface Props {
  specId: string;
  initialMarkdown: string;
}

const AUTOSAVE_DEBOUNCE_MS = 30_000;

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

/**
 * Tiptap 기반 Markdown 에디터.
 *
 * 자동저장 트리거 (D-018):
 * - 입력 멈춘 뒤 30 초 (debounce)
 * - 또는 에디터 blur — 둘 중 먼저.
 *
 * createRevision 이 직전 markdown 과 동일하면 row 안 만듦 (서버에서 중복 차단).
 */
export function SpecEditor({ specId, initialMarkdown }: Props) {
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const lastSavedRef = useRef<string>(initialMarkdown);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false,
        linkify: true,
        breaks: false,
        transformPastedText: true,
      }),
    ],
    content: initialMarkdown,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[300px] focus:outline-none px-5 py-4",
      },
    },
    onUpdate({ editor }) {
      const md = readMarkdown(editor);
      if (md === lastSavedRef.current) return;
      setSaveState({ kind: "dirty" });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void save(md);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    onBlur({ editor }) {
      const md = readMarkdown(editor);
      if (md === lastSavedRef.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void save(md);
    },
  });

  async function save(markdown: string) {
    setSaveState({ kind: "saving" });
    try {
      const rev = await createRevision({ specId, markdown });
      lastSavedRef.current = markdown;
      // rev === null 이면 직전과 동일 — 그래도 "저장됨" 으로 표시 (사용자 입장에선 동일)
      setSaveState({ kind: "saved", at: rev?.createdAt ?? new Date() });
    } catch (err) {
      setSaveState({
        kind: "error",
        message: err instanceof Error ? err.message : "저장 실패",
      });
    }
  }

  // 페이지 떠나기 전 마지막 저장 시도 — 입력 직후 닫는 케이스
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const md = editor ? readMarkdown(editor) : undefined;
      if (md !== undefined && md !== lastSavedRef.current) {
        // best-effort. server action 호출은 unmount 중에 await 불가능하지만
        // Promise 는 자체적으로 실행됨.
        void createRevision({ specId, markdown: md }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          본문
        </h2>
        <SaveStatus state={saveState} />
      </div>
      <EditorContent editor={editor} />
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
        return `저장됨 · ${state.at.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`;
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
