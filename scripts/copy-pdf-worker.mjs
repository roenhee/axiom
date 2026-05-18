// PDF.js worker 를 public/ 에 복사 — react-pdf 가 동일 경로에서 worker 로드.
// 외부 CDN 금지 (D-008) 라 self-host 필수.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const src = "./node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
const dest = "./public/pdf.worker.min.mjs";

if (!existsSync(src)) {
  console.warn(`[copy-pdf-worker] source not found: ${src} — skipping.`);
  process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] ${src} → ${dest}`);
