/**
 * Figma URL → fileKey + nodeId 파싱.
 *
 * 받는 형태 (모두 허용):
 *   https://www.figma.com/file/{fileKey}/{name}?node-id=12-345
 *   https://www.figma.com/design/{fileKey}/{name}?node-id=12-345    (2024+ 신 URL)
 *   https://www.figma.com/proto/{fileKey}/{name}?node-id=12-345
 *   https://figma.com/file/{fileKey}/...           (www 없어도 OK)
 *   https://www.figma.com/file/{fileKey}/{name}?node-id=12:345     (콜론 형태)
 *
 * nodeId 는 URL 에서 `12-345` 또는 `12:345` 둘 다 올 수 있는데 내부 표현은
 * `12:345` (콜론) 로 정규화한다 — figma embed URL 이 콜론 형태를 표준으로 사용.
 *
 * node-id 가 없으면 frame 단위가 아닌 파일 root — Spec 단위 연결에는 부적합.
 * 사용자에게 "node-id 가 포함된 URL 을 붙여주세요" 메시지로 거절.
 */
export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId: string;
}

const FIGMA_FILE_PATH_RE = /^\/(?:file|design|proto)\/([A-Za-z0-9]{6,})(?:\/|$)/;

export function parseFigmaUrl(input: string): ParsedFigmaUrl {
  const raw = (input ?? "").trim();
  if (!raw) {
    throw new FigmaUrlError("Figma URL 을 입력해 주세요.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FigmaUrlError(
      "URL 형식이 아닙니다. 예: https://www.figma.com/design/abc123/Design?node-id=12-345",
    );
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host !== "figma.com") {
    throw new FigmaUrlError("figma.com 도메인의 URL 만 허용합니다.");
  }

  const m = FIGMA_FILE_PATH_RE.exec(url.pathname);
  if (!m) {
    throw new FigmaUrlError(
      "Figma file/design/proto URL 이 아닙니다. 예: https://www.figma.com/design/abc123/Design?node-id=12-345",
    );
  }
  const fileKey = m[1];

  const rawNode = url.searchParams.get("node-id");
  if (!rawNode) {
    throw new FigmaUrlError(
      "URL 에 `node-id` 가 없습니다. Figma 에서 frame 을 선택한 뒤 'Copy link' 로 복사한 URL 을 붙여 주세요.",
    );
  }
  const nodeId = normalizeNodeId(rawNode);
  return { fileKey, nodeId };
}

export function normalizeNodeId(raw: string): string {
  return raw.replace(/-/g, ":");
}

/**
 * 저장된 (fileKey, nodeId) 로부터 embed iframe 의 src 를 생성.
 *
 * Figma embed 는 두 가지 방식이 있다:
 *   1) https://www.figma.com/embed?embed_host=... &url=<원본 URL>
 *   2) iframe 안에서 figma.com/file/... 페이지를 직접 embed
 *
 * 표준 방식은 (1). embed_host 는 임의 식별자라도 동작 (Figma 가 host 정책에 쓸 뿐).
 */
export function buildFigmaEmbedSrc(
  fileKey: string,
  nodeId: string,
  embedHost: string = "spec-hub",
): string {
  const originalUrl = `https://www.figma.com/design/${fileKey}?node-id=${nodeId.replace(/:/g, "-")}`;
  const params = new URLSearchParams({
    embed_host: embedHost,
    url: originalUrl,
  });
  return `https://www.figma.com/embed?${params.toString()}`;
}

/**
 * 사용자가 다시 Figma 로 돌아가서 frame 을 열 때 쓰는 deep link.
 */
export function buildFigmaCanonicalUrl(fileKey: string, nodeId: string): string {
  return `https://www.figma.com/design/${fileKey}?node-id=${nodeId.replace(/:/g, "-")}`;
}

export class FigmaUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaUrlError";
  }
}
