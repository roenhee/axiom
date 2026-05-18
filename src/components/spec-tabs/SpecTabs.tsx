"use client";

import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";
import { SpecEditor } from "@/components/spec-editor/SpecEditor";
import { MarkdownView } from "@/components/markdown/MarkdownView";
import { ApiEditor } from "@/components/api-editor/ApiEditor";
// Swagger UI 와 그 CSS 는 SSR 단계에서 window 참조 → ssr:false 로 client-only.
const ApiSwaggerView = dynamic(
  () =>
    import("@/components/api-editor/ApiSwaggerView").then((m) => ({
      default: m.ApiSwaggerView,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-md border border-zinc-200 px-4 py-10 text-center text-xs text-zinc-500 dark:border-zinc-800">
        Swagger UI 로딩 중…
      </div>
    ),
  },
);
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { updateSpec } from "@/server/specs/update-spec";
import { deleteSpec } from "@/server/specs/delete-spec";
import { publishSpecVersion } from "@/server/spec-versions/publish-spec-version";
import { archiveSpecVersion } from "@/server/spec-versions/archive-spec-version";
import { getSpecVersionMarkdown } from "@/server/spec-versions/get-spec-version-markdown";
import { createSpecRelation } from "@/server/spec-relations/create-spec-relation";
import { deleteSpecRelation } from "@/server/spec-relations/delete-spec-relation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SpecType, SpecRelationType, SpecStatus } from "@/generated/prisma/enums";
import type { FolderNode } from "@/server/folders/list-folders";
import type { SpecRelations } from "@/server/spec-relations/list-spec-relations";

interface VersionItem {
  id: string;
  versionLabel: string;
  status: SpecStatus;
  changeSummary: string | null;
  changeType: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  createdBy: { name: string | null; email: string };
}

interface OtherSpec {
  id: string;
  title: string;
  type: SpecType;
}

interface SpecData {
  id: string;
  projectId: string;
  title: string;
  type: SpecType;
  folderId: string | null;
}

interface Props {
  spec: SpecData;
  initialMarkdown: string;
  initialApiSpec: string;
  folders: FolderNode[];
  versions: VersionItem[];
  nextLabel: string;
  relations: SpecRelations;
  otherSpecs: OtherSpec[];
}

type TabKey = "body" | "api" | "relations" | "history";

const TABS: { key: TabKey; label: string }[] = [
  { key: "body", label: "본문" },
  { key: "api", label: "API" },
  { key: "relations", label: "관계" },
  { key: "history", label: "히스토리" },
];

const CHANGE_TYPE_OPTIONS = [
  { value: "", label: "(미지정)" },
  { value: "feature", label: "feature — 새 기능" },
  { value: "fix", label: "fix — 오류 수정" },
  { value: "refactor", label: "refactor — 재구성" },
  { value: "docs", label: "docs — 문서/설명" },
  { value: "breaking", label: "breaking — 호환 깨짐" },
  { value: "chore", label: "chore — 기타" },
];

const TYPE_OPTIONS: { value: keyof typeof SpecTypeStrict; label: string }[] = [
  { value: "FeatureGroup", label: "Feature Group" },
  { value: "Feature", label: "Feature" },
  { value: "Component", label: "Component" },
  { value: "State", label: "State" },
];

// 컴파일 안정성을 위한 enum-like 상수
const SpecTypeStrict = {
  FeatureGroup: "FeatureGroup",
  Feature: "Feature",
  Component: "Component",
  State: "State",
} as const;

const TYPE_TONE: Record<SpecType, string> = {
  FeatureGroup:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  Feature: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  Component:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  State: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};

const RELATION_TYPE_OPTIONS: { value: SpecRelationType; label: string }[] = [
  { value: "contains" as SpecRelationType, label: "포함" },
  { value: "depends_on" as SpecRelationType, label: "의존" },
  { value: "related_component" as SpecRelationType, label: "관련 컴포넌트" },
];

const RELATION_LABEL: Record<string, string> = {
  contains: "포함",
  depends_on: "의존",
  related_component: "관련 컴포넌트",
  related_slot: "관련 Slot",
  related_figma: "관련 Figma",
  related_prototype_route: "관련 Prototype 경로",
  related_ai_task: "관련 AI Task",
};

const VERSION_STATUS_TONE: Record<SpecStatus, string> = {
  Published:
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  Draft:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  Archived:
    "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function SpecTabs({
  spec,
  initialMarkdown,
  initialApiSpec,
  folders,
  versions,
  nextLabel,
  relations,
  otherSpecs,
}: Props) {
  const [active, setActive] = useState<TabKey>("body");

  return (
    <div className="flex h-full flex-col">
      <SpecHeader spec={spec} folders={folders} />

      <div className="flex shrink-0 gap-1 border-b border-zinc-200 px-3 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={cn(
              "border-b-2 px-3 py-2 text-xs font-medium transition",
              active === t.key
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
            )}
          >
            {t.label}
            {t.key === "history" && versions.length > 0 && (
              <span className="ml-1 text-[10px] text-zinc-400">
                {versions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {active === "body" && (
          <BodyTab
            specId={spec.id}
            projectId={spec.projectId}
            initialMarkdown={initialMarkdown}
          />
        )}
        {active === "api" && (
          <ApiTab specId={spec.id} initialApiSpec={initialApiSpec} />
        )}
        {active === "relations" && (
          <RelationsTab specId={spec.id} relations={relations} otherSpecs={otherSpecs} />
        )}
        {active === "history" && (
          <HistoryTab
            specId={spec.id}
            versions={versions}
            nextLabel={nextLabel}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Header
// ============================================================

function SpecHeader({ spec, folders }: { spec: SpecData; folders: FolderNode[] }) {
  const folder = spec.folderId
    ? folders.find((f) => f.id === spec.folderId)
    : null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirmDelete() {
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        await deleteSpec(spec.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  return (
    <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                TYPE_TONE[spec.type],
              )}
            >
              {spec.type}
            </span>
            {folder && (
              <span className="text-[10px] text-zinc-400">📁 {folder.name}</span>
            )}
          </div>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {spec.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            disabled={pending}
            title="메타 편집 (제목 / 타입 / 폴더)"
            aria-label="메타 편집"
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
            title="이 Spec 삭제"
            aria-label="이 Spec 삭제"
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="이 Spec 을 삭제할까요?"
        message={
          <>
            <strong>{spec.title}</strong> 그리고 연결된 Version / Revision /
            관계 정보가 영구 삭제됩니다.
          </>
        }
        confirmText="삭제"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      <SpecMetaDialog
        open={editOpen}
        spec={spec}
        folders={folders}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}

// ============================================================
// SpecMetaDialog — 제목 / 타입 / 폴더 편집 모달 (구 MetaTab 대체)
// ============================================================

function SpecMetaDialog({
  open,
  spec,
  folders,
  onClose,
}: {
  open: boolean;
  spec: SpecData;
  folders: FolderNode[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", spec.id);
    startTransition(async () => {
      try {
        await updateSpec(fd);
        onClose();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "저장 실패");
      }
    });
  }

  if (!mounted || !open) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="spec-meta-dialog-title"
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative w-[min(440px,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2
          id="spec-meta-dialog-title"
          className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
        >
          메타 편집
        </h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-spec-title">제목</Label>
            <Input
              id="edit-spec-title"
              name="title"
              required
              maxLength={200}
              defaultValue={spec.title}
              disabled={pending}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-spec-type">타입</Label>
            <select
              id="edit-spec-type"
              name="type"
              required
              defaultValue={spec.type}
              disabled={pending}
              className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-spec-folder">폴더</Label>
            <select
              id="edit-spec-folder"
              name="folderId"
              defaultValue={spec.folderId ?? ""}
              disabled={pending}
              className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
            >
              <option value="">(루트)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              저장
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ============================================================
// Body tab — Edit (Tiptap) / Preview (react-markdown) 토글 (D-037)
// ============================================================

function BodyTab({
  specId,
  projectId,
  initialMarkdown,
}: {
  specId: string;
  projectId: string;
  initialMarkdown: string;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [currentMd, setCurrentMd] = useState(initialMarkdown);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-1 rounded-md border border-zinc-200 p-0.5 text-xs dark:border-zinc-800">
        <BodyModeButton
          active={mode === "preview"}
          onClick={() => setMode("preview")}
        >
          미리보기
        </BodyModeButton>
        <BodyModeButton
          active={mode === "edit"}
          onClick={() => setMode("edit")}
        >
          편집
        </BodyModeButton>
      </div>
      {/* SpecEditor 는 mode 와 관계없이 mount 유지 — Tiptap 인스턴스 재생성 회피.
          preview 일 땐 화면에서 숨김만 처리 (저장 / autosave 상태 유지). */}
      <div className={cn(mode !== "edit" && "hidden")}>
        <SpecEditor
          specId={specId}
          projectId={projectId}
          initialMarkdown={initialMarkdown}
          onMarkdownChange={setCurrentMd}
        />
      </div>
      {mode === "preview" && (
        <div className="rounded-md border border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <MarkdownView markdown={currentMd} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// API tab — Edit (CodeMirror YAML) / Preview (Swagger UI) 토글 (D-040)
// API 변경 → autosave + 자동 발행. Body 는 수동 발행 그대로.
// ============================================================

function ApiTab({
  specId,
  initialApiSpec,
}: {
  specId: string;
  initialApiSpec: string;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [currentSpec, setCurrentSpec] = useState(initialApiSpec);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-1 rounded-md border border-zinc-200 p-0.5 text-xs dark:border-zinc-800">
        <BodyModeButton
          active={mode === "preview"}
          onClick={() => setMode("preview")}
        >
          미리보기 (Swagger UI)
        </BodyModeButton>
        <BodyModeButton
          active={mode === "edit"}
          onClick={() => setMode("edit")}
        >
          편집 (YAML)
        </BodyModeButton>
      </div>
      <div className={cn(mode !== "edit" && "hidden")}>
        <ApiEditor
          specId={specId}
          initialApiSpec={initialApiSpec}
          onApiSpecChange={setCurrentSpec}
        />
      </div>
      {mode === "preview" && <ApiSwaggerView apiSpec={currentSpec} />}
    </div>
  );
}

function BodyModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded px-3 py-1 transition",
        active
          ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
      )}
    >
      {children}
    </button>
  );
}


// ============================================================
// Relations tab
// ============================================================

function RelationsTab({
  specId,
  relations,
  otherSpecs,
}: {
  specId: string;
  relations: SpecRelations;
  otherSpecs: OtherSpec[];
}) {
  const isEmpty =
    relations.outgoing.length === 0 && relations.incoming.length === 0;

  return (
    <div className="space-y-4 p-4">
      <form action={createSpecRelation} className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <input type="hidden" name="fromId" value={specId} />
        <div className="grid gap-2">
          <select
            name="type"
            required
            defaultValue="contains"
            className="flex h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {RELATION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            name="toId"
            required
            defaultValue=""
            disabled={otherSpecs.length === 0}
            className="flex h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="" disabled>
              {otherSpecs.length === 0
                ? "다른 Spec 이 없음"
                : "대상 Spec 선택"}
            </option>
            {otherSpecs.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.type}] {s.title}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={otherSpecs.length === 0}>
            관계 추가
          </Button>
        </div>
      </form>

      {isEmpty ? (
        <div className="rounded-md border border-dashed border-zinc-200 px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-700">
          아직 등록된 관계가 없습니다.
        </div>
      ) : (
        <>
          {relations.outgoing.length > 0 && (
            <RelationGroup
              title="이 Spec 으로부터 →"
              edges={relations.outgoing}
              deletable
            />
          )}
          {relations.incoming.length > 0 && (
            <RelationGroup
              title="← 이 Spec 을 참조하는 곳"
              edges={relations.incoming}
              deletable={false}
            />
          )}
        </>
      )}
    </div>
  );
}

function RelationGroup({
  title,
  edges,
  deletable,
}: {
  title: string;
  edges: SpecRelations["outgoing"];
  deletable: boolean;
}) {
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900/50">
        {title}
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
        {edges.map((edge) => {
          const removeAction = deletable
            ? deleteSpecRelation.bind(null, edge.id)
            : null;
          return (
            <li
              key={edge.id}
              className="flex items-center gap-2 px-3 py-2 text-xs"
            >
              <span className="w-20 shrink-0 text-zinc-500">
                {RELATION_LABEL[edge.type] ?? edge.type}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase",
                  TYPE_TONE[edge.other.type],
                )}
              >
                {edge.other.type}
              </span>
              <span className="flex-1 truncate">{edge.other.title}</span>
              {removeAction && (
                <form action={removeAction}>
                  <Button
                    type="submit"
                    size="xs"
                    variant="ghost"
                    title="관계 삭제"
                  >
                    ✕
                  </Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================
// History tab
// ============================================================

function HistoryTab({
  specId,
  versions,
  nextLabel,
}: {
  specId: string;
  versions: VersionItem[];
  nextLabel: string;
}) {
  return (
    <div className="space-y-4 p-4">
      <form
        action={publishSpecVersion}
        className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
      >
        <input type="hidden" name="specId" value={specId} />
        <p className="text-[11px] text-zinc-500">
          현재 저장된 본문을 <strong>{nextLabel}</strong> 으로 박아둡니다.
        </p>
        <Input
          name="changeSummary"
          maxLength={200}
          placeholder="변경 요약 (선택)"
          className="h-8 text-xs"
        />
        <select
          name="changeType"
          defaultValue=""
          className="flex h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-xs shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
        >
          {CHANGE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          {nextLabel} 발행
        </Button>
      </form>

      {versions.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-200 px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-700">
          아직 발행된 버전이 없습니다.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <VersionRow key={v.id} version={v} />
          ))}
        </ul>
      )}
    </div>
  );
}

function VersionRow({ version }: { version: VersionItem }) {
  const [expanded, setExpanded] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const archiveAction = archiveSpecVersion.bind(null, version.id);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (markdown === null) {
      setLoading(true);
      try {
        const md = await getSpecVersionMarkdown(version.id);
        setMarkdown(md);
      } catch (e) {
        setMarkdown(`(불러오기 실패: ${e instanceof Error ? e.message : "?"})`);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <li className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <span className="font-mono text-zinc-700 dark:text-zinc-300">
          {version.versionLabel}
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[9px] font-medium uppercase",
            VERSION_STATUS_TONE[version.status],
          )}
        >
          {version.status}
        </span>
        <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
          {version.changeSummary ?? (
            <span className="text-zinc-400">(요약 없음)</span>
          )}
        </span>
        <time className="shrink-0 text-[10px] text-zinc-400">
          {(version.publishedAt ?? version.createdAt)
            .toISOString()
            .slice(0, 10)}
        </time>
        <span className="shrink-0 text-zinc-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-zinc-100 p-3 dark:border-zinc-900">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
            <dt className="text-zinc-500">발행 시각</dt>
            <dd className="font-mono">
              {(version.publishedAt ?? version.createdAt)
                .toISOString()
                .slice(0, 16)
                .replace("T", " ")}
            </dd>
            <dt className="text-zinc-500">발행자</dt>
            <dd>{version.createdBy.name ?? version.createdBy.email}</dd>
            {version.changeType && (
              <>
                <dt className="text-zinc-500">변경 유형</dt>
                <dd>{version.changeType}</dd>
              </>
            )}
          </dl>

          <div className="rounded border border-zinc-100 bg-zinc-50/50 px-3 py-2 dark:border-zinc-900 dark:bg-zinc-900/30">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              본문 스냅샷
            </div>
            {loading ? (
              <div className="text-xs text-zinc-500">불러오는 중…</div>
            ) : markdown !== null ? (
              <MarkdownView markdown={markdown} />
            ) : null}
          </div>

          {version.status !== "Archived" && (
            <form action={archiveAction}>
              <Button type="submit" variant="outline" size="xs">
                Archived 로 변경
              </Button>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
