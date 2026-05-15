"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { SpecType } from "@/generated/prisma/enums";
import {
  childTypeRejectionReason,
  isChildTypeAllowed,
} from "@/lib/spec-type-hierarchy";

const VALID_TYPES = new Set<string>(Object.values(SpecType));

export interface CreateSpecResult {
  projectSlug: string;
  specId: string;
}

/**
 * 새 Spec 생성. 성공 시 새 Spec 의 식별자/슬러그 반환 — 호출 측이 nav 결정.
 * (이전엔 server-side redirect 였으나 1-o 에서 모달 호출이 가능하도록 변경.)
 */
const TYPE_LABEL: Record<keyof typeof SpecType, string> = {
  FeatureGroup: "Feature Group",
  Feature: "Feature",
  Component: "Component",
  State: "State",
};

export async function createSpec(formData: FormData): Promise<CreateSpecResult> {
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const folderIdRaw = String(formData.get("folderId") ?? "");
  const folderId = folderIdRaw === "" ? null : folderIdRaw;
  const parentSpecIdRaw = String(formData.get("parentSpecId") ?? "");
  const parentSpecId = parentSpecIdRaw === "" ? null : parentSpecIdRaw;

  if (!projectId) throw new Error("projectId 누락.");
  if (title.length > 200) {
    throw new Error("title 은 200 자 이하.");
  }
  if (!VALID_TYPES.has(type)) {
    throw new Error(`type 은 ${[...VALID_TYPES].join(" / ")} 중 하나.`);
  }

  const userId = await getCurrentUserId();
  const project = await db.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    select: { id: true, slug: true },
  });
  if (!project) throw new Error("프로젝트 권한 없음.");

  if (folderId) {
    const folder = await db.folder.findFirst({
      where: { id: folderId, projectId },
      select: { id: true },
    });
    if (!folder) throw new Error("폴더를 찾을 수 없음.");
  }

  if (parentSpecId) {
    const parent = await db.spec.findFirst({
      where: { id: parentSpecId, projectId },
      select: { id: true, type: true },
    });
    if (!parent) throw new Error("부모 Spec 을 찾을 수 없음.");
    if (!isChildTypeAllowed(parent.type, type as SpecType)) {
      throw new Error(childTypeRejectionReason(parent.type, type as SpecType));
    }
  }

  // 빈 title 이면 "{type label} {YYYY-MM-DD}" 로 자동 생성. 같은 위치에 중복 시 (N).
  const finalTitle = title.length > 0
    ? title
    : await generateDefaultSpecTitle({
        projectId,
        folderId,
        parentSpecId,
        type: type as SpecType,
      });

  // 새 spec 의 order = 같은 부모 안 형제들 max order + 1 (끝에 추가).
  const maxOrder = await db.spec.aggregate({
    where: { projectId, folderId, parentSpecId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const spec = await db.spec.create({
    data: {
      projectId,
      folderId,
      parentSpecId,
      title: finalTitle,
      type: type as SpecType,
      order: nextOrder,
    },
    select: { id: true },
  });

  revalidatePath(`/projects/${project.slug}`);
  return { projectSlug: project.slug, specId: spec.id };
}

async function generateDefaultSpecTitle(args: {
  projectId: string;
  folderId: string | null;
  parentSpecId: string | null;
  type: SpecType;
}): Promise<string> {
  const label = TYPE_LABEL[args.type];
  const date = new Date().toISOString().slice(0, 10);
  const base = `${label} ${date}`;
  const existing = await db.spec.findMany({
    where: {
      projectId: args.projectId,
      folderId: args.folderId,
      parentSpecId: args.parentSpecId,
      title: { startsWith: base },
    },
    select: { title: true },
  });
  if (existing.length === 0) return base;
  const used = new Set(existing.map((s) => s.title));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}
