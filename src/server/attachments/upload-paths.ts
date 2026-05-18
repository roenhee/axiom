import path from "node:path";

/**
 * 첨부 저장 루트. 환경변수로 주입되어 사내 서버 이전 시 갈아끼우기 쉬움 (D-038, "방어 1").
 */
export function uploadRoot(): string {
  const dir = process.env.UPLOAD_STORAGE_DIR;
  if (!dir) throw new Error("UPLOAD_STORAGE_DIR 미설정.");
  return path.resolve(dir);
}
