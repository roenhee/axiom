"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

/**
 * Spec 의 위치 변경. target 종류에 따라 두 가지 사용:
 * - 폴더 / 루트로 이동: { newFolderId: <id|null>, newParentSpecId: null }
 * - 다른 Spec 의 하위로 이동: { newParentSpecId: <id>, newFolderId 는 자유 }
 *
 * 트리 표시 규칙: parentSpecId 가 있으면 그 Spec 밑에 표시, 없으면 folderId 따라 폴더/루트.
 * 그래서 두 컬럼은 서로 다른 의미 — 동시에 가질 수 있음 (호출 측이 결정).
 *
 * 거부 케이스:
 * - 자기 자신 / 자기 후손을 부모 Spec 으로 (사이클)
 * - 다른 프로젝트의 폴더/Spec 으로 이동
 */
export async function moveSpec(args: {
  id: string;
  newFolderId?: string | null;
  newParentSpecId?: string | null;
}): Promise<void> {
  const userId = await getCurrentUserId();

  const spec = await db.spec.findUnique({
    where: { id: args.id },
    select: {
      id: true,
      projectId: true,
      folderId: true,
      parentSpecId: true,
      project: {
        select: { slug: true, members: { where: { userId }, select: { id: true } } },
      },
    },
  });
  if (!spec) throw new Error("Spec 없음.");
  if (spec.project.members.length === 0) throw new Error("권한 없음.");

  const data: { folderId?: string | null; parentSpecId?: string | null } = {};

  if (args.newFolderId !== undefined) {
    if (args.newFolderId !== null) {
      const folder = await db.folder.findUnique({
        where: { id: args.newFolderId },
        select: { projectId: true },
      });
      if (!folder) throw new Error("폴더를 찾을 수 없음.");
      if (folder.projectId !== spec.projectId) {
        throw new Error("다른 프로젝트로는 이동 불가.");
      }
    }
    data.folderId = args.newFolderId;
  }

  if (args.newParentSpecId !== undefined) {
    if (args.newParentSpecId !== null) {
      if (args.newParentSpecId === args.id) {
        throw new Error("자기 자신을 부모로 둘 수 없음.");
      }
      // 새 부모가 같은 프로젝트인지
      const parent = await db.spec.findUnique({
        where: { id: args.newParentSpecId },
        select: { id: true, projectId: true, parentSpecId: true },
      });
      if (!parent) throw new Error("부모 Spec 을 찾을 수 없음.");
      if (parent.projectId !== spec.projectId) {
        throw new Error("다른 프로젝트로는 이동 불가.");
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
    data.parentSpecId = args.newParentSpecId;
  }

  if (Object.keys(data).length === 0) return;

  await db.spec.update({
    where: { id: args.id },
    data,
  });

  revalidatePath(`/projects/${spec.project.slug}`);
}
