"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { isNextControlFlowError } from "@/lib/is-next-error";
import { buildFigmaCanonicalUrl, buildFigmaEmbedSrc } from "@/lib/figma-url";
import { getFigmaPaneData } from "@/server/figma-links/get-figma-pane-data";
import { createFigmaLink } from "@/server/figma-links/create-figma-link";
import { deleteFigmaLink } from "@/server/figma-links/delete-figma-link";
import { updateFigmaLinkLevel } from "@/server/figma-links/update-figma-link";
import { renameFigmaFrame } from "@/server/figma-links/rename-figma-frame";
import type {
  FigmaPaneData,
  SpecFigmaLinkItem,
} from "@/server/figma-links/types";
import type { FigmaRequiredLevel } from "@/generated/prisma/enums";

/**
 * 가운데 패널의 "디자인 프레임" 뷰 (D-047).
 *
 * 책임:
 *   - 현재 URL 의 Spec 에 연결된 Figma frame 들을 표시
 *   - 새 frame URL paste → 연결 추가
 *   - frame label 편집, requiredLevel 변경, 연결 해제
 *   - 선택된 frame 의 큰 iframe embed (PRD 8.4 Compare 의 좌측)
 *
 * 데이터 흐름:
 *   - specId 가 바뀌면 server action 으로 한 round-trip fetch
 *   - mutation 후 같은 fetch 로 재동기화 (server action 의 revalidatePath 는 RSC
 *     레이아웃 측 데이터에는 효과가 있지만 client state 와는 별개 — refresh()
 *     를 직접 호출)
 */
export function DesignFramePane({ specId }: { specId: string | null }) {
  const [data, setData] = useState<FigmaPaneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!specId) {
      setData(null);
      setLoading(false);
      setSelectedFrameId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getFigmaPaneData(specId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
        setSelectedFrameId((prev) => {
          if (prev && d.links.some((l) => l.frame.id === prev)) return prev;
          return d.links[0]?.frame.id ?? null;
        });
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[DesignFramePane] fetch failed", e);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [specId]);

  async function refresh() {
    if (!specId) return;
    const d = await getFigmaPaneData(specId);
    setData(d);
    setSelectedFrameId((prev) => {
      if (prev && d.links.some((l) => l.frame.id === prev)) return prev;
      return d.links[0]?.frame.id ?? null;
    });
  }

  if (!specId) {
    return (
      <Placeholder
        title="Spec 을 선택하세요"
        message="왼쪽 트리에서 Spec 을 클릭하면 그 Spec 에 연결된 Figma frame 이 여기에 표시됩니다."
      />
    );
  }
  if (loading || !data) {
    return <Placeholder title="불러오는 중…" message="" />;
  }

  const selectedLink =
    data.links.find((l) => l.frame.id === selectedFrameId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-start gap-2 px-3 py-2">
          <CoverageBadge data={data} />
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {data.links.map((l) => (
              <FrameChip
                key={l.frame.id}
                link={l}
                active={l.frame.id === selectedFrameId}
                onSelect={() => setSelectedFrameId(l.frame.id)}
              />
            ))}
            {data.links.length === 0 && (
              <span className="text-[11px] text-zinc-400">
                아직 연결된 frame 없음
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            className={cn(
              "flex h-7 items-center gap-1 rounded border px-2 text-[11px] font-medium transition",
              addOpen
                ? "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
            aria-expanded={addOpen}
          >
            <Plus className="h-3.5 w-3.5" /> Figma URL
          </button>
        </div>
        {addOpen && (
          <AddFigmaForm
            specId={specId}
            onDone={async () => {
              setAddOpen(false);
              await refresh();
            }}
            onCancel={() => setAddOpen(false)}
          />
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {selectedLink ? (
          <FrameEmbed
            key={selectedLink.id}
            link={selectedLink}
            onChange={refresh}
          />
        ) : (
          <Placeholder
            title="아직 연결된 Figma frame 이 없습니다"
            message="위의 'Figma URL' 버튼으로 Figma 의 frame Copy link URL 을 붙여 첫 연결을 추가하세요."
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// FrameChip — 상단의 frame 선택 chip
// ============================================================

function FrameChip({
  link,
  active,
  onSelect,
}: {
  link: SpecFigmaLinkItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-7 max-w-[200px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition",
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
      title={link.frame.label}
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", LEVEL_DOT[link.requiredLevel])}
      />
      <span className="truncate">{link.frame.label}</span>
    </button>
  );
}

const LEVEL_DOT: Record<FigmaRequiredLevel, string> = {
  required: "bg-red-500",
  recommended: "bg-amber-500",
  optional: "bg-zinc-400",
  not_needed: "bg-zinc-300 dark:bg-zinc-700",
};

const LEVEL_LABEL: Record<FigmaRequiredLevel, string> = {
  required: "필수",
  recommended: "권장",
  optional: "참고",
  not_needed: "불필요",
};

const LEVEL_OPTIONS: { value: FigmaRequiredLevel; label: string }[] = [
  { value: "required" as FigmaRequiredLevel, label: "필수 (required)" },
  { value: "recommended" as FigmaRequiredLevel, label: "권장 (recommended)" },
  { value: "optional" as FigmaRequiredLevel, label: "참고 (optional)" },
  { value: "not_needed" as FigmaRequiredLevel, label: "불필요 (not_needed)" },
];

// ============================================================
// CoverageBadge — "필수 3 · 권장 1 · 참고 2" 식 분포 표시
// ============================================================

function CoverageBadge({ data }: { data: FigmaPaneData }) {
  const { coverage } = data;
  if (coverage.total === 0) {
    return (
      <div className="flex h-7 shrink-0 items-center rounded border border-zinc-200 px-2 text-[11px] text-zinc-400 dark:border-zinc-800">
        0 frame
      </div>
    );
  }
  return (
    <div
      className="flex h-7 shrink-0 items-center gap-1.5 rounded border border-zinc-200 px-2 text-[11px] dark:border-zinc-800"
      title={`총 ${coverage.total} frame — 필수 ${coverage.byLevel.required}, 권장 ${coverage.byLevel.recommended}, 참고 ${coverage.byLevel.optional}, 불필요 ${coverage.byLevel.not_needed}`}
    >
      <span className="font-medium text-zinc-900 dark:text-zinc-100">
        {coverage.total}
      </span>
      <span className="text-zinc-400">frame</span>
      {coverage.byLevel.required > 0 && (
        <CoverageDot tone="bg-red-500" count={coverage.byLevel.required} />
      )}
      {coverage.byLevel.recommended > 0 && (
        <CoverageDot tone="bg-amber-500" count={coverage.byLevel.recommended} />
      )}
    </div>
  );
}

function CoverageDot({ tone, count }: { tone: string; count: number }) {
  return (
    <span className="flex items-center gap-0.5">
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", tone)} />
      <span className="text-zinc-500">{count}</span>
    </span>
  );
}

// ============================================================
// AddFigmaForm — URL paste + label + level → createFigmaLink
// ============================================================

function AddFigmaForm({
  specId,
  onDone,
  onCancel,
}: {
  specId: string;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("specId", specId);
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await createFigmaLink(fd);
        form.reset();
        await onDone();
      } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        setErrorMsg(err instanceof Error ? err.message : "추가 실패");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 border-t border-zinc-100 bg-zinc-50/60 px-3 py-2 dark:border-zinc-900 dark:bg-zinc-900/30"
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_180px_140px_auto]">
        <div className="space-y-1">
          <Label htmlFor="figma-add-url" className="text-[10px] uppercase tracking-wide text-zinc-500">
            Figma URL
          </Label>
          <Input
            id="figma-add-url"
            name="url"
            required
            placeholder="https://www.figma.com/design/.../?node-id=12-345"
            disabled={pending}
            className="h-8 font-mono text-[11px]"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="figma-add-label" className="text-[10px] uppercase tracking-wide text-zinc-500">
            라벨
          </Label>
          <Input
            id="figma-add-label"
            name="label"
            placeholder="예: 기본 상태"
            disabled={pending}
            maxLength={200}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="figma-add-level" className="text-[10px] uppercase tracking-wide text-zinc-500">
            필요 수준
          </Label>
          <select
            id="figma-add-level"
            name="requiredLevel"
            defaultValue="optional"
            disabled={pending}
            className="flex h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-1">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "추가 중…" : "추가"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            취소
          </Button>
        </div>
      </div>
      {errorMsg && (
        <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {errorMsg}
        </p>
      )}
      <p className="text-[10px] text-zinc-400">
        Figma 에서 frame 선택 → 우상단 ‘Share’ → ‘Copy link’ 한 URL 을 그대로 붙여 주세요.
      </p>
    </form>
  );
}

// ============================================================
// FrameEmbed — 선택된 frame 의 큰 iframe + toolbar
// ============================================================

function FrameEmbed({
  link,
  onChange,
}: {
  link: SpecFigmaLinkItem;
  onChange: () => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(link.frame.label);

  useEffect(() => {
    setRenameValue(link.frame.label);
    setRenameOpen(false);
  }, [link.id, link.frame.label]);

  const embedSrc = buildFigmaEmbedSrc(link.frame.fileKey, link.frame.nodeId);
  const canonicalUrl = buildFigmaCanonicalUrl(link.frame.fileKey, link.frame.nodeId);

  function handleLevelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as FigmaRequiredLevel;
    startTransition(async () => {
      try {
        await updateFigmaLinkLevel(link.id, next);
        await onChange();
      } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        window.alert(err instanceof Error ? err.message : "변경 실패");
      }
    });
  }

  function handleRenameSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("frameId", link.frame.id);
    fd.set("label", trimmed);
    startTransition(async () => {
      try {
        await renameFigmaFrame(fd);
        setRenameOpen(false);
        await onChange();
      } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        window.alert(err instanceof Error ? err.message : "이름 변경 실패");
      }
    });
  }

  function handleDelete() {
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        await deleteFigmaLink(link.id);
        await onChange();
      } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        window.alert(err instanceof Error ? err.message : "연결 해제 실패");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-3 py-2 dark:border-zinc-900 dark:bg-zinc-900/30">
        {renameOpen ? (
          <form
            onSubmit={handleRenameSubmit}
            className="flex flex-1 items-center gap-1"
          >
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={200}
              disabled={pending}
              className="h-7 text-xs"
            />
            <Button type="submit" size="xs" disabled={pending}>
              저장
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => {
                setRenameOpen(false);
                setRenameValue(link.frame.label);
              }}
              disabled={pending}
              title="취소"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-hidden="true"
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", LEVEL_DOT[link.requiredLevel])}
              />
              <span className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                {link.frame.label}
              </span>
              <button
                type="button"
                onClick={() => setRenameOpen(true)}
                disabled={pending}
                title="라벨 변경"
                aria-label="라벨 변경"
                className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
            <select
              value={link.requiredLevel}
              onChange={handleLevelChange}
              disabled={pending}
              aria-label="필요 수준"
              title={`필요 수준: ${LEVEL_LABEL[link.requiredLevel]}`}
              className="h-7 rounded-md border border-zinc-300 bg-white px-1.5 text-[11px] shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Figma 에서 열기"
              aria-label="Figma 에서 열기"
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              title="연결 해제"
              aria-label="연결 해제"
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 bg-zinc-100 p-3 dark:bg-zinc-900/60">
        <iframe
          key={link.frame.id}
          title={link.frame.label}
          src={embedSrc}
          allowFullScreen
          className="h-full w-full rounded border border-zinc-200 bg-white dark:border-zinc-800"
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="이 frame 연결을 해제할까요?"
        message={
          <>
            <strong>{link.frame.label}</strong> 연결이 이 Spec 에서 제거됩니다.
            Figma frame 자체는 같은 프로젝트의 다른 Spec 에서 계속 사용할 수
            있습니다.
          </>
        }
        confirmText="연결 해제"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

// ============================================================
// Placeholder — Spec 미선택 / 빈 상태 메시지
// ============================================================

function Placeholder({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-sm space-y-2 text-center">
        <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {title}
        </div>
        {message && <p className="text-xs text-zinc-500">{message}</p>}
      </div>
    </div>
  );
}
