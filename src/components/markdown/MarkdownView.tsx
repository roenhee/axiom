import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface Props {
  markdown: string;
  className?: string;
}

/**
 * 읽기 전용 Markdown 렌더. react-markdown + GFM (테이블, 체크박스, autolink).
 * @tailwindcss/typography 의 prose 클래스로 스타일링.
 *
 * 에디터 (SpecEditor) 와 다른 라이브러리지만, 둘 다 prose 클래스를 쓰므로 시각적으로 일치.
 */
export function MarkdownView({ markdown, className }: Props) {
  if (!markdown.trim()) {
    return (
      <div
        className={cn(
          "text-sm text-zinc-500 dark:text-zinc-400",
          className,
        )}
      >
        (본문 없음)
      </div>
    );
  }
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
