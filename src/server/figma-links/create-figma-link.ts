"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { parseFigmaUrl, FigmaUrlError } from "@/lib/figma-url";
import { FigmaRequiredLevel } from "@/generated/prisma/enums";

const VALID_LEVELS = new Set<string>(Object.values(FigmaRequiredLevel));

/**
 * Figma URL paste → FigmaFrame upsert + 해당 Spec 에 SpecFigmaLink 생성.
 *
 * 형식 검증:
 *   - URL 파싱 실패 → 사용자 메시지 그대로 (FigmaUrlError).
 *   - label 비어 있으면 fileKey 짧은 형태로 fallback.
 *   - requiredLevel 누락 시 'optional'.
 *
 * 중복 처리:
 *   - 같은 프로젝트에 (fileKey, nodeId) 가 이미 있으면 frame 은 그대로 재사용 + label 갱신.
 *   - 같은 Spec 에 같은 frame 이 이미 연결돼 있으면 에러.
 */
export async function createFigmaLink(formData: FormData): Promise<void> {
  const specId = String(formData.get("specId") ?? "");
  const rawUrl = String(formData.get("url") ?? "");
  const rawLabel = String(formData.get("label") ?? "").trim();
  const rawLevel = String(formData.get("requiredLevel") ?? "optional");

  if (!specId) throw new Error("specId 누락.");
  if (!VALID_LEVELS.has(rawLevel)) {
    throw new Error(
      `requiredLevel 은 ${[...VALID_LEVELS].join(" / ")} 중 하나.`,
    );
  }
  const requiredLevel = rawLevel as FigmaRequiredLevel;

  let parsed;
  try {
    parsed = parseFigmaUrl(rawUrl);
  } catch (e) {
    if (e instanceof FigmaUrlError) throw new Error(e.message);
    throw e;
  }
  const { fileKey, nodeId } = parsed;

  const userId = await getCurrentUserId();

  const spec = await db.spec.findFirst({
    where: { id: specId, project: { members: { some: { userId } } } },
    select: {
      projectId: true,
      project: { select: { slug: true } },
    },
  });
  if (!spec) throw new Error("Spec 을 찾을 수 없거나 권한 없음.");

  const label = rawLabel.length > 0 ? rawLabel.slice(0, 200) : `Frame ${fileKey.slice(0, 6)}`;

  // FigmaFrame upsert — 같은 (project, fileKey, nodeId) 는 한 row.
  const frame = await db.figmaFrame.upsert({
    where: {
      projectId_fileKey_nodeId: {
        projectId: spec.projectId,
        fileKey,
        nodeId,
      },
    },
    update: { label },
    create: {
      projectId: spec.projectId,
      fileKey,
      nodeId,
      label,
      createdById: userId,
    },
    select: { id: true },
  });

  // 같은 Spec 안에서 frame 표시 순서: 가장 마지막 + 1.
  const maxOrder = await db.specFigmaLink.aggregate({
    where: { specId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  try {
    await db.specFigmaLink.create({
      data: {
        specId,
        figmaFrameId: frame.id,
        requiredLevel,
        order,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique")) {
      throw new Error("이미 이 Spec 에 같은 Figma frame 이 연결돼 있습니다.");
    }
    throw e;
  }

  revalidatePath(`/projects/${spec.project.slug}/specs/${specId}`);
}
