"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
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
import { HelpPopover } from "./HelpPopover";
import {
  childTypeRejectionReason,
  isChildTypeAllowed,
} from "@/lib/spec-type-hierarchy";
import {
  Plus,
  Folder as FolderIcon,
  FolderCog,
  Layers,
  Sparkles,
  Component as ComponentIcon,
  Activity,
  MoreHorizontal,
  GripVertical,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Upload,
  File as FileIcon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  type LucideIcon,
} from "lucide-react";
import { deleteAttachment } from "@/server/attachments/delete-attachment";
import { moveAttachment } from "@/server/attachments/move-attachment";

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  isLocked: boolean;
}

export interface SpecNode {
  id: string;
  title: string;
  type: SpecType;
  folderId: string | null;
  parentSpecId: string | null;
  order: number;
}

export interface AttachmentNode {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  order: number;
}

interface Props {
  projectId: string;
  projectSlug: string;
  folders: FolderNode[];
  specs: SpecNode[];
  attachments: AttachmentNode[];
}

const FOLDER_PREFIX = "folder:";
const SPEC_PREFIX = "spec:";
const ATTACHMENT_PREFIX = "attachment:";
const GAP_PREFIX = "gap:";

/**
 * collisionDetection — gap zone(좁은 droppable) 우선 매칭.
 * 기본 rectIntersection 은 활성 row 의 큰 rect 가 row droppable 과 더 큰 영역
 * 교차해서 row 가 잡힘 → gap drop 안 됨. pointer 위치 기준으로 gap 먼저 검사.
 */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    const gapHit = pointerCollisions.find((c) =>
      String(c.id).startsWith(GAP_PREFIX),
    );
    if (gapHit) return [gapHit];
    return pointerCollisions;
  }
  return rectIntersection(args);
};

/** 트리 아이콘 텍스트 색상 (라인 아이콘 stroke). TYPE_TONE 색상의 text-only 버전. */
const TYPE_ICON_COLOR: Record<SpecType, string> = {
  FeatureGroup: "text-purple-600 dark:text-purple-300",
  Feature: "text-blue-600 dark:text-blue-300",
  Component: "text-emerald-600 dark:text-emerald-300",
  State: "text-zinc-500 dark:text-zinc-400",
};

const SPEC_TYPE_ICON: Record<SpecType, LucideIcon> = {
  FeatureGroup: Layers,
  Feature: Sparkles,
  Component: ComponentIcon,
  State: Activity,
};

const TYPE_LABEL: Record<SpecType, string> = {
  FeatureGroup: "Feature Group",
  Feature: "Feature",
  Component: "Component",
  State: "State",
};

const SPEC_TYPE_ORDER: SpecType[] = [
  "FeatureGroup",
  "Feature",
  "Component",
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
  attachments,
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
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        // isLocked 폴더는 같은 부모 안에서 항상 최상단.
        if (a.isLocked !== b.isLocked) return a.isLocked ? -1 : 1;
        return a.order - b.order;
      });
    }
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
      arr.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    }
    return map;
  }, [specs]);

  // Attachment 는 folderId 로 그룹 (폴더/Spec 과 같은 통합 order 공간 D-036/D-038).
  const attachmentsByFolderId = useMemo(() => {
    const map = new Map<string | null, AttachmentNode[]>();
    for (const a of attachments) {
      const arr = map.get(a.folderId) ?? [];
      arr.push(a);
      map.set(a.folderId, arr);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) => a.order - b.order || a.fileName.localeCompare(b.fileName),
      );
    }
    return map;
  }, [attachments]);

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
      arr.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
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

  const attachmentById = useMemo(
    () => new Map(attachments.map((a) => [a.id, a])),
    [attachments],
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

  // 한 번 자동(ancestor)으로 펼쳐졌던 id 는 sticky 로 유지 — selection 이 바뀌어
  // 더 이상 조상이 아니게 되어도 자동으로 접지 않음. 사용자가 수동 toggle 로만 닫힘.
  const [stickyAutoExpanded, setStickyAutoExpanded] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (ancestorIds.size === 0) return;
    setStickyAutoExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ancestorIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [ancestorIds]);

  const expanded = useMemo(() => {
    const set = new Set<string>(ancestorIds);
    for (const id of stickyAutoExpanded) set.add(id);
    for (const [id, on] of manualToggled) {
      if (on) set.add(id);
      else set.delete(id);
    }
    return set;
  }, [ancestorIds, stickyAutoExpanded, manualToggled]);

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
   * AddMenu items 생성 — 4 SpecType 항목 + 옵션으로 divider + 폴더.
   * - includeFolder: 폴더 항목 포함 여부 (Spec 행에서는 false).
   * - parentSpecType: 부모 spec 의 type. 지정 시 자식 type 위계 룰 (D-035) 적용.
   *   부모보다 상위 type 은 메뉴에서 제외.
   */
  function buildAddMenuItems(opts: {
    parentFolderId?: string | null;
    parentSpecId?: string | null;
    parentSpecType?: SpecType;
    includeFolder: boolean;
  }): AddMenuEntry[] {
    const allowedTypes = opts.parentSpecType
      ? SPEC_TYPE_ORDER.filter((t) => isChildTypeAllowed(opts.parentSpecType!, t))
      : SPEC_TYPE_ORDER;
    const items: AddMenuEntry[] = allowedTypes.map((t) => {
      const Icon = SPEC_TYPE_ICON[t];
      return {
        kind: "item",
        label: TYPE_LABEL[t],
        icon: <Icon className={cn("h-3.5 w-3.5", TYPE_ICON_COLOR[t])} />,
        onSelect: () =>
          startCreatingSpec(t, {
            parentFolderId: opts.parentFolderId,
            parentSpecId: opts.parentSpecId,
          }),
      };
    });
    if (opts.includeFolder) {
      items.push({ kind: "divider" });
      items.push({
        kind: "item",
        label: "폴더",
        icon: <FolderIcon className="h-3.5 w-3.5 text-zinc-500" />,
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

  /** 드래그 중인 spec 의 type (위계 invalid 표시용). folder drag / 미드래그 시 null. */
  const draggedSpecType = useMemo<SpecType | null>(() => {
    if (!draggingId || !draggingId.startsWith(SPEC_PREFIX)) return null;
    const id = draggingId.slice(SPEC_PREFIX.length);
    return specById.get(id)?.type ?? null;
  }, [draggingId, specById]);

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
    if (overId === activeId) return;

    // Gap zone (위계 정렬) drop 처리.
    if (overId?.startsWith(GAP_PREFIX)) {
      const parts = overId.slice(GAP_PREFIX.length).split(":");
      const newFolderId = parts[0] === "_" ? null : parts[0];
      const newParentSpecId = parts[1] === "_" ? null : parts[1];
      const newOrder = parseInt(parts[2] ?? "0", 10);

      if (activeId.startsWith(FOLDER_PREFIX)) {
        // 폴더는 folder/root 레벨에만 들어갈 수 있음 (Spec 안엔 불가).
        if (newParentSpecId !== null) return;
        const folderId = activeId.slice(FOLDER_PREFIX.length);
        if (newFolderId && descendantFolderIds.has(newFolderId)) return;
        if (newFolderId) ensureExpanded(newFolderId);
        startMoveTransition(async () => {
          try {
            await moveFolder({
              id: folderId,
              newParentId: newFolderId,
              newOrder,
            });
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "이동 실패");
          }
        });
        return;
      }
      if (activeId.startsWith(SPEC_PREFIX)) {
        const specId = activeId.slice(SPEC_PREFIX.length);
        if (newParentSpecId && descendantSpecIds.has(newParentSpecId)) return;
        const active = specById.get(specId);
        if (active && newParentSpecId) {
          const parent = specById.get(newParentSpecId);
          if (parent && !isChildTypeAllowed(parent.type, active.type)) {
            window.alert(childTypeRejectionReason(parent.type, active.type));
            return;
          }
        }
        if (newParentSpecId) ensureExpanded(newParentSpecId);
        else if (newFolderId) ensureExpanded(newFolderId);
        startMoveTransition(async () => {
          try {
            await moveSpec({
              id: specId,
              newFolderId,
              newParentSpecId,
              newOrder,
            });
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "이동 실패");
          }
        });
        return;
      }
      if (activeId.startsWith(ATTACHMENT_PREFIX)) {
        // 첨부는 sub-spec 안에 들어갈 수 없음 — folder/root 레벨 gap 만 허용.
        if (newParentSpecId !== null) return;
        const attachmentId = activeId.slice(ATTACHMENT_PREFIX.length);
        if (newFolderId) ensureExpanded(newFolderId);
        startMoveTransition(async () => {
          try {
            await moveAttachment({
              id: attachmentId,
              newFolderId,
              newOrder,
            });
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "이동 실패");
          }
        });
        return;
      }
      return;
    }

    // drop target 종류 — 폴더 / Spec / 루트 (over=null 도 루트로 처리).
    let targetFolderId: string | null = null;
    let targetSpecId: string | null = null;
    if (overId === null) {
      // 트리 영역의 빈 공간 / 트리 밖에 떨어뜨림 → 루트로 이동.
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
      if (targetFolderId) ensureExpanded(targetFolderId);
      startMoveTransition(async () => {
        try {
          await moveFolder({ id, newParentId: targetFolderId });
        } catch (err) {
          window.alert(err instanceof Error ? err.message : "이동 실패");
        }
      });
    } else if (activeId.startsWith(ATTACHMENT_PREFIX)) {
      // 첨부 → 폴더 / 루트 만 가능 (Spec 안엔 못 들어감)
      if (targetSpecId !== null) return;
      const id = activeId.slice(ATTACHMENT_PREFIX.length);
      const att = attachmentById.get(id);
      if (!att) return;
      if (att.folderId === targetFolderId) return;
      if (targetFolderId) ensureExpanded(targetFolderId);
      startMoveTransition(async () => {
        try {
          await moveAttachment({ id, newFolderId: targetFolderId });
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
      // 위계 검증 (D-035) — 다른 spec 의 자식으로 들어갈 때만 적용.
      if (targetSpecId !== null) {
        const target = specById.get(targetSpecId);
        if (target && !isChildTypeAllowed(target.type, spec.type)) {
          window.alert(childTypeRejectionReason(target.type, spec.type));
          return;
        }
      }
      if (targetSpecId !== null) ensureExpanded(targetSpecId);
      else if (targetFolderId) ensureExpanded(targetFolderId);
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
    const attachmentChildren =
      attachmentsByFolderId.get(parentFolderId) ?? [];
    const isCreatingRootSpecHere =
      creating?.kind === "spec" &&
      creating.parentFolderId === parentFolderId &&
      creating.parentSpecId === null;
    const showGaps = draggingId !== null;

    // 폴더 + spec + attachment 통합 order. locked 폴더 최상단.
    type MergedItem =
      | { kind: "folder"; folder: FolderNode }
      | { kind: "spec"; spec: SpecNode }
      | { kind: "attachment"; attachment: AttachmentNode };
    const merged: MergedItem[] = [
      ...folderChildren.map((f) => ({ kind: "folder" as const, folder: f })),
      ...rootSpecChildren.map((s) => ({ kind: "spec" as const, spec: s })),
      ...attachmentChildren.map((a) => ({
        kind: "attachment" as const,
        attachment: a,
      })),
    ];
    merged.sort((a, b) => {
      const aLocked = a.kind === "folder" && a.folder.isLocked;
      const bLocked = b.kind === "folder" && b.folder.isLocked;
      if (aLocked !== bLocked) return aLocked ? -1 : 1;
      const aOrder =
        a.kind === "folder"
          ? a.folder.order
          : a.kind === "spec"
            ? a.spec.order
            : a.attachment.order;
      const bOrder =
        b.kind === "folder"
          ? b.folder.order
          : b.kind === "spec"
            ? b.spec.order
            : b.attachment.order;
      return aOrder - bOrder;
    });

    return (
      <>
        {merged.map((item, i) => {
          const prev = merged[i - 1];
          const isLockedNow = item.kind === "folder" && item.folder.isLocked;
          const prevLocked =
            prev !== undefined && prev.kind === "folder" && prev.folder.isLocked;
          const showDividerBefore =
            prev !== undefined && prevLocked && !isLockedNow;
          // locked 위로는 drop 못 함 — 그 자리 gap 숨김.
          const showGapBefore = showGaps && !isLockedNow;

          const gapKey =
            item.kind === "folder"
              ? `gap-before-f-${item.folder.id}`
              : item.kind === "spec"
                ? `gap-before-s-${item.spec.id}`
                : `gap-before-a-${item.attachment.id}`;
          const itemKey =
            item.kind === "folder"
              ? `f-${item.folder.id}`
              : item.kind === "spec"
                ? `s-${item.spec.id}`
                : `a-${item.attachment.id}`;

          return (
            <Fragment key={itemKey}>
              {showDividerBefore && (
                <div
                  key={`div-${itemKey}`}
                  className="mx-3 my-1 border-t border-zinc-200 dark:border-zinc-800"
                  aria-hidden="true"
                />
              )}
              {showGapBefore && (
                <GapZone
                  key={gapKey}
                  parentFolderId={parentFolderId}
                  parentSpecId={null}
                  order={i}
                  depth={depth}
                />
              )}
              {item.kind === "folder"
                ? (() => {
                    const folder = item.folder;
                    const isExpanded = expanded.has(folder.id);
                    const isCreatingInside =
                      (creating?.kind === "folder" &&
                        creating.parentFolderId === folder.id) ||
                      (creating?.kind === "spec" &&
                        creating.parentFolderId === folder.id &&
                        creating.parentSpecId === null);
                    const hasContent =
                      (folderChildrenMap.get(folder.id)?.length ?? 0) > 0 ||
                      (specsByFolderId.get(folder.id)?.length ?? 0) > 0 ||
                      (attachmentsByFolderId.get(folder.id)?.length ?? 0) > 0 ||
                      isCreatingInside;
                    return (
                      <div>
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
                  })()
                : item.kind === "spec"
                  ? renderSpecTree(item.spec, depth)
                  : (
                    <AttachmentRow
                      key={`a-${item.attachment.id}`}
                      attachment={item.attachment}
                      depth={depth}
                      projectSlug={projectSlug}
                    />
                  )}
            </Fragment>
          );
        })}
        {/* 끝에도 gap zone */}
        {showGaps && merged.length > 0 && (
          <GapZone
            parentFolderId={parentFolderId}
            parentSpecId={null}
            order={merged.length}
            depth={depth}
          />
        )}
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
          isHierarchyInvalid={
            draggedSpecType !== null &&
            !isChildTypeAllowed(spec.type, draggedSpecType)
          }
          isRenaming={renamingId === spec.id}
          onToggle={() => toggleExpand(spec.id)}
          onStartRename={() => setRenamingId(spec.id)}
          onFinishRename={() => setRenamingId(null)}
          addMenuItems={buildAddMenuItems({
            parentSpecId: spec.id,
            parentSpecType: spec.type,
            includeFolder: false,
          })}
        />
        {isExpanded && hasSubSpecs && (
          <>
            {subSpecs.map((child, i) => (
              <Fragment key={`s-${child.id}`}>
                {draggingId !== null && (
                  <GapZone
                    parentFolderId={null}
                    parentSpecId={spec.id}
                    order={i}
                    depth={depth + 1}
                    isHierarchyInvalid={
                      draggedSpecType !== null &&
                      !isChildTypeAllowed(spec.type, draggedSpecType)
                    }
                  />
                )}
                {renderSpecTree(child, depth + 1)}
              </Fragment>
            ))}
            {draggingId !== null && subSpecs.length > 0 && (
              <GapZone
                parentFolderId={null}
                parentSpecId={spec.id}
                order={subSpecs.length}
                depth={depth + 1}
                isHierarchyInvalid={
                  draggedSpecType !== null &&
                  !isChildTypeAllowed(spec.type, draggedSpecType)
                }
              />
            )}
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
  } else if (draggingId?.startsWith(ATTACHMENT_PREFIX)) {
    draggedLabel =
      attachmentById.get(draggingId.slice(ATTACHMENT_PREFIX.length))?.fileName ??
      null;
  }

  if (!mounted) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            프로젝트 구조
          </h2>
        </div>
        <div className="flex-1 px-3 py-2 text-xs text-zinc-400">로딩…</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
      autoScroll={{ threshold: { x: 0, y: 0.2 } }}
    >
      <div className={cn("flex h-full flex-col", movePending && "opacity-70")}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              프로젝트 구조
            </h2>
            <HelpPopover />
          </div>
          <div className="flex items-center gap-1">
            <UploadButton projectId={projectId} />
            <AddMenu
              trigger={
                <span
                  className={buttonVariants({ size: "xs" })}
                  title="추가"
                  aria-label="추가"
                >
                  <Plus className="h-3.5 w-3.5" />
                </span>
              }
              items={buildAddMenuItems({
                parentFolderId: null,
                includeFolder: true,
              })}
            />
          </div>
        </div>

        <div className="flex-1 overflow-x-hidden overflow-y-auto py-1">
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
          <div className="py-1.5">
            <AddMenu
              placement="anchor-corner"
              triggerLayout="block"
              trigger={
                <span
                  className="flex w-full cursor-pointer items-center gap-1 rounded py-1 text-xs text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
                  style={{ paddingLeft: 8 }}
                >
                  {/* drag handle 자리 (다른 row 정렬용 invisible slot) */}
                  <span className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  {/* popover 가 "만들기" 텍스트 기준 우하단에 뜨도록 anchor 마킹 */}
                  <span data-popover-anchor>만들기</span>
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
          <div className="rounded bg-white/60 px-2 py-1 text-sm text-zinc-900/60 shadow-md backdrop-blur-sm dark:bg-zinc-900/60 dark:text-zinc-100/60">
            {draggedLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
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
  } = useDraggable({
    id: `${FOLDER_PREFIX}${folder.id}`,
    disabled: folder.isLocked,
  });
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
      {...(folder.isLocked ? {} : listeners)}
      style={{
        paddingLeft: `${depth * 14 + 8}px`,
        transform: CSS.Translate.toString(transform),
      }}
      className={cn(
        "group flex items-center gap-1 py-1 text-sm transition-colors",
        !isOver && "hover:bg-zinc-50 dark:hover:bg-zinc-900",
        isOver &&
          !isDropDisabled &&
          "bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-950/40 dark:ring-blue-400",
        isDragging && "opacity-40",
        pending && "opacity-50",
        !folder.isLocked && "cursor-grab active:cursor-grabbing",
      )}
    >
      {folder.isLocked ? (
        <span
          className="flex h-5 w-5 shrink-0 select-none items-center justify-center text-zinc-200 dark:text-zinc-700"
          title="시스템 예약 폴더 — 이동 불가"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      ) : (
        <span
          {...dragAttrs}
          className="flex h-5 w-5 shrink-0 select-none items-center justify-center text-zinc-300 opacity-0 transition group-hover:opacity-100"
          aria-label="드래그하여 이동"
          title="드래그하여 이동"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
        aria-label={isExpanded ? "접기" : "펼치기"}
      >
        {hasContent ? (
          isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )
        ) : (
          <LeafDot />
        )}
      </button>

      {isRenaming ? (
        <RenameInput
          initialValue={folder.name}
          onSave={(name) => renameFolder({ id: folder.id, name })}
          onDone={onFinishRename}
        />
      ) : (
        <>
          {folder.isLocked ? (
            <FolderCog className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          )}
          <span className="min-w-0 flex-1 truncate font-medium text-zinc-700 dark:text-zinc-200">
            {folder.name}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <AddMenu

              trigger={
                <span
                  className={buttonVariants({ size: "xs", variant: "ghost" })}
                  title="이 폴더에 추가"
                >
                  <Plus className="h-3.5 w-3.5" />
                </span>
              }
              items={addMenuItems}
            />
            {!folder.isLocked && (
              <AddMenu

                trigger={
                  <span
                    className={buttonVariants({ size: "xs", variant: "ghost" })}
                    title="더보기"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </span>
                }
                items={[
                  {
                    kind: "item",
                    label: "이름 변경",
                    icon: <Pencil className="h-3.5 w-3.5" />,
                    onSelect: onStartRename,
                  },
                  {
                    kind: "item",
                    label: "삭제",
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    onSelect: handleDelete,
                  },
                ]}
              />
            )}
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
  /** 위계 룰 (D-035) 위배 — 드래그 중인 spec 의 type 이 이 spec 의 자식이 될 수 없음. */
  isHierarchyInvalid: boolean;
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
  isHierarchyInvalid,
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
      {...listeners}
      style={{
        paddingLeft: `${depth * 14 + 8}px`,
        transform: CSS.Translate.toString(transform),
      }}
      className={cn(
        "group flex cursor-grab items-center gap-1 py-1 text-sm transition-colors active:cursor-grabbing",
        isSelected
          ? "bg-zinc-100 dark:bg-zinc-800"
          : !isOver && "hover:bg-zinc-50 dark:hover:bg-zinc-900",
        isOver &&
          !isDropDisabled &&
          (isHierarchyInvalid
            ? "bg-red-50 ring-2 ring-inset ring-red-500 dark:bg-red-950/40 dark:ring-red-400"
            : "bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-950/40 dark:ring-blue-400"),
        isDragging && "opacity-40",
        pending && "opacity-50",
      )}
    >
      <span
        {...dragAttrs}
        className="flex h-5 w-5 shrink-0 select-none items-center justify-center text-zinc-300 opacity-0 transition group-hover:opacity-100"
        aria-label="드래그하여 이동"
        title="드래그하여 이동"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 hover:text-zinc-900 disabled:cursor-default disabled:opacity-100 dark:text-zinc-300 dark:hover:text-zinc-50"
        aria-label={isExpanded ? "접기" : "펼치기"}
        disabled={!hasSubSpecs}
      >
        {hasSubSpecs ? (
          isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )
        ) : (
          <LeafDot />
        )}
      </button>

      {isRenaming ? (
        <>
          <SpecTypeIcon type={spec.type} />
          <RenameInput
            initialValue={spec.title}
            onSave={(title) => renameSpec({ id: spec.id, title })}
            onDone={onFinishRename}
          />
        </>
      ) : (
        <>
          <SpecTypeIcon type={spec.type} />
          <Link
            href={`/projects/${projectSlug}/specs/${spec.id}`}
            className={cn(
              "min-w-0 flex-1 truncate",
              isSelected
                ? "font-medium text-zinc-900 dark:text-zinc-100"
                : "text-zinc-700 dark:text-zinc-300",
            )}
          >
            {spec.title}
          </Link>
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <AddMenu

              trigger={
                <span
                  className={buttonVariants({ size: "xs", variant: "ghost" })}
                  title="이 Spec 의 하위 Spec 추가"
                >
                  <Plus className="h-3.5 w-3.5" />
                </span>
              }
              items={addMenuItems}
            />
            <AddMenu

              trigger={
                <span
                  className={buttonVariants({ size: "xs", variant: "ghost" })}
                  title="더보기"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              }
              items={[
                {
                  kind: "item",
                  label: "이름 변경",
                  icon: <Pencil className="h-3.5 w-3.5" />,
                  onSelect: onStartRename,
                },
                {
                  kind: "item",
                  label: "삭제",
                  icon: <Trash2 className="h-3.5 w-3.5" />,
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
      <FolderIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
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
        className="h-7 border-transparent bg-blue-50 ring-2 ring-blue-500 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-950/40 dark:ring-blue-400 dark:focus-visible:ring-blue-400"
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
      <SpecTypeIcon type={specType} />
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
        className="h-7 border-transparent bg-blue-50 ring-2 ring-blue-500 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-950/40 dark:ring-blue-400 dark:focus-visible:ring-blue-400"
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

// ============================================================
// SpecTypeIcon — 트리에서 Spec 종류 표시 (라인 아이콘 + 타입 색상)
// ============================================================

function SpecTypeIcon({ type }: { type: SpecType }) {
  const Icon = SPEC_TYPE_ICON[type];
  return (
    <Icon
      className={cn("h-3.5 w-3.5 shrink-0", TYPE_ICON_COLOR[type])}
      aria-label={type}
    />
  );
}

// ============================================================
// LeafDot — 하위 문서가 없는 spec / 폴더의 자리표시 (접기/펼치기 아이콘 대체)
// ============================================================

function LeafDot() {
  return (
    <span
      aria-hidden="true"
      className="block h-1.5 w-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400"
    />
  );
}

// ============================================================
// GapZone — 드래그 중 row 사이에 노출되는 reorder droppable.
// ============================================================

interface GapZoneProps {
  parentFolderId: string | null;
  parentSpecId: string | null;
  /** 같은 부모 안 형제(folder+spec 통합) 사이의 삽입 위치 (0-indexed). */
  order: number;
  depth: number;
  /** 위계 룰 (D-035) 위배 — 부모 Spec 의 자식 type 으로 부적합. */
  isHierarchyInvalid?: boolean;
}

function GapZone({
  parentFolderId,
  parentSpecId,
  order,
  depth,
  isHierarchyInvalid = false,
}: GapZoneProps) {
  const id = `${GAP_PREFIX}${parentFolderId ?? "_"}:${parentSpecId ?? "_"}:${order}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  // -my-1.5 로 12px hitbox 유지하면서 시각적 layout shift 0 — 인접 row 와 6px씩 겹침.
  const accentClass = isHierarchyInvalid
    ? "bg-red-500 dark:bg-red-400"
    : "bg-blue-500 dark:bg-blue-400";
  const dotBorderClass = isHierarchyInvalid
    ? "border-red-500 dark:border-red-400"
    : "border-blue-500 dark:border-blue-400";
  return (
    <div
      ref={setNodeRef}
      className="relative -my-1.5 h-3"
    >
      <div
        className={cn(
          "absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full transition-colors",
          isOver ? accentClass : "bg-transparent",
        )}
        style={{ left: `${depth * 14 + 8}px`, right: 8 }}
      />
      {isOver && (
        <div
          className={cn(
            "absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
            dotBorderClass,
          )}
          style={{ left: `${depth * 14 + 8}px` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}


// ============================================================
// UploadButton — 헤더의 + 옆에 위치, 클릭 시 파일 선택 → 즉시 업로드 (D-038)
// ============================================================

function UploadButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList) {
    setUploading(true);
    try {
      for (const file of files) {
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
      }
      router.refresh();
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
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void handleFiles(e.target.files);
          }
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        title={uploading ? "업로드 중…" : "파일 업로드"}
        aria-label="파일 업로드"
        className={cn(
          buttonVariants({ size: "xs", variant: "ghost" }),
          uploading && "opacity-60",
        )}
      >
        <Upload className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

// ============================================================
// AttachmentRow — 트리 안의 파일 한 줄. 클릭 시 우측 패널 = 첨부 미리보기.
// ============================================================

function AttachmentRow({
  attachment,
  depth,
  projectSlug,
}: {
  attachment: AttachmentNode;
  depth: number;
  projectSlug: string;
}) {
  const pathname = usePathname();
  const isSelected =
    pathname === `/projects/${projectSlug}/attachments/${attachment.id}`;
  const Icon = mimeToIcon(attachment.mimeType);
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    setNodeRef: setDragRef,
    attributes: dragAttrs,
    listeners,
    isDragging,
    transform,
  } = useDraggable({ id: `${ATTACHMENT_PREFIX}${attachment.id}` });
  // 첨부는 droppable 아님 — 첨부 위로 다른 항목 드롭 안 됨.

  function handleDelete() {
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        await deleteAttachment(attachment.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  return (
    <div
      ref={setDragRef}
      {...listeners}
      style={{
        paddingLeft: `${depth * 14 + 8}px`,
        transform: CSS.Translate.toString(transform),
      }}
      className={cn(
        "group flex cursor-grab items-center gap-1 py-1 text-sm transition-colors active:cursor-grabbing",
        isSelected
          ? "bg-zinc-100 dark:bg-zinc-800"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
        isDragging && "opacity-40",
        pending && "opacity-50",
      )}
    >
      <span
        {...dragAttrs}
        className="flex h-5 w-5 shrink-0 select-none items-center justify-center text-zinc-300 opacity-0 transition group-hover:opacity-100"
        aria-label="드래그하여 이동"
        title="드래그하여 이동"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <LeafDot />
      </span>
      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      <Link
        href={`/projects/${projectSlug}/attachments/${attachment.id}`}
        className={cn(
          "min-w-0 flex-1 truncate",
          isSelected
            ? "font-medium text-zinc-900 dark:text-zinc-100"
            : "text-zinc-700 dark:text-zinc-300",
        )}
        title={attachment.fileName}
      >
        {attachment.fileName}
      </Link>
      <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={pending}
          title="삭제"
          aria-label="삭제"
          className={buttonVariants({ size: "xs", variant: "ghost" })}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {confirmOpen && (
        <AttachmentDeleteConfirm
          fileName={attachment.fileName}
          onConfirm={handleDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

function AttachmentDeleteConfirm({
  fileName,
  onConfirm,
  onCancel,
}: {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // ConfirmDialog 재사용은 import 사이클 회피용 — 가벼운 native 모달로 처리.
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      <div
        aria-hidden="true"
        onClick={onCancel}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative w-[min(420px,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          이 파일을 삭제할까요?
        </h2>
        <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          <strong>{fileName}</strong> 파일이 영구 삭제됩니다.
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={buttonVariants({ size: "sm", variant: "destructive" })}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function mimeToIcon(mime: string): LucideIcon {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.startsWith("text/") || mime === "application/pdf") return FileText;
  return FileIcon;
}

