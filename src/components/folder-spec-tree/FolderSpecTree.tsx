"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { moveSpec } from "@/server/specs/move-spec";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SpecType } from "@/generated/prisma/enums";

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
}

export interface SpecNode {
  id: string;
  title: string;
  type: SpecType;
  folderId: string | null;
}

interface Props {
  projectId: string;
  projectSlug: string;
  folders: FolderNode[];
  specs: SpecNode[];
}

const ROOT_DROP_ID = "__root__";
const FOLDER_PREFIX = "folder:";
const SPEC_PREFIX = "spec:";

const TYPE_TONE: Record<SpecType, string> = {
  FeatureGroup:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  Feature: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  Component:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  Tab: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  State: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};

const TYPE_SHORT: Record<SpecType, string> = {
  FeatureGroup: "FG",
  Feature: "FT",
  Component: "CP",
  Tab: "TB",
  State: "ST",
};

/**
 * 좌측 패널 — 폴더 트리에 Spec 도 nested 로 표시.
 *
 * DnD:
 * - 폴더 → 폴더(부모 변경) / 루트
 * - Spec → 폴더 / 루트
 * - id 는 "folder:<id>" / "spec:<id>" / "__root__"
 *
 * 선택 상태:
 * - URL `/projects/<slug>/specs/<id>` 에서 client side 로 추출
 * - 선택된 Spec 의 ancestor 폴더는 자동 펼침
 */
export function FolderSpecTree({
  projectId,
  projectSlug,
  folders,
  specs,
}: Props) {
  const pathname = usePathname();

  const selectedSpecId = useMemo(() => {
    if (!pathname) return null;
    const m = pathname.match(/\/projects\/[^/]+\/specs\/([^/]+)/);
    if (!m) return null;
    const id = m[1];
    if (id === "new") return null;
    return id;
  }, [pathname]);

  const folderChildrenMap = useMemo(() => {
    const map = new Map<string | null, FolderNode[]>();
    for (const f of folders) {
      const arr = map.get(f.parentId) ?? [];
      arr.push(f);
      map.set(f.parentId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
    return map;
  }, [folders]);

  const specsByFolderId = useMemo(() => {
    const map = new Map<string | null, SpecNode[]>();
    for (const s of specs) {
      const arr = map.get(s.folderId) ?? [];
      arr.push(s);
      map.set(s.folderId, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [specs]);

  const folderById = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders],
  );

  // 선택된 spec 의 모든 조상 폴더 id (자동 펼침용)
  const ancestorIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedSpecId) return set;
    const spec = specs.find((s) => s.id === selectedSpecId);
    if (!spec?.folderId) return set;
    let cursor: string | null = spec.folderId;
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor)) {
      set.add(cursor);
      visited.add(cursor);
      cursor = folderById.get(cursor)?.parentId ?? null;
    }
    return set;
  }, [selectedSpecId, specs, folderById]);

  // 수동 펼침 / 접힘 — ancestorIds 와 머지
  const [manualToggled, setManualToggled] = useState<Map<string, boolean>>(
    new Map(),
  );

  const expanded = useMemo(() => {
    const set = new Set<string>(ancestorIds);
    for (const [id, on] of manualToggled) {
      if (on) set.add(id);
      else set.delete(id);
    }
    return set;
  }, [ancestorIds, manualToggled]);

  function toggleExpand(id: string) {
    setManualToggled((prev) => {
      const next = new Map(prev);
      next.set(id, !expanded.has(id));
      return next;
    });
  }

  function ensureExpanded(id: string) {
    if (expanded.has(id)) return;
    setManualToggled((prev) => {
      const next = new Map(prev);
      next.set(id, true);
      return next;
    });
  }

  const [creating, setCreating] = useState<{ parentId: string | null } | null>(
    null,
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movePending, startMoveTransition] = useTransition();

  const descendantFolderIds = useMemo(() => {
    if (!draggingId || !draggingId.startsWith(FOLDER_PREFIX))
      return new Set<string>();
    const id = draggingId.slice(FOLDER_PREFIX.length);
    const set = new Set<string>([id]);
    const stack = [id];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const child of folderChildrenMap.get(cur) ?? []) {
        set.add(child.id);
        stack.push(child.id);
      }
    }
    return set;
  }, [draggingId, folderChildrenMap]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    if (overId === activeId) return;

    let newParentId: string | null;
    if (overId === ROOT_DROP_ID) {
      newParentId = null;
    } else if (overId.startsWith(FOLDER_PREFIX)) {
      newParentId = overId.slice(FOLDER_PREFIX.length);
    } else {
      return; // spec 위로 drop 은 무시
    }

    if (activeId.startsWith(FOLDER_PREFIX)) {
      const id = activeId.slice(FOLDER_PREFIX.length);
      // 자기 자신/후손으로 이동 금지
      if (newParentId && descendantFolderIds.has(newParentId)) return;
      const folder = folderById.get(id);
      if (!folder || folder.parentId === newParentId) return;
      startMoveTransition(async () => {
        try {
          await moveFolder({ id, newParentId });
        } catch (err) {
          window.alert(err instanceof Error ? err.message : "이동 실패");
        }
      });
    } else if (activeId.startsWith(SPEC_PREFIX)) {
      const id = activeId.slice(SPEC_PREFIX.length);
      const spec = specs.find((s) => s.id === id);
      if (!spec || spec.folderId === newParentId) return;
      startMoveTransition(async () => {
        try {
          await moveSpec({ id, newFolderId: newParentId });
        } catch (err) {
          window.alert(err instanceof Error ? err.message : "이동 실패");
        }
      });
    }
  }

  function renderChildren(parentId: string | null, depth: number) {
    const folderChildren = folderChildrenMap.get(parentId) ?? [];
    const specChildren = specsByFolderId.get(parentId) ?? [];
    return (
      <>
        {folderChildren.map((folder) => {
          const isExpanded = expanded.has(folder.id);
          const hasContent =
            (folderChildrenMap.get(folder.id)?.length ?? 0) > 0 ||
            (specsByFolderId.get(folder.id)?.length ?? 0) > 0;
          return (
            <div key={`f-${folder.id}`}>
              <FolderRow
                folder={folder}
                depth={depth}
                hasContent={hasContent}
                isExpanded={isExpanded}
                isRenaming={renamingId === folder.id}
                isDropDisabled={descendantFolderIds.has(folder.id)}
                onToggle={() => toggleExpand(folder.id)}
                onStartRename={() => setRenamingId(folder.id)}
                onFinishRename={() => setRenamingId(null)}
                onAddChild={() => {
                  ensureExpanded(folder.id);
                  setCreating({ parentId: folder.id });
                }}
                onAddSpec={() => {
                  ensureExpanded(folder.id);
                }}
                projectSlug={projectSlug}
              />
              {isExpanded && (
                <>
                  {renderChildren(folder.id, depth + 1)}
                  {creating?.parentId === folder.id && (
                    <NewFolderInput
                      projectId={projectId}
                      parentId={folder.id}
                      depth={depth + 1}
                      onDone={() => setCreating(null)}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
        {specChildren.map((spec) => (
          <SpecRow
            key={`s-${spec.id}`}
            spec={spec}
            depth={depth}
            projectSlug={projectSlug}
            isSelected={selectedSpecId === spec.id}
          />
        ))}
      </>
    );
  }

  const isEmpty =
    folders.length === 0 && specs.length === 0 && creating === null;

  let draggedLabel: string | null = null;
  if (draggingId?.startsWith(FOLDER_PREFIX)) {
    draggedLabel =
      folderById.get(draggingId.slice(FOLDER_PREFIX.length))?.name ?? null;
  } else if (draggingId?.startsWith(SPEC_PREFIX)) {
    draggedLabel =
      specs.find((s) => s.id === draggingId.slice(SPEC_PREFIX.length))?.title ??
      null;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className={cn("flex h-full flex-col", movePending && "opacity-70")}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            구조
          </h2>
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setCreating({ parentId: null })}
              title="루트에 폴더 추가"
            >
              + 폴더
            </Button>
            <Link
              href={`/projects/${projectSlug}/specs/new`}
              className={buttonVariants({ size: "xs" })}
            >
              + Spec
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          <RootDropZone visible={draggingId !== null} />
          {creating?.parentId === null && (
            <NewFolderInput
              projectId={projectId}
              parentId={null}
              depth={0}
              onDone={() => setCreating(null)}
            />
          )}
          {renderChildren(null, 0)}
          {isEmpty && (
            <div className="px-4 py-6 text-center text-xs text-zinc-500">
              아직 폴더/Spec 이 없어요. 위의 &ldquo;+ 폴더&rdquo; 또는
              &ldquo;+ Spec&rdquo; 으로 시작하세요.
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {draggedLabel ? (
          <div className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-900">
            {draggedLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ============================================================
// Root drop zone
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
// Folder row
// ============================================================

interface FolderRowProps {
  folder: FolderNode;
  depth: number;
  hasContent: boolean;
  isExpanded: boolean;
  isRenaming: boolean;
  isDropDisabled: boolean;
  onToggle: () => void;
  onStartRename: () => void;
  onFinishRename: () => void;
  onAddChild: () => void;
  onAddSpec: () => void;
  projectSlug: string;
}

function FolderRow({
  folder,
  depth,
  hasContent,
  isExpanded,
  isRenaming,
  isDropDisabled,
  onToggle,
  onStartRename,
  onFinishRename,
  onAddChild,
  onAddSpec,
  projectSlug,
}: FolderRowProps) {
  const [pending, startTransition] = useTransition();

  const {
    setNodeRef: setDragRef,
    attributes: dragAttrs,
    listeners,
    isDragging,
    transform,
  } = useDraggable({ id: `${FOLDER_PREFIX}${folder.id}` });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `${FOLDER_PREFIX}${folder.id}`,
    disabled: isDropDisabled || isRenaming,
  });

  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  async function handleDelete() {
    if (!window.confirm(`"${folder.name}" 폴더를 삭제할까요?`)) return;
    startTransition(async () => {
      try {
        await deleteFolder({ id: folder.id });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  return (
    <div
      ref={setRef}
      style={{
        paddingLeft: `${depth * 14 + 8}px`,
        transform: CSS.Translate.toString(transform),
      }}
      className={cn(
        "group flex items-center gap-1 py-1 text-sm transition-colors",
        !isOver && "hover:bg-zinc-50 dark:hover:bg-zinc-900",
        isOver && !isDropDisabled && "bg-blue-50 dark:bg-blue-950/40",
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
        {hasContent ? (isExpanded ? "▾" : "▸") : "·"}
      </button>

      {isRenaming ? (
        <RenameInput folder={folder} onDone={onFinishRename} />
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
          <span className="shrink-0 text-zinc-400">📁</span>
          <span className="flex-1 truncate font-medium text-zinc-700 dark:text-zinc-200">
            {folder.name}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <Link
              href={`/projects/${projectSlug}/specs/new?folder=${folder.id}`}
              onClick={onAddSpec}
              className={buttonVariants({ size: "xs", variant: "ghost" })}
              title="이 폴더에 Spec 추가"
            >
              + S
            </Link>
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
// Spec row
// ============================================================

interface SpecRowProps {
  spec: SpecNode;
  depth: number;
  projectSlug: string;
  isSelected: boolean;
}

function SpecRow({ spec, depth, projectSlug, isSelected }: SpecRowProps) {
  const {
    setNodeRef,
    attributes: dragAttrs,
    listeners,
    isDragging,
    transform,
  } = useDraggable({ id: `${SPEC_PREFIX}${spec.id}` });

  return (
    <div
      ref={setNodeRef}
      style={{
        paddingLeft: `${depth * 14 + 22}px`,
        transform: CSS.Translate.toString(transform),
      }}
      className={cn(
        "group flex items-center gap-1 py-1 text-sm transition-colors",
        isSelected
          ? "bg-zinc-100 dark:bg-zinc-800"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
        isDragging && "opacity-40",
      )}
    >
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
      <span
        className={cn(
          "shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide",
          TYPE_TONE[spec.type],
        )}
        title={spec.type}
      >
        {TYPE_SHORT[spec.type]}
      </span>
      <Link
        href={`/projects/${projectSlug}/specs/${spec.id}`}
        className={cn(
          "flex-1 truncate",
          isSelected
            ? "font-medium text-zinc-900 dark:text-zinc-100"
            : "text-zinc-700 dark:text-zinc-300",
        )}
      >
        {spec.title}
      </Link>
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
      style={{ paddingLeft: `${depth * 14 + 28}px` }}
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
  folder,
  onDone,
}: {
  folder: FolderNode;
  onDone: () => void;
}) {
  const [value, setValue] = useState(folder.name);
  const [pending, startTransition] = useTransition();

  function submit() {
    const name = value.trim();
    if (!name || name === folder.name) {
      onDone();
      return;
    }
    startTransition(async () => {
      try {
        await renameFolder({ id: folder.id, name });
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
