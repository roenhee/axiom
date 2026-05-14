import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpecVersion } from "@/server/spec-versions/get-spec-version";
import { archiveSpecVersion } from "@/server/spec-versions/archive-spec-version";
import { MarkdownView } from "@/components/markdown/MarkdownView";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string; id: string; versionId: string }>;
}

export default async function VersionDetailPage({ params }: PageProps) {
  const { slug, id, versionId } = await params;

  const version = await getSpecVersion(versionId);
  if (
    !version ||
    version.spec.id !== id ||
    version.spec.project.slug !== slug
  ) {
    notFound();
  }

  const archiveAction = archiveSpecVersion.bind(null, version.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <div className="mb-1 text-xs text-zinc-500">
          <Link href="/projects" className="hover:underline">
            프로젝트
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={`/projects/${slug}`} className="hover:underline">
            {slug}
          </Link>
          <span className="mx-1.5">/</span>
          <Link
            href={`/projects/${slug}/specs/${id}`}
            className="hover:underline"
          >
            {version.spec.title}
          </Link>
          <span className="mx-1.5">/</span>
          <Link
            href={`/projects/${slug}/specs/${id}/versions`}
            className="hover:underline"
          >
            버전
          </Link>
          <span className="mx-1.5">/</span>
          <span>{version.versionLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg text-zinc-700 dark:text-zinc-300">
            {version.versionLabel}
          </span>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium uppercase",
              version.status === "Published" &&
                "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
              version.status === "Archived" &&
                "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
              version.status === "Draft" &&
                "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
            )}
          >
            {version.status}
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            {version.spec.title}
          </h1>
        </div>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-500">발행 시각</dt>
          <dd>
            {(version.publishedAt ?? version.createdAt).toISOString()}
          </dd>
          <dt className="text-zinc-500">발행자</dt>
          <dd>{version.createdBy.name ?? version.createdBy.email}</dd>
          <dt className="text-zinc-500">변경 유형</dt>
          <dd>{version.changeType ?? "(없음)"}</dd>
          <dt className="text-zinc-500">변경 요약</dt>
          <dd>{version.changeSummary ?? "(없음)"}</dd>
        </dl>
      </header>

      <section className="mb-8 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-medium uppercase text-zinc-500">
          본문 스냅샷
        </h2>
        <MarkdownView markdown={version.markdown} />
      </section>

      {version.status !== "Archived" && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase text-zinc-500">
            상태 변경
          </h2>
          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h3 className="font-medium">아카이브</h3>
            <p className="mt-1 text-sm text-zinc-500">
              PRD 7.5 — 더 이상 사용하지 않는 과거 버전. 발행 자체는 보존됩니다.
            </p>
            <form action={archiveAction} className="mt-4">
              <Button type="submit" variant="outline">
                Archived 로 변경
              </Button>
            </form>
          </div>
        </section>
      )}
    </main>
  );
}
