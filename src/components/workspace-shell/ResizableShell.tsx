"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderSpecTree,
  type FolderNode,
  type SpecNode,
} from "@/components/folder-spec-tree/FolderSpecTree";
import { CenterPane } from "@/components/center-pane/CenterPane";
import { buttonVariants } from "@/components/ui/button";
import { ResizeHandle } from "./ResizeHandle";

interface Props {
  projectId: string;
  projectName: string;
  projectSlug: string;
  folders: FolderNode[];
  specs: SpecNode[];
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
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400">
            <Link href="/projects" className="hover:text-zinc-600 hover:underline">
              프로젝트
            </Link>
            <span className="mx-1.5">/</span>
            <span>{projectSlug}</span>
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {projectName}
          </h1>
        </div>
        <Link
          href={`/projects/${projectSlug}/settings`}
          className={buttonVariants({ variant: "outline", size: "xs" })}
        >
          설정
        </Link>
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
