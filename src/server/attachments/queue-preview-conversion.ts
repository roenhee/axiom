// D-045 — Next 의 "use server" directive 는 client→server RPC 의도라서, 서버 내부의
// fire-and-forget 비동기 작업에는 부적합하다 (응답 후 작업이 끊기는 경우 관찰됨).
// 이 모듈은 server-only "regular" 모듈로 두고, route handler / 다른 server action
// 들이 직접 import 해서 사용한다. client 가 트리거가 필요하면 별도 API endpoint
// (`/api/attachments/[id]/trigger-preview/route.ts`) 를 거치도록 한다.

import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { uploadRoot } from "./upload-paths";
import {
  convertOfficeToPdf,
  previewFileNameFor,
  isOfficeMimeOrExt,
} from "@/lib/office-to-pdf";

/**
 * D-045. 첨부 PDF 미리보기 변환 큐 (in-process).
 *
 * 정식 queue 시스템 없이 같은 Node 프로세스 안에서 fire-and-forget 으로 LibreOffice
 * 변환을 돌린다. 진행 상태는 DB (`Attachment.previewStatus`) 에 단계별로 기록 — 서버
 * 재시작 / 장애 후에도 어디까지 갔는지 알 수 있음 (CLAUDE.md 위험 방어 3 의 idempotent
 * 정책과 같은 결).
 *
 * 동시 변환 제한: 같은 attachment 가 두 번 enqueue 되면 두 번째는 즉시 skip
 * (in-flight Set 으로 추적).
 *
 * 호출자 (upload route, lazy enqueue from view) 는 await 하지 않는다.
 * 응답 시간에 LibreOffice 의 수 초 변환 비용이 안 보이도록.
 */

const inFlight = new Set<string>();

/**
 * 변환 큐에 enqueue. 함수 자체는 await 가능하지만 fire-and-forget 으로 호출하는 게 의도.
 * 내부에서 모든 에러를 catch — 호출자로 throw 하지 않음.
 *
 * Idempotency:
 * - 이미 in-flight 면 skip
 * - DB previewStatus === "converting" 이면 skip
 * - DB previewStatus === "ready" 면 skip (이미 완료)
 * - "failed" 거나 null 이면 재시도 가능
 */
export async function enqueuePreviewConversion(attachmentId: string): Promise<void> {
  if (!attachmentId) return;
  if (inFlight.has(attachmentId)) return;

  let row: {
    id: string;
    projectId: string;
    storedName: string;
    mimeType: string;
    fileName: string;
    previewStatus: string | null;
    project: { slug: string };
  } | null;
  try {
    row = await db.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        projectId: true,
        storedName: true,
        mimeType: true,
        fileName: true,
        previewStatus: true,
        project: { select: { slug: true } },
      },
    });
  } catch (e) {
    console.error("[preview-conversion] DB lookup failed", e);
    return;
  }
  if (!row) return;
  if (!isOfficeMimeOrExt(row.mimeType, row.fileName)) return;
  if (row.previewStatus === "converting" || row.previewStatus === "ready") return;

  inFlight.add(attachmentId);
  try {
    await runConversion(row);
  } catch (e) {
    console.error("[preview-conversion] uncaught", e);
  } finally {
    inFlight.delete(attachmentId);
  }
}

interface RowForConversion {
  id: string;
  projectId: string;
  storedName: string;
  mimeType: string;
  fileName: string;
  previewStatus: string | null;
  project: { slug: string };
}

async function runConversion(row: RowForConversion): Promise<void> {
  console.error(`[preview-conversion] start id=${row.id} stored=${row.storedName}`);
  // 1) status -> converting
  try {
    await db.attachment.update({
      where: { id: row.id },
      data: { previewStatus: "converting", previewError: null, previewPath: null },
    });
  } catch (e) {
    console.error("[preview-conversion] failed to mark converting", e);
    return;
  }

  const root = uploadRoot();
  const projectDir = path.join(root, row.projectId);
  const sourcePath = path.join(projectDir, row.storedName);
  const previewName = previewFileNameFor(row.storedName);
  const previewRel = `${row.projectId}/${previewName}`;
  const previewAbs = path.join(root, previewRel);

  // 2) 대상 폴더 보장 (이미 있을 것이 99%지만 안전하게)
  try {
    await mkdir(projectDir, { recursive: true });
  } catch (e) {
    await markFailed(
      row.id,
      `대상 폴더 생성 실패: ${e instanceof Error ? e.message : "unknown"}`,
    );
    revalidateAttachment(row.project.slug, row.id);
    return;
  }

  // 3) 실제 변환
  console.error(
    `[preview-conversion] invoke LibreOffice src=${sourcePath} dest=${previewAbs}`,
  );
  const outcome = await convertOfficeToPdf({ sourcePath, destPath: previewAbs });
  console.error(
    `[preview-conversion] done ok=${outcome.ok} ${outcome.ok ? "" : `msg=${outcome.message}`}`,
  );

  if (outcome.ok) {
    try {
      await db.attachment.update({
        where: { id: row.id },
        data: {
          previewStatus: "ready",
          previewPath: previewRel,
          previewError: null,
        },
      });
    } catch (e) {
      console.error("[preview-conversion] failed to mark ready", e);
    }
  } else {
    const msg = [outcome.message, outcome.stderrTail ? `stderr: ${outcome.stderrTail}` : null]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1000);
    await markFailed(row.id, msg);
  }

  revalidateAttachment(row.project.slug, row.id);
}

async function markFailed(id: string, msg: string): Promise<void> {
  try {
    await db.attachment.update({
      where: { id },
      data: {
        previewStatus: "failed",
        previewError: msg,
        previewPath: null,
      },
    });
  } catch (e) {
    console.error("[preview-conversion] failed to mark failed", e);
  }
}

function revalidateAttachment(slug: string, attachmentId: string): void {
  try {
    revalidatePath(`/projects/${slug}/attachments/${attachmentId}`);
  } catch (e) {
    // dev 빌드 외 환경에서 throw 할 수 있음 — 무시
    console.warn("[preview-conversion] revalidatePath warn", e);
  }
}
