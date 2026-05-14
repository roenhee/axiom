"use client";

import { useState, useTransition, useMemo } from "react";
import { createFolder } from "@/server/folders/create-folder";
import { renameFolder } from "@/server/folders/rename-folder";
import { deleteFolder } from "@/server/folders/delete-folder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
}

interface Props {
  projectId: string;
  folders: FolderNode[];
}

interface ChildrenMap {
  get(parentId: string | null): FolderNode[] | undefined;
}

function buildChildrenMap(folders: FolderNode[]): ChildrenMap {
  const map = new Map<string | null, FolderNode[]>();
  for (const f of folders) {
    const arr = map.get(f.parentId) ?? [];
    arr.push(f);
    map.set(f.parentId, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.order - b.order);
  }
  return map;
}

export function FolderTree({ projectId, folders }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(
    null,
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const childrenMap = useMemo(() => buildChildrenMap(folders), [folders]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNodes(parentId: string | null, depth: number) {
    const nodes = childrenMap.get(parentId) ?? [];
    return nodes.map((node) => {
      const hasChildren = (childrenMap.get(node.id)?.length ?? 0) > 0;
      const isExpanded = expanded.has(node.id);
      return (
        <div key={node.id}>
          <FolderRow
            node={node}
            depth={depth}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            isRenaming={renamingId === node.id}
            onToggle={() => toggleExpand(node.id)}
            onStartRename={() => setRenamingId(node.id)}
            onFinishRename={() => setRenamingId(null)}
            onAddChild={() => {
              if (!isExpanded) toggleExpand(node.id);
              setCreating({ parentId: node.id });
            }}
          />
          {isExpanded && (
            <>
              {renderNodes(node.id, depth + 1)}
              {creating?.parentId === node.id && (
                <NewFolderInput
                  projectId={projectId}
                  parentId={node.id}
                  depth={depth + 1}
                  onDone={() => setCreating(null)}
                />
              )}
            </>
          )}
        </div>
      );
    });
  }

  const isEmpty = folders.length === 0 && creating === null;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          폴더
        </h2>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setCreating({ parentId: null })}
        >
          + 폴더 추가
        </Button>
      </div>

      <div className="py-1">
        {creating?.parentId === null && (
          <NewFolderInput
            projectId={projectId}
            parentId={null}
            depth={0}
            onDone={() => setCreating(null)}
          />
        )}
        {renderNodes(null, 0)}
        {isEmpty && (
          <div className="px-4 py-6 text-center text-xs text-zinc-500">
            폴더가 없습니다. 위의 &ldquo;+ 폴더 추가&rdquo; 로 시작하세요.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Row
// ============================================================

interface RowProps {
  node: FolderNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isRenaming: boolean;
  onToggle: () => void;
  onStartRename: () => void;
  onFinishRename: () => void;
  onAddChild: () => void;
}

function FolderRow({
  node,
  depth,
  hasChildren,
  isExpanded,
  isRenaming,
  onToggle,
  onStartRename,
  onFinishRename,
  onAddChild,
}: RowProps) {
  const [pending, startTransition] = useTransition();

  async function handleDelete() {
    if (!window.confirm(`"${node.name}" 폴더를 삭제할까요?`)) return;
    startTransition(async () => {
      try {
        await deleteFolder({ id: node.id });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-1 px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900",
        pending && "opacity-50",
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex h-5 w-5 shrink-0 items-center justify-center text-xs text-zinc-400 hover:text-zinc-700"
        aria-label={isExpanded ? "접기" : "펼치기"}
      >
        {hasChildren ? (isExpanded ? "▾" : "▸") : "·"}
      </button>

      {isRenaming ? (
        <RenameInput
          node={node}
          onDone={onFinishRename}
        />
      ) : (
        <>
          <span className="flex-1 truncate">{node.name}</span>
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <Button
              size="xs"
              variant="ghost"
              onClick={onAddChild}
              title="하위 폴더 추가"
            >
              +
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={onStartRename}
              title="이름 변경"
            >
              ✎
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={handleDelete}
              disabled={pending}
              title="삭제"
            >
              ✕
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// New folder inline input
// ============================================================

function NewFolderInput({
  projectId,
  parentId,
  depth,
  onDone,
}: {
  projectId: string;
  parentId: string | null;
  depth: number;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const name = value.trim();
    if (!name) {
      onDone();
      return;
    }
    startTransition(async () => {
      try {
        await createFolder({ projectId, parentId, name });
        onDone();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "생성 실패");
      }
    });
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-1"
      style={{ paddingLeft: `${depth * 16 + 28}px` }}
    >
      <Input
        autoFocus
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onDone();
        }}
        onBlur={submit}
        placeholder="새 폴더 이름"
        className="h-7"
      />
    </div>
  );
}

// ============================================================
// Rename inline input
// ============================================================

function RenameInput({
  node,
  onDone,
}: {
  node: FolderNode;
  onDone: () => void;
}) {
  const [value, setValue] = useState(node.name);
  const [pending, startTransition] = useTransition();

  function submit() {
    const name = value.trim();
    if (!name || name === node.name) {
      onDone();
      return;
    }
    startTransition(async () => {
      try {
        await renameFolder({ id: node.id, name });
        onDone();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "이름 변경 실패");
      }
    });
  }

  return (
    <Input
      autoFocus
      value={value}
      disabled={pending}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") onDone();
      }}
      onBlur={submit}
      className="h-7 flex-1"
    />
  );
}
