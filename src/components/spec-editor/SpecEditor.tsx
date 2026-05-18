"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Link } from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Image as TiptapImage } from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Code2,
  Link as LinkIcon,
  Table as TableIcon,
  Minus,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRevision } from "@/server/revisions/create-revision";
import { cn } from "@/lib/utils";
import { TemplatePicker } from "./TemplatePicker";
import type { SpecTemplate } from "@/lib/spec-templates";

interface MarkdownStorage {
  getMarkdown: () => string;
}

function readMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as { markdown?: MarkdownStorage };
  return storage.markdown?.getMarkdown() ?? "";
}

interface Props {
  specId: string;
  /** 이미지 업로드 시 /api/attachments 의 projectId 필드로 사용. */
  projectId: string;
  initialMarkdown: string;
  /** 매 입력마다 현재 markdown 전달. Preview 모드에서 같은 본문을 보여줄 때 쓰임. */
  onMarkdownChange?: (md: string) => void;
}

const AUTOSAVE_DEBOUNCE_MS = 30_000;

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

/**
 * Tiptap 기반 Markdown 에디터 + 툴바 (D-037).
 *
 * 저장 트리거 (D-018):
 * - 입력 멈춘 뒤 30 초 (debounce)
 * - 또는 에디터 blur — 둘 중 먼저.
 *
 * 툴바: 필수 양식 (제목/굵게/기울임/취소선/목록/인용/코드/링크) + 옵션 1 (표/체크리스트/구분선).
 * MD 직렬화는 tiptap-markdown 이 담당 — 출력 .md 는 react-markdown 으로도 동일 렌더.
 */
export function SpecEditor({
  specId,
  projectId,
  initialMarkdown,
  onMarkdownChange,
}: Props) {
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [isEmpty, setIsEmpty] = useState(() => initialMarkdown.trim() === "");
  const lastSavedRef = useRef<string>(initialMarkdown);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMarkdownChangeRef = useRef(onMarkdownChange);
  useEffect(() => {
    onMarkdownChangeRef.current = onMarkdownChange;
  }, [onMarkdownChange]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false,
        linkify: true,
        breaks: false,
        transformPastedText: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TiptapImage.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "tiptap-image" },
      }),
      TaskList.configure({
        HTMLAttributes: { class: "tiptap-task-list" },
      }),
      // @tiptap/extension-list v3 의 TaskItem 은 NodeView 로 li 를 만들며
      // renderHTML 의 data-type 을 적용하지 않음. class 와 data-type 둘 다
      // HTMLAttributes 로 명시 주입 — CSS 셀렉터 매칭 보장.
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "tiptap-task-item",
          "data-type": "taskItem",
        },
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
      onMarkdownChangeRef.current?.(md);
      setIsEmpty(editor.isEmpty);
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
        void createRevision({ specId, markdown: md }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTemplate(template: SpecTemplate) {
    if (!editor) return;
    // emitUpdate: true → onUpdate 발화 → autosave 큐 + onMarkdownChange 알림.
    editor.commands.setContent(template.markdown, { emitUpdate: true });
    editor.commands.focus("end");
  }

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <Toolbar editor={editor} projectId={projectId} />
      <div className="flex items-center justify-end border-b border-zinc-100 px-3 py-1 dark:border-zinc-900">
        <SaveStatus state={saveState} />
      </div>
      <div className="relative">
        <EditorContent editor={editor} />
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5">
            <div className="pointer-events-auto w-full max-w-lg">
              <TemplatePicker onSelect={applyTemplate} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Toolbar
// ============================================================

function Toolbar({
  editor,
  projectId,
}: {
  editor: Editor | null;
  projectId: string;
}) {
  if (!editor) {
    return (
      <div className="h-9 border-b border-zinc-100 dark:border-zinc-900" />
    );
  }

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL", prev ?? "");
    if (url === null) return; // 취소
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div
      role="toolbar"
      aria-label="서식"
      className="flex flex-wrap items-center gap-0.5 border-b border-zinc-100 px-2 py-1 dark:border-zinc-900"
    >
      <ToolbarButton
        icon={Heading1}
        title="제목 1"
        isActive={editor.isActive("heading", { level: 1 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
      />
      <ToolbarButton
        icon={Heading2}
        title="제목 2"
        isActive={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      />
      <ToolbarButton
        icon={Heading3}
        title="제목 3"
        isActive={editor.isActive("heading", { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={Bold}
        title="굵게  (Ctrl+B)"
        isActive={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        title="기울임  (Ctrl+I)"
        isActive={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        title="취소선"
        isActive={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={List}
        title="글머리 목록"
        isActive={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrdered}
        title="번호 목록"
        isActive={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={ListChecks}
        title="체크리스트"
        isActive={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={Quote}
        title="인용"
        isActive={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={Code}
        title="인라인 코드"
        isActive={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolbarButton
        icon={Code2}
        title="코드 블록"
        isActive={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={LinkIcon}
        title="링크"
        isActive={editor.isActive("link")}
        onClick={setLink}
      />
      <ImageUploadButton editor={editor} projectId={projectId} />
      <TablePicker editor={editor} />
      <ToolbarButton
        icon={Minus}
        title="구분선"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  title,
  isActive,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  isActive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
        isActive &&
          "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function ToolbarDivider() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-800"
    />
  );
}

// ============================================================
// ImageUploadButton — 파일 선택 → /api/attachments 업로드 → ![alt](url) 삽입
// ============================================================

function ImageUploadButton({
  editor,
  projectId,
}: {
  editor: Editor;
  projectId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("projectId", projectId);
      const res = await fetch("/api/attachments", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `업로드 실패 (${res.status})`);
      }
      const data = (await res.json()) as { attachment: { id: string } };
      const url = `/api/attachments/${data.attachment.id}?inline=1`;
      editor
        .chain()
        .focus()
        .setImage({ src: url, alt: file.name })
        .createParagraphNear()
        .run();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <ToolbarButton
        icon={ImageIcon}
        title={uploading ? "업로드 중…" : "이미지 업로드"}
        onClick={() => fileInputRef.current?.click()}
      />
    </>
  );
}

// ============================================================
// TablePicker — 8×8 그리드에서 호버로 크기 선택, 클릭으로 삽입
// ============================================================

const TABLE_PICKER_MAX = 8;

function TablePicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [hover, setHover] = useState<{ r: number; c: number }>({ r: -1, c: -1 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  function recompute() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (
        !triggerRef.current?.contains(t) &&
        !popoverRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleToggle() {
    if (!open) {
      recompute();
      setHover({ r: -1, c: -1 });
    }
    setOpen((o) => !o);
  }

  function pick(r: number, c: number) {
    // Tiptap 네이티브 insertTable 사용 (HTML 문자열은 Markdown.configure({html:false})
    // 로 escape 되어 텍스트로 들어감 — 그래서 안 됨).
    // 표 삽입 후 prosemirror selection 으로 table 노드 위치를 찾고, 그 바로 뒤에
    // 빈 paragraph 가 없으면 하나 삽입 — 표 다음 줄 편집 가능하게.
    editor
      .chain()
      .focus()
      .insertTable({ rows: r + 1, cols: c + 1, withHeaderRow: true })
      .run();

    const { state } = editor;
    const { $from } = state.selection;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === "table") {
        const afterPos = $from.after(d);
        // 표가 doc 의 마지막 노드면 자동으로 doc 끝에 paragraph 가 붙음 — 안전하게
        // afterPos < docSize 일 때만 nodeAfter 확인.
        const docSize = state.doc.content.size;
        const next =
          afterPos < docSize ? state.doc.resolve(afterPos).nodeAfter : null;
        if (!next || next.type.name !== "paragraph") {
          editor.commands.insertContentAt(afterPos, { type: "paragraph" });
        }
        break;
      }
    }
    setOpen(false);
  }

  const rows = Array.from({ length: TABLE_PICKER_MAX });
  const cols = Array.from({ length: TABLE_PICKER_MAX });
  const dims =
    hover.r >= 0 && hover.c >= 0
      ? `${hover.r + 1} × ${hover.c + 1}`
      : "크기 선택";

  const popoverContent =
    open && position && mounted ? (
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="표 크기 선택"
        className="fixed z-50 rounded-md border border-zinc-200 bg-white p-3 shadow-md dark:border-zinc-800 dark:bg-zinc-900"
        style={{ top: position.top, left: position.left }}
        onMouseLeave={() => setHover({ r: -1, c: -1 })}
      >
        <div className="grid grid-cols-8 gap-0.5">
          {rows.map((_, r) =>
            cols.map((_, c) => {
              const active = r <= hover.r && c <= hover.c;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onMouseEnter={() => setHover({ r, c })}
                  onClick={() => pick(r, c)}
                  className={cn(
                    "h-4 w-4 rounded-sm border transition-colors",
                    active
                      ? "border-blue-500 bg-blue-100 dark:border-blue-400 dark:bg-blue-950/60"
                      : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800",
                  )}
                  aria-label={`${r + 1} 행 ${c + 1} 열`}
                />
              );
            }),
          )}
        </div>
        <div className="mt-2 text-center text-[11px] text-zinc-500">{dims}</div>
      </div>
    ) : null;

  return (
    <div ref={triggerRef} className="relative inline-flex">
      <ToolbarButton
        icon={TableIcon}
        title="표 삽입"
        isActive={open || editor.isActive("table")}
        onClick={handleToggle}
      />
      {popoverContent && createPortal(popoverContent, document.body)}
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
