import { spawn } from "node:child_process";
import { mkdtemp, copyFile, rm, readdir, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * D-045. LibreOffice (`soffice --headless`) 를 sub-process 로 호출해 PPTX/DOCX/XLSX
 * 같은 office 파일을 PDF 로 변환한다.
 *
 * 격리 모듈 — CLAUDE.md "위험 방어 3" (AI Runner 패턴) 의 sub-process 격리 정책에
 * 맞춰 LibreOffice 실행 코드는 여기 한 곳에만 둔다. 환경(설치 경로 / 옵션)이 바뀌어도
 * 이 모듈만 갈아끼우면 된다.
 *
 * 동작 흐름:
 * 1) 임시 디렉토리 (`/tmp/sdph-conv-XXXX`) 생성
 * 2) 원본 파일을 그 안으로 복사 (LibreOffice 는 입력 파일이 있는 디렉토리에 결과를 떨굼)
 * 3) `soffice --headless --convert-to pdf --outdir <tmp> <input>` 실행
 * 4) 결과 PDF 를 호출자가 지정한 destPath 로 복사
 * 5) 임시 디렉토리 cleanup
 *
 * 안전 플래그:
 * - `--headless` GUI 없음
 * - `--norestore` 이전 세션 복구 안 함
 * - `--nofirststartwizard` 처음 실행 마법사 건너뜀
 * - `--nologo` splash 화면 안 함
 * - `--invisible` UI 완전히 안 띄움
 * - `-env:UserInstallation=file://<tmp>/profile` 프로파일 격리 — 동시 실행 시
 *   LibreOffice 의 single-instance 락 충돌 방지 (변환 1건 = 프로파일 1개)
 *
 * 매크로 보안:
 * - LibreOffice 5.x 이후 `--headless` 는 매크로 자동 실행을 막지만, 안전을 위해
 *   `MacroSecurityLevel` 을 추가로 강제하지는 않음 (기본 high 임). 필요 시 추후 추가.
 */

const DEFAULT_LIBREOFFICE_PATH =
  "/Applications/LibreOffice.app/Contents/MacOS/soffice";
const CONVERT_TIMEOUT_MS = 90_000; // 90 초 — 30MB PPTX 도 보통 10초 안에 끝남

export interface ConvertResult {
  ok: true;
  destPath: string;
}
export interface ConvertError {
  ok: false;
  message: string;
  stderrTail?: string;
}

export type ConvertOutcome = ConvertResult | ConvertError;

interface ConvertArgs {
  sourcePath: string; // 입력 office 파일의 절대경로
  destPath: string; // 결과 PDF 가 놓일 절대경로 (없는 부모 디렉토리는 호출자가 만들어둠)
}

/**
 * office 파일 → PDF 변환. 실패해도 throw 하지 않고 ConvertOutcome 으로 반환.
 * 호출자 (queue-preview-conversion) 가 에러를 DB previewError 에 저장한다.
 */
export async function convertOfficeToPdf(
  args: ConvertArgs,
): Promise<ConvertOutcome> {
  const sofficePath = process.env.LIBREOFFICE_PATH || DEFAULT_LIBREOFFICE_PATH;

  // soffice 가 존재하는지 가벼운 사전 체크
  try {
    await stat(sofficePath);
  } catch {
    return {
      ok: false,
      message: `LibreOffice 실행 파일 없음: ${sofficePath}. .env 의 LIBREOFFICE_PATH 확인.`,
    };
  }

  let tmpDir: string | null = null;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sdph-conv-"));
    const tmpProfileDir = path.join(tmpDir, "profile");
    const tmpInput = path.join(tmpDir, path.basename(args.sourcePath));

    // 원본을 tmp 로 복사 — LibreOffice 가 같은 디렉토리에 결과 PDF 를 떨굼
    await copyFile(args.sourcePath, tmpInput);

    const sofficeArgs = [
      "--headless",
      "--norestore",
      "--nofirststartwizard",
      "--nologo",
      "--invisible",
      `-env:UserInstallation=file://${tmpProfileDir}`,
      "--convert-to",
      "pdf",
      "--outdir",
      tmpDir,
      tmpInput,
    ];

    const outcome = await runSpawn(sofficePath, sofficeArgs, CONVERT_TIMEOUT_MS);
    if (!outcome.ok) {
      return {
        ok: false,
        message: outcome.message ?? "LibreOffice 실행 실패.",
        stderrTail: outcome.stderrTail,
      };
    }

    // 결과 PDF 찾기 — soffice 는 입력 basename(확장자 제거) + ".pdf" 로 저장
    const inputBase = path.basename(tmpInput, path.extname(tmpInput));
    const expected = path.join(tmpDir, `${inputBase}.pdf`);
    let producedPath = expected;
    try {
      await stat(expected);
    } catch {
      // fallback — tmp 안에서 .pdf 하나 찾기
      const entries = await readdir(tmpDir);
      const pdf = entries.find((e) => e.toLowerCase().endsWith(".pdf"));
      if (!pdf) {
        return {
          ok: false,
          message: "LibreOffice 가 PDF 를 만들지 못함 (출력 폴더에 PDF 없음).",
          stderrTail: outcome.stderrTail,
        };
      }
      producedPath = path.join(tmpDir, pdf);
    }

    await copyFile(producedPath, args.destPath);
    return { ok: true, destPath: args.destPath };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "알 수 없는 변환 오류",
    };
  } finally {
    if (tmpDir) {
      // best-effort cleanup
      void rm(tmpDir, { recursive: true, force: true });
    }
  }
}

interface SpawnOutcome {
  ok: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stderrTail?: string;
  message?: string;
}

function runSpawn(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<SpawnOutcome> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderrBuf = "";
    const STDERR_TAIL_BYTES = 1500;

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString("utf8");
      if (stderrBuf.length > STDERR_TAIL_BYTES * 4) {
        stderrBuf = stderrBuf.slice(-STDERR_TAIL_BYTES);
      }
    });

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        exitCode: null,
        signal: null,
        message: `spawn 실패: ${err.message}`,
        stderrTail: stderrBuf.slice(-STDERR_TAIL_BYTES),
      });
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const stderrTail = stderrBuf.slice(-STDERR_TAIL_BYTES);
      if (signal === "SIGKILL") {
        resolve({
          ok: false,
          exitCode: code,
          signal,
          message: `타임아웃 (${Math.round(timeoutMs / 1000)}s).`,
          stderrTail,
        });
        return;
      }
      if (code !== 0) {
        resolve({
          ok: false,
          exitCode: code,
          signal,
          message: `LibreOffice exit ${code}.`,
          stderrTail,
        });
        return;
      }
      resolve({ ok: true, exitCode: 0, signal: null, stderrTail });
    });
  });
}

/**
 * mime 또는 확장자로 office 변환 대상 여부 판별.
 */
export function isOfficeMimeOrExt(mime: string, fileName: string): boolean {
  const m = mime.toLowerCase();
  const ext = path.extname(fileName).toLowerCase();
  return (
    m === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    m === "application/vnd.ms-powerpoint" ||
    m === "application/msword" ||
    m === "application/vnd.ms-excel" ||
    ext === ".pptx" ||
    ext === ".ppt" ||
    ext === ".docx" ||
    ext === ".doc" ||
    ext === ".xlsx" ||
    ext === ".xls"
  );
}

/**
 * 원본 storedName 으로부터 미리보기 PDF 의 파일명 (확장자 제외 부분 + .preview.pdf).
 * 같은 디렉토리에 둔다.
 */
export function previewFileNameFor(storedName: string): string {
  const ext = path.extname(storedName);
  const base = ext ? storedName.slice(0, -ext.length) : storedName;
  return `${base}.preview.pdf`;
}
