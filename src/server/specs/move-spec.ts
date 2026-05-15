"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  childTypeRejectionReason,
  isChildTypeAllowed,
} from "@/lib/spec-type-hierarchy";

/**
 * Spec 의 위치/순서 변경. target 종류에 따라 두 가지 사용:
 * - 폴더 / 루트로 이동: { newFolderId: <id|null>, newParentSpecId: null }
 * - 다른 Spec 의 하위로 이동: { newParentSpecId: <id>, newFolderId 는 자유 }
 *
 * newOrder 지정 시 같은 부모 안 형제들 0..N 으로 재정렬 (한 트랜잭션).
 * 미지정 시 새 부모의 끝 (max + 1) 에 추가.
 *
 * 트리 표시 규칙: parentSpecId 가 있으면 그 Spec 밑에 표시, 없으면 folderId 따라 폴더/루트.
 *
 * 거부 케이스:
 * - 자기 자신 / 자기 후손을 부모 Spec 으로 (사이클)
 * - 다른 프로젝트의 폴더/Spec 으로 이동
 */
export async function moveSpec(args: {
  id: string;
  newFolderId?: string | null;
  newParentSpecId?: string | null;
  newOrder?: number;
}): Promise<void> {
  const userId = await getCurrentUserId();

  const spec = await db.spec.findUnique({
    where: { id: args.id },
    select: {
      id: true,
      projectId: true,
      folderId: true,
      parentSpecId: true,
      type: true,
      project: {
        select: { slug: true, members: { where: { userId }, select: { id: true } } },
      },
    },
  });
  if (!spec) throw new Error("Spec 없음.");
  if (spec.project.members.length === 0) throw new Error("권한 없음.");

  if (args.newFolderId !== undefined && args.newFolderId !== null) {
    const folder = await db.folder.findUnique({
      where: { id: args.newFolderId },
      select: { projectId: true },
    });
    if (!folder) throw new Error("폴더를 찾을 수 없음.");
    if (folder.projectId !== spec.projectId) {
      throw new Error("다른 프로젝트로는 이동 불가.");
    }
  }

  if (args.newParentSpecId !== undefined && args.newParentSpecId !== null) {
    if (args.newParentSpecId === args.id) {
      throw new Error("자기 자신을 부모로 둘 수 없음.");
    }
    const parent = await db.spec.findUnique({
      where: { id: args.newParentSpecId },
      select: { id: true, projectId: true, parentSpecId: true, type: true },
    });
    if (!parent) throw new Error("부모 Spec 을 찾을 수 없음.");
    if (parent.projectId !== spec.projectId) {
      throw new Error("다른 프로젝트로는 이동 불가.");
    }
    if (!isChildTypeAllowed(parent.type, spec.type)) {
      throw new Error(childTypeRejectionReason(parent.type, spec.type));
    }
    // 사이클 검사 — 새 부모의 조상 사슬에 args.id 가 있으면 거부.
    let cursor: string | null = parent.parentSpecId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === args.id) {
        throw new Error("자기 후손을 부모로 둘 수 없음.");
      }
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const ancestor: { parentSpecId: string | null } | null =
        await db.spec.findUnique({
          where: { id: cursor },
          select: { parentSpecId: true },
        });
      cursor = ancestor?.parentSpecId ?? null;
    }
  }

  // 새 부모의 최종 식별자 (호출 측이 한쪽만 지정하면 다른 쪽은 기존값 유지).
  const targetFolderId =
    args.newFolderId !== undefined ? args.newFolderId : spec.folderId;
  const targetParentSpecId =
    args.newParentSpecId !== undefined ? args.newParentSpecId : spec.parentSpecId;

  const isSameParent =
    targetFolderId === spec.folderId && targetParentSpecId === spec.parentSpecId;

  if (isSameParent && args.newOrder === undefined) return;

  if (args.newOrder === undefined) {
    // 끝에 추가.
    const maxOrder = await db.spec.aggregate({
      where: {
        projectId: spec.projectId,
        folderId: targetFolderId,
        parentSpecId: targetParentSpecId,
      },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    await db.spec.update({
      where: { id: args.id },
      data: {
        folderId: targetFolderId,
        parentSpecId: targetParentSpecId,
        order: nextOrder,
      },
    });
  } else {
    // 새 위치 (newOrder) 에 삽입 + 같은 부모 안 모든 형제 재정렬.
    await db.$transaction(async (tx) => {
      await tx.spec.update({
        where: { id: args.id },
        data: {
          folderId: targetFolderId,
          parentSpecId: targetParentSpecId,
        },
      });

      const others = await tx.spec.findMany({
        where: {
          projectId: spec.projectId,
          folderId: targetFolderId,
          parentSpecId: targetParentSpecId,
          id: { not: args.id },
        },
        orderBy: [{ order: "asc" }, { title: "asc" }],
        select: { id: true },
      });

      const clampedOrder = Math.max(0, Math.min(args.newOrder!, others.length));
      const final: { id: string }[] = [];
      for (let i = 0; i < others.length; i++) {
        if (i === clampedOrder) final.push({ id: args.id });
        final.push(others[i]);
      }
      if (clampedOrder >= others.length) final.push({ id: args.id });

      for (let i = 0; i < final.length; i++) {
        await tx.spec.update({
          where: { id: final[i].id },
          data: { order: i },
        });
      }
    });
  }

  revalidatePath(`/projects/${spec.project.slug}`);
}
