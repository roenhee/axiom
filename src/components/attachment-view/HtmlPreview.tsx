"use client";

interface Props {
  url: string;
  title: string;
}

/**
 * HTML 파일 (reveal.js / 정적 deck / 일반 페이지) 미리보기.
 *
 * 보안:
 * - sandbox="allow-scripts" — 스크립트는 실행되지만 opaque origin 으로 격리.
 *   업로드된 HTML 의 악성 코드가 본 앱의 쿠키/localStorage 에 접근 못 함.
 * - `allow-same-origin` 의도적 제외.
 *
 * 페이지 nav 는 deck 자체에 의존 — 별도 외부 nav 제공 안 함.
 */
export function HtmlPreview({ url, title }: Props) {
  return (
    <div className="flex flex-1 items-stretch justify-center bg-zinc-100 p-4 dark:bg-zinc-900">
      <iframe
        src={url}
        title={title}
        sandbox="allow-scripts"
        className="h-full w-full rounded border border-zinc-200 bg-white shadow-md dark:border-zinc-800"
      />
    </div>
  );
}
