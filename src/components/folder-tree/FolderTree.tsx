"use client";

import { useState, useTransition, useMemo } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { createFolder } from "@/server/folders/create-folder";
import { renameFolder } from "@/server/folders/rename-folder";
import { deleteFolder } from "@/server/folders/delete-folder";
import { moveFolder } from "@/server/folders/move-folder";
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

const ROOT_DROP_ID = "__root__";

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

/**
 * 폴더 트리. dnd-kit 으로 부모 변경 DnD.
 * 같은 부모 안 reorder 는 후순위 (Phase 6 polish).
 */
export function FolderTree({ projectId, folders }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(
    null,
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movePending, startMoveTransition] = useTransition();

  const childrenMap = useMemo(() => buildChildrenMap(folders), [folders]);
  const folderById = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders],
  );

  /** dragId 의 후손 집합 (자기 자신 포함). drop 차단용. */
  const descendantsOf = useMemo(() => {
    if (!draggingId) return new Set<string>();
    const set = new Set<string>([draggingId]);
    const stack = [draggingId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      for (const child of childrenMap.get(id) ?? []) {
        set.add(child.id);
        stack.push(child.id);
      }
    }
    return set;
  }, [draggingId, childrenMap]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    const draggedId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    if (overId === draggedId) return;
    if (descendantsOf.has(overId)) return;

    const newParentId = overId === ROOT_DROP_ID ? null : overId;
    const folder = folderById.get(draggedId);
    if (!folder) return;
    if (folder.parentId === newParentId) return;

    startMoveTransition(async () => {
      try {
        await moveFolder({ id: draggedId, newParentId });
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "이동 실패");
      }
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
            isDropDisabled={descendantsOf.has(node.id)}
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
  const draggedFolder = draggingId ? folderById.get(draggingId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div
        className={cn(
          "rounded-lg border border-zinc-200 dark:border-zinc-800",
          movePending && "opacity-70",
        )}
      >
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
          <RootDropZone visible={draggingId !== null} />
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

      <DragOverlay>
        {draggedFolder ? (
          <div className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-900">
            {draggedFolder.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ============================================================
// Root drop zone — 드래그 중일 때만 보임
// ============================================================

function RootDropZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });
  if (!visible) return null;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-2 mb-1 rounded border border-dashed py-2 text-center text-xs",
        isOver
          ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
          : "border-zinc-300 text-zinc-400 dark:border-zinc-700",
      )}
    >
      여기에 놓으면 루트로 이동
    </div>
  );
}

// ============================================================
// Row — draggable + droppable
// ============================================================

interface RowProps {
  node: FolderNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isRenaming: boolean;
  isDropDisabled: boolean;
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
  isDropDisabled,
  onToggle,
  onStartRename,
  onFinishRename,
  onAddChild,
}: RowProps) {
  const [pending, startTransition] = useTransition();

  const {
    setNodeRef: setDragRef,
    attributes: dragAttrs,
    listeners,
    isDragging,
    transform,
  } = useDraggable({ id: node.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    disabled: isDropDisabled || isRenaming,
  });

  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

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
      ref={setRef}
      style={{
        paddingLeft: `${depth * 16 + 8}px`,
        transform: CSS.Translate.toString(transform),
      }}
      className={cn(
        "group flex items-center gap-1 py-1 text-sm transition-colors",
        !isOver && "hover:bg-zinc-50 dark:hover:bg-zinc-900",
        isOver &&
          !isDropDisabled &&
          "bg-blue-50 dark:bg-blue-950/40",
        isDragging && "opacity-40",
        pending && "opacity-50",
      )}
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
        <RenameInput node={node} onDone={onFinishRename} />
      ) : (
        <>
          <button
            type="button"
            {...dragAttrs}
            {...listeners}
            className="cursor-grab select-none text-zinc-300 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
            aria-label="드래그하여 이동"
            title="드래그하여 이동"
          >
            ⠿
          </button>
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
