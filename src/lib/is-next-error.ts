/**
 * Next.js 의 redirect() / notFound() 는 NEXT_REDIRECT / NEXT_NOT_FOUND digest 를
 * 가진 Error 를 throw 한다. 이는 control-flow 신호이지 실패가 아니므로 클라이언트의
 * try/catch 에서 잡아서 alert 으로 보여주면 안 된다 — 다시 throw 해서 Next.js 가
 * 처리하게 둬야 한다.
 */
export function isNextControlFlowError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const digest = (e as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}
