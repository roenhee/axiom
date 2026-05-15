"use client";

import { useState } from "react";
import { SpecEditor } from "@/components/spec-editor/SpecEditor";
import { MarkdownView } from "@/components/markdown/MarkdownView";
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
  title: string;
  type: SpecType;
  folderId: string | null;
}

interface Props {
  spec: SpecData;
  initialMarkdown: string;
  folders: FolderNode[];
  versions: VersionItem[];
  nextLabel: string;
  relations: SpecRelations;
  otherSpecs: OtherSpec[];
}

type TabKey = "body" | "meta" | "relations" | "history";

const TABS: { key: TabKey; label: string }[] = [
  { key: "body", label: "본문" },
  { key: "meta", label: "메타" },
  { key: "relations", label: "관계" },
  { key: "history", label: "히스토리" },
];

const TYPE_OPTIONS: { value: keyof typeof SpecTypeStrict; label: string }[] = [
  { value: "FeatureGroup", label: "Feature Group" },
  { value: "Feature", label: "Feature" },
  { value: "Component", label: "Component" },
  { value: "Tab", label: "Tab" },
  { value: "State", label: "State" },
];

// 컴파일 안정성을 위한 enum-like 상수
const SpecTypeStrict = {
  FeatureGroup: "FeatureGroup",
  Feature: "Feature",
  Component: "Component",
  Tab: "Tab",
  State: "State",
} as const;

const TYPE_TONE: Record<SpecType, string> = {
  FeatureGroup:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  Feature: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  Component:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  Tab: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
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
          <BodyTab specId={spec.id} initialMarkdown={initialMarkdown} />
        )}
        {active === "meta" && <MetaTab spec={spec} folders={folders} />}
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
  return (
    <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
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
  );
}

// ============================================================
// Body tab — Tiptap editor
// ============================================================

function BodyTab({
  specId,
  initialMarkdown,
}: {
  specId: string;
  initialMarkdown: string;
}) {
  return (
    <div className="p-4">
      <SpecEditor specId={specId} initialMarkdown={initialMarkdown} />
    </div>
  );
}

// ============================================================
// Meta tab — title / type / folder + Spec 삭제
// ============================================================

function MetaTab({
  spec,
  folders,
}: {
  spec: SpecData;
  folders: FolderNode[];
}) {
  const deleteAction = deleteSpec.bind(null, spec.id);

  return (
    <div className="space-y-6 p-4">
      <form action={updateSpec} className="space-y-4">
        <input type="hidden" name="id" value={spec.id} />

        <div className="space-y-1.5">
          <Label htmlFor="title">제목</Label>
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={spec.title}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="type">타입</Label>
          <select
            id="type"
            name="type"
            required
            defaultValue={spec.type}
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
          <Label htmlFor="folderId">폴더</Label>
          <select
            id="folderId"
            name="folderId"
            defaultValue={spec.folderId ?? ""}
            className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
          >
            <option value="">(루트)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-400">
            좌측 트리에서 드래그로 옮길 수도 있습니다.
          </p>
        </div>

        <Button type="submit">저장</Button>
      </form>

      <div className="rounded-md border border-red-200 p-4 dark:border-red-900">
        <h3 className="text-sm font-medium">Spec 삭제</h3>
        <p className="mt-1 text-xs text-zinc-500">
          연결된 Version / Revision / 관계 정보도 영구 삭제됩니다.
        </p>
        <form action={deleteAction} className="mt-3">
          <Button type="submit" variant="destructive" size="sm">
            이 Spec 삭제
          </Button>
        </form>
      </div>
    </div>
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
        <Input
          name="changeType"
          maxLength={50}
          placeholder="변경 유형 (feature / fix / refactor …)"
          className="h-8 text-xs"
        />
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
