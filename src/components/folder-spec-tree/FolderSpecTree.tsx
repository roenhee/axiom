"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { renameSpec } from "@/server/specs/rename-spec";
import { deleteSpec } from "@/server/specs/delete-spec";
import { moveFolder } from "@/server/folders/move-folder";
import { moveSpec } from "@/server/specs/move-spec";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SpecType } from "@/generated/prisma/enums";
import { useRouter } from "next/navigation";
import { createSpec } from "@/server/specs/create-spec";
import { AddMenu, type AddMenuEntry } from "./AddMenu";

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
  parentSpecId: string | null;
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

const TYPE_LABEL: Record<SpecType, string> = {
  FeatureGroup: "Feature Group",
  Feature: "Feature",
  Component: "Component",
  Tab: "Tab",
  State: "State",
};

const SPEC_TYPE_ORDER: SpecType[] = [
  "FeatureGroup",
  "Feature",
  "Component",
  "Tab",
  "State",
];

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
  // dnd-kit 은 useDraggable/useDroppable 마다 자체 id 카운터를 증가시키는데,
  // 이 카운터가 server-render 와 client-hydration 사이에 일치하지 않아
  // aria-describedby 가 깨진다는 hydration mismatch 경고를 띄움.
  // mount 후에만 트리를 렌더해서 회피 — SSR 단계엔 정적 로딩 표시만.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  // parentSpecId 없는 spec 만 folderId 로 그룹 (트리에서 폴더 안에 직접 표시).
  const specsByFolderId = useMemo(() => {
    const map = new Map<string | null, SpecNode[]>();
    for (const s of specs) {
      if (s.parentSpecId !== null) continue;
      const arr = map.get(s.folderId) ?? [];
      arr.push(s);
      map.set(s.folderId, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [specs]);

  // parentSpecId 있는 spec 을 부모 spec 으로 그룹 (트리 nesting).
  const specsByParentSpecId = useMemo(() => {
    const map = new Map<string, SpecNode[]>();
    for (const s of specs) {
      if (s.parentSpecId === null) continue;
      const arr = map.get(s.parentSpecId) ?? [];
      arr.push(s);
      map.set(s.parentSpecId, arr);
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

  const specById = useMemo(
    () => new Map(specs.map((s) => [s.id, s])),
    [specs],
  );

  // 선택된 spec 의 모든 조상 폴더/Spec id (자동 펼침용).
  const ancestorIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedSpecId) return set;
    const spec = specs.find((s) => s.id === selectedSpecId);
    if (!spec) return set;

    // Spec 조상 사슬
    let specCursor: string | null = spec.parentSpecId;
    const specVisited = new Set<string>();
    while (specCursor && !specVisited.has(specCursor)) {
      set.add(specCursor);
      specVisited.add(specCursor);
      specCursor = specById.get(specCursor)?.parentSpecId ?? null;
    }

    // 루트 spec 의 folder 조상 사슬
    const rootSpec = spec.parentSpecId ? specById.get([...specVisited].pop()!) : spec;
    const startFolder = rootSpec?.folderId ?? null;
    let folderCursor: string | null = startFolder;
    const folderVisited = new Set<string>();
    while (folderCursor && !folderVisited.has(folderCursor)) {
      set.add(folderCursor);
      folderVisited.add(folderCursor);
      folderCursor = folderById.get(folderCursor)?.parentId ?? null;
    }
    return set;
  }, [selectedSpecId, specs, folderById, specById]);

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

  // 인라인 생성 state. 한 번에 한 곳만 활성.
  // folder: 폴더 생성. spec: type 별 spec 생성. parent 가 폴더이면 parentFolderId,
  // 다른 spec 의 하위면 parentSpecId.
  type CreatingState =
    | { kind: "folder"; parentFolderId: string | null }
    | {
        kind: "spec";
        specType: SpecType;
        parentFolderId: string | null;
        parentSpecId: string | null;
      };
  const [creating, setCreating] = useState<CreatingState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  function startCreatingFolder(parentFolderId: string | null) {
    if (parentFolderId !== null) ensureExpanded(parentFolderId);
    setCreating({ kind: "folder", parentFolderId });
  }

  function startCreatingSpec(
    specType: SpecType,
    opts: { parentFolderId?: string | null; parentSpecId?: string | null } = {},
  ) {
    const parentFolderId = opts.parentFolderId ?? null;
    const parentSpecId = opts.parentSpecId ?? null;
    if (parentFolderId) ensureExpanded(parentFolderId);
    if (parentSpecId) ensureExpanded(parentSpecId);
    setCreating({ kind: "spec", specType, parentFolderId, parentSpecId });
  }

  /**
   * AddMenu items 생성 — 5 SpecType 항목 + 옵션으로 divider + 폴더.
   * Spec 행 안에선 폴더 항목 빠짐 (Spec 하위에 폴더는 데이터 모델상 불가).
   */
  function buildAddMenuItems(opts: {
    parentFolderId?: string | null;
    parentSpecId?: string | null;
    includeFolder: boolean;
  }): AddMenuEntry[] {
    const items: AddMenuEntry[] = SPEC_TYPE_ORDER.map((t) => ({
      kind: "item",
      label: TYPE_LABEL[t],
      icon: "📄",
      onSelect: () =>
        startCreatingSpec(t, {
          parentFolderId: opts.parentFolderId,
          parentSpecId: opts.parentSpecId,
        }),
    }));
    if (opts.includeFolder) {
      items.push({ kind: "divider" });
      items.push({
        kind: "item",
        label: "폴더",
        icon: "📁",
        onSelect: () => startCreatingFolder(opts.parentFolderId ?? null),
      });
    }
    return items;
  }
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movePending, startMoveTransition] = useTransition();

  /** 드래그 중인 폴더의 후손 폴더 id (drop 거부용). spec drag 시엔 비어있음. */
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

  /** 드래그 중인 spec 의 후손 spec id (sub-spec 자기 자신/후손 위로 drop 거부용). folder drag 시엔 비어있음. */
  const descendantSpecIds = useMemo(() => {
    if (!draggingId || !draggingId.startsWith(SPEC_PREFIX))
      return new Set<string>();
    const id = draggingId.slice(SPEC_PREFIX.length);
    const set = new Set<string>([id]);
    const stack = [id];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const child of specsByParentSpecId.get(cur) ?? []) {
        set.add(child.id);
        stack.push(child.id);
      }
    }
    return set;
  }, [draggingId, specsByParentSpecId]);

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

    // drop target 종류 — 폴더 / Spec / 루트
    let targetFolderId: string | null = null;
    let targetSpecId: string | null = null;
    if (overId === ROOT_DROP_ID) {
      // 둘 다 null — 루트로
    } else if (overId.startsWith(FOLDER_PREFIX)) {
      targetFolderId = overId.slice(FOLDER_PREFIX.length);
    } else if (overId.startsWith(SPEC_PREFIX)) {
      targetSpecId = overId.slice(SPEC_PREFIX.length);
    } else {
      return;
    }

    if (activeId.startsWith(FOLDER_PREFIX)) {
      // 폴더 → ? Folder/Root 만 허용 (Spec 위로 폴더 drop 금지)
      if (targetSpecId !== null) return;
      const id = activeId.slice(FOLDER_PREFIX.length);
      if (targetFolderId && descendantFolderIds.has(targetFolderId)) return;
      const folder = folderById.get(id);
      if (!folder || folder.parentId === targetFolderId) return;
      startMoveTransition(async () => {
        try {
          await moveFolder({ id, newParentId: targetFolderId });
        } catch (err) {
          window.alert(err instanceof Error ? err.message : "이동 실패");
        }
      });
    } else if (activeId.startsWith(SPEC_PREFIX)) {
      const id = activeId.slice(SPEC_PREFIX.length);
      const spec = specById.get(id);
      if (!spec) return;
      // 자기 자신/후손 spec 위로 drop 금지
      if (targetSpecId && descendantSpecIds.has(targetSpecId)) return;
      // 변동 없음 → no-op
      if (
        targetSpecId !== null
          ? spec.parentSpecId === targetSpecId
          : spec.parentSpecId === null && spec.folderId === targetFolderId
      ) {
        return;
      }
      startMoveTransition(async () => {
        try {
          if (targetSpecId !== null) {
            // Spec → 다른 Spec 의 하위
            await moveSpec({ id, newParentSpecId: targetSpecId });
          } else {
            // Spec → 폴더 / 루트
            await moveSpec({
              id,
              newFolderId: targetFolderId,
              newParentSpecId: null,
            });
          }
        } catch (err) {
          window.alert(err instanceof Error ? err.message : "이동 실패");
        }
      });
    }
  }

  function renderFolderContents(parentFolderId: string | null, depth: number) {
    const folderChildren = folderChildrenMap.get(parentFolderId) ?? [];
    const rootSpecChildren = specsByFolderId.get(parentFolderId) ?? [];
    const isCreatingRootSpecHere =
      creating?.kind === "spec" &&
      creating.parentFolderId === parentFolderId &&
      creating.parentSpecId === null;
    return (
      <>
        {folderChildren.map((folder) => {
          const isExpanded = expanded.has(folder.id);
          const isCreatingInside =
            (creating?.kind === "folder" && creating.parentFolderId === folder.id) ||
            (creating?.kind === "spec" &&
              creating.parentFolderId === folder.id &&
              creating.parentSpecId === null);
          const hasContent =
            (folderChildrenMap.get(folder.id)?.length ?? 0) > 0 ||
            (specsByFolderId.get(folder.id)?.length ?? 0) > 0 ||
            isCreatingInside;
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
                addMenuItems={buildAddMenuItems({
                  parentFolderId: folder.id,
                  includeFolder: true,
                })}
                projectSlug={projectSlug}
              />
              {isExpanded && (
                <>
                  {renderFolderContents(folder.id, depth + 1)}
                  {creating?.kind === "folder" &&
                    creating.parentFolderId === folder.id && (
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
        {rootSpecChildren.map((spec) => renderSpecTree(spec, depth))}
        {isCreatingRootSpecHere &&
          creating?.kind === "spec" && (
            <NewSpecInput
              projectId={projectId}
              specType={creating.specType}
              parentFolderId={parentFolderId}
              parentSpecId={null}
              depth={depth}
              onDone={() => setCreating(null)}
            />
          )}
      </>
    );
  }

  function renderSpecTree(spec: SpecNode, depth: number) {
    const subSpecs = specsByParentSpecId.get(spec.id) ?? [];
    const isCreatingSubSpec =
      creating?.kind === "spec" && creating.parentSpecId === spec.id;
    const hasSubSpecs = subSpecs.length > 0 || isCreatingSubSpec;
    const isExpanded = expanded.has(spec.id);
    return (
      <div key={`s-${spec.id}`}>
        <SpecRow
          spec={spec}
          depth={depth}
          projectSlug={projectSlug}
          isSelected={selectedSpecId === spec.id}
          hasSubSpecs={hasSubSpecs}
          isExpanded={isExpanded}
          isDropDisabled={descendantSpecIds.has(spec.id)}
          isRenaming={renamingId === spec.id}
          onToggle={() => toggleExpand(spec.id)}
          onStartRename={() => setRenamingId(spec.id)}
          onFinishRename={() => setRenamingId(null)}
          addMenuItems={buildAddMenuItems({
            parentSpecId: spec.id,
            includeFolder: false,
          })}
        />
        {isExpanded && hasSubSpecs && (
          <>
            {subSpecs.map((child) => renderSpecTree(child, depth + 1))}
            {isCreatingSubSpec && creating?.kind === "spec" && (
              <NewSpecInput
                projectId={projectId}
                specType={creating.specType}
                parentFolderId={null}
                parentSpecId={spec.id}
                depth={depth + 1}
                onDone={() => setCreating(null)}
              />
            )}
          </>
        )}
      </div>
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

  if (!mounted) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            구조
          </h2>
        </div>
        <div className="flex-1 px-3 py-2 text-xs text-zinc-400">로딩…</div>
      </div>
    );
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
          <AddMenu
            align="right"
            trigger={
              <span className={buttonVariants({ size: "xs" })} title="추가">
                + 추가
              </span>
            }
            items={buildAddMenuItems({
              parentFolderId: null,
              includeFolder: true,
            })}
          />
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          <RootDropZone visible={draggingId !== null} />
          {creating?.kind === "folder" && creating.parentFolderId === null && (
            <NewFolderInput
              projectId={projectId}
              parentId={null}
              depth={0}
              onDone={() => setCreating(null)}
            />
          )}
          {renderFolderContents(null, 0)}
          {isEmpty && (
            <div className="px-4 py-6 text-center text-xs text-zinc-500">
              아직 폴더/Spec 이 없어요. 아래 &ldquo;+ 만들기&rdquo; 로 시작하세요.
            </div>
          )}
          <div className="px-2 py-1.5">
            <AddMenu
              align="left"
              trigger={
                <span className="flex w-full cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300">
                  + 만들기
                </span>
              }
              items={buildAddMenuItems({
                parentFolderId: null,
                includeFolder: true,
              })}
            />
          </div>
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
  /** + 메뉴 항목 — 부모에서 buildAddMenuItems() 로 생성. */
  addMenuItems: AddMenuEntry[];
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
  addMenuItems,
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
        <RenameInput
          initialValue={folder.name}
          onSave={(name) => renameFolder({ id: folder.id, name })}
          onDone={onFinishRename}
        />
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
            <AddMenu
              align="right"
              trigger={
                <span
                  className={buttonVariants({ size: "xs", variant: "ghost" })}
                  title="이 폴더에 추가"
                >
                  +
                </span>
              }
              items={addMenuItems}
            />
            <AddMenu
              align="right"
              trigger={
                <span
                  className={buttonVariants({ size: "xs", variant: "ghost" })}
                  title="더보기"
                >
                  ⋯
                </span>
              }
              items={[
                {
                  kind: "item",
                  label: "이름 변경",
                  icon: "✎",
                  onSelect: onStartRename,
                },
                {
                  kind: "item",
                  label: "삭제",
                  icon: "🗑️",
                  onSelect: handleDelete,
                },
              ]}
            />
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
  hasSubSpecs: boolean;
  isExpanded: boolean;
  isDropDisabled: boolean;
  isRenaming: boolean;
  onToggle: () => void;
  onStartRename: () => void;
  onFinishRename: () => void;
  /** + 메뉴 항목 — 5 SpecType 만, 폴더 없음. */
  addMenuItems: AddMenuEntry[];
}

function SpecRow({
  spec,
  depth,
  projectSlug,
  isSelected,
  hasSubSpecs,
  isExpanded,
  isDropDisabled,
  isRenaming,
  onToggle,
  onStartRename,
  onFinishRename,
  addMenuItems,
}: SpecRowProps) {
  const [pending, startTransition] = useTransition();
  const {
    setNodeRef: setDragRef,
    attributes: dragAttrs,
    listeners,
    isDragging,
    transform,
  } = useDraggable({ id: `${SPEC_PREFIX}${spec.id}` });

  // Spec 도 droppable — 다른 Spec 을 드롭하면 sub-spec 으로.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `${SPEC_PREFIX}${spec.id}`,
    disabled: isDropDisabled || isRenaming,
  });

  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  async function handleDelete() {
    if (
      !window.confirm(
        `"${spec.title}" Spec 을 삭제할까요? 연결된 Version / Revision / 관계 정보도 함께 삭제됩니다.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteSpec(spec.id);
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
        isSelected
          ? "bg-zinc-100 dark:bg-zinc-800"
          : !isOver && "hover:bg-zinc-50 dark:hover:bg-zinc-900",
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
        disabled={!hasSubSpecs}
      >
        {hasSubSpecs ? (isExpanded ? "▾" : "▸") : "·"}
      </button>

      {isRenaming ? (
        <>
          <span
            className={cn(
              "shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide",
              TYPE_TONE[spec.type],
            )}
            title={spec.type}
          >
            {TYPE_SHORT[spec.type]}
          </span>
          <RenameInput
            initialValue={spec.title}
            onSave={(title) => renameSpec({ id: spec.id, title })}
            onDone={onFinishRename}
          />
        </>
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
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <AddMenu
              align="right"
              trigger={
                <span
                  className={buttonVariants({ size: "xs", variant: "ghost" })}
                  title="이 Spec 의 하위 Spec 추가"
                >
                  +
                </span>
              }
              items={addMenuItems}
            />
            <AddMenu
              align="right"
              trigger={
                <span
                  className={buttonVariants({ size: "xs", variant: "ghost" })}
                  title="더보기"
                >
                  ⋯
                </span>
              }
              items={[
                {
                  kind: "item",
                  label: "이름 변경",
                  icon: "✎",
                  onSelect: onStartRename,
                },
                {
                  kind: "item",
                  label: "삭제",
                  icon: "🗑️",
                  onSelect: handleDelete,
                },
              ]}
            />
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
  // submit 후 onBlur 가 한 번 더 트리거되면 이중 생성. 한 번만 처리.
  const submittedRef = useRef(false);

  function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    startTransition(async () => {
      try {
        // 빈 이름이면 서버에서 "폴더 YYYY-MM-DD" 로 자동 생성.
        await createFolder({ projectId, parentId, name: value });
        onDone();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "생성 실패");
        onDone();
      }
    });
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-1"
      style={{ paddingLeft: `${depth * 14 + 28}px` }}
    >
      <span className="shrink-0 text-zinc-400">📁</span>
      <Input
        autoFocus
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            submittedRef.current = true;
            onDone();
          }
        }}
        onBlur={submit}
        placeholder="비워두면 자동 이름"
        className="h-7"
      />
    </div>
  );
}

// ============================================================
// New spec inline input
// ============================================================

function NewSpecInput({
  projectId,
  specType,
  parentFolderId,
  parentSpecId,
  depth,
  onDone,
}: {
  projectId: string;
  specType: SpecType;
  parentFolderId: string | null;
  parentSpecId: string | null;
  depth: number;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const submittedRef = useRef(false);

  function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("title", value);
        fd.set("type", specType);
        if (parentFolderId) fd.set("folderId", parentFolderId);
        if (parentSpecId) fd.set("parentSpecId", parentSpecId);
        const { projectSlug, specId } = await createSpec(fd);
        onDone();
        router.push(`/projects/${projectSlug}/specs/${specId}`);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "생성 실패");
        onDone();
      }
    });
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-1"
      style={{ paddingLeft: `${depth * 14 + 28}px` }}
    >
      <span
        className={cn(
          "shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide",
          TYPE_TONE[specType],
        )}
        title={specType}
      >
        {TYPE_SHORT[specType]}
      </span>
      <Input
        autoFocus
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            submittedRef.current = true;
            onDone();
          }
        }}
        onBlur={submit}
        placeholder={`${TYPE_LABEL[specType]} — 비워두면 자동 이름`}
        className="h-7"
      />
    </div>
  );
}

// ============================================================
// Rename inline input
// ============================================================

function RenameInput({
  initialValue,
  onSave,
  onDone,
}: {
  initialValue: string;
  onSave: (newValue: string) => Promise<void>;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const submittedRef = useRef(false);

  function submit() {
    if (submittedRef.current) return;
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialValue) {
      submittedRef.current = true;
      onDone();
      return;
    }
    submittedRef.current = true;
    startTransition(async () => {
      try {
        await onSave(trimmed);
        onDone();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "이름 변경 실패");
        onDone();
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
        if (e.key === "Escape") {
          submittedRef.current = true;
          onDone();
        }
      }}
      onBlur={submit}
      className="h-7 flex-1"
    />
  );
}
