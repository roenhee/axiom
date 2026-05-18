"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import {
  FolderSpecTree,
  type FolderNode,
  type SpecNode,
  type AttachmentNode,
} from "@/components/folder-spec-tree/FolderSpecTree";
import { CenterPane } from "@/components/center-pane/CenterPane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { updateProject } from "@/server/projects/update-project";
import { archiveProject } from "@/server/projects/archive-project";
import { ResizeHandle } from "./ResizeHandle";

interface Props {
  projectId: string;
  projectName: string;
  projectSlug: string;
  folders: FolderNode[];
  specs: SpecNode[];
  attachments: AttachmentNode[];
  children: React.ReactNode;
}

const LS_LEFT = "shell.leftWidth";
const LS_RIGHT = "shell.rightWidth";
const MIN_LEFT = 200;
const MIN_RIGHT = 360;
const MIN_CENTER = 400;
const HANDLE_WIDTH = 4;
const DEFAULT_LEFT = 280;
const DEFAULT_RIGHT = 520;

/**
 * 프로젝트 워크스페이스 셸 — 좌(트리) / 중(렌더링 뷰) / 우(선택된 Spec) 3-pane.
 *
 * D-025: 좌·우 패널 폭은 사용자가 사이 handle 을 잡고 드래그해 조정. min 제약만
 * (좌 200 / 우 360), max 없음. 값은 localStorage 로 세션 간 유지. SSR 단계에선
 * 기본값으로 렌더 후 mount 시 저장값 반영 — hydration mismatch 회피.
 */
export function ResizableShell({
  projectId,
  projectName,
  projectSlug,
  folders,
  specs,
  attachments,
  children,
}: Props) {
  const [leftW, setLeftW] = useState(DEFAULT_LEFT);
  const [rightW, setRightW] = useState(DEFAULT_RIGHT);
  const [viewportW, setViewportW] = useState(0);

  useEffect(() => {
    const l = Number(localStorage.getItem(LS_LEFT));
    if (l && l >= MIN_LEFT) setLeftW(l);
    const r = Number(localStorage.getItem(LS_RIGHT));
    if (r && r >= MIN_RIGHT) setRightW(r);
    setViewportW(window.innerWidth);
    function onResize() {
      setViewportW(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_LEFT, String(leftW));
  }, [leftW]);
  useEffect(() => {
    localStorage.setItem(LS_RIGHT, String(rightW));
  }, [rightW]);

  /**
   * 좌/우 합쳐서 viewport - MIN_CENTER - 2 * handle 만큼만 차지 가능.
   * viewport 가 너무 작은 경우 (예: SSR 시 0) clamp 무시 → 평소 데스크탑 가정.
   */
  const maxSides =
    viewportW > 0
      ? Math.max(MIN_LEFT + MIN_RIGHT, viewportW - MIN_CENTER - 2 * HANDLE_WIDTH)
      : Infinity;

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-zinc-950">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-2.5 dark:border-zinc-800">
        <ProjectTitle
          projectId={projectId}
          projectName={projectName}
          projectSlug={projectSlug}
        />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          style={{ width: leftW }}
          className="min-h-0 shrink-0 overflow-hidden"
        >
          <FolderSpecTree
            projectId={projectId}
            projectSlug={projectSlug}
            folders={folders}
            specs={specs}
            attachments={attachments}
          />
        </aside>

        <ResizeHandle
          onDelta={(d) =>
            setLeftW((w) =>
              Math.min(maxSides - rightW, Math.max(MIN_LEFT, w + d)),
            )
          }
        />

        <section
          style={{ minWidth: MIN_CENTER }}
          className="min-h-0 flex-1 overflow-y-auto bg-zinc-50/60 dark:bg-zinc-900/30"
        >
          <CenterPane />
        </section>

        <ResizeHandle
          onDelta={(d) =>
            setRightW((w) =>
              Math.min(maxSides - leftW, Math.max(MIN_RIGHT, w - d)),
            )
          }
        />

        <aside
          style={{ width: rightW }}
          className="min-h-0 shrink-0 overflow-y-auto"
        >
          {children}
        </aside>
      </div>
    </div>
  );
}

// ============================================================
// ProjectTitle — header 의 breadcrumb / 제목 + 편집 / 삭제 아이콘
// 기존 /settings 페이지 대체 (D-042).
// ============================================================

function ProjectTitle({
  projectId,
  projectName,
  projectSlug,
}: {
  projectId: string;
  projectName: string;
  projectSlug: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirmArchive() {
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        await archiveProject(projectId);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "아카이브 실패");
      }
    });
  }

  return (
    <div className="flex items-start gap-2">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-zinc-400">
          <Link href="/projects" className="hover:text-zinc-600 hover:underline">
            프로젝트
          </Link>
          <span className="mx-1.5">/</span>
          <span>{projectSlug}</span>
        </div>
        <div className="flex items-center gap-1">
          <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {projectName}
          </h1>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            disabled={pending}
            title="프로젝트 이름 편집"
            aria-label="프로젝트 이름 편집"
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
            title="이 프로젝트 아카이브"
            aria-label="이 프로젝트 아카이브"
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <ProjectMetaDialog
        open={editOpen}
        projectId={projectId}
        initialName={projectName}
        onClose={() => setEditOpen(false)}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="이 프로젝트를 아카이브할까요?"
        message={
          <>
            <strong>{projectName}</strong> 프로젝트가 목록에서 사라집니다.
            데이터는 보존되며 DB 수동 조작으로 복구 가능합니다. slug 는 그대로
            점유합니다.
          </>
        }
        confirmText="아카이브"
        destructive
        onConfirm={handleConfirmArchive}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

// ============================================================
// ProjectMetaDialog — 프로젝트 이름 편집 모달
// SpecMetaDialog 와 같은 패턴 (portal + body scroll lock + ESC 닫기).
// ============================================================

function ProjectMetaDialog({
  open,
  projectId,
  initialName,
  onClose,
}: {
  open: boolean;
  projectId: string;
  initialName: string;
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
    fd.set("id", projectId);
    startTransition(async () => {
      try {
        await updateProject(fd);
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
      aria-labelledby="project-meta-dialog-title"
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative w-[min(440px,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2
          id="project-meta-dialog-title"
          className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
        >
          프로젝트 이름 편집
        </h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-project-name">이름</Label>
            <Input
              id="edit-project-name"
              name="name"
              required
              maxLength={100}
              defaultValue={initialName}
              disabled={pending}
              autoFocus
            />
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
