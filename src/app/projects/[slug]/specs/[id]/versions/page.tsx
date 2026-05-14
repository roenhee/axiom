import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpec } from "@/server/specs/get-spec";
import { listSpecVersions } from "@/server/spec-versions/list-spec-versions";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function VersionHistoryPage({ params }: PageProps) {
  const { slug, id } = await params;

  const spec = await getSpec(id);
  if (!spec || spec.project.slug !== slug) notFound();

  const versions = await listSpecVersions(spec.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <div className="mb-1 text-xs text-zinc-500">
          <Link href="/projects" className="hover:underline">
            프로젝트
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={`/projects/${spec.project.slug}`} className="hover:underline">
            {spec.project.slug}
          </Link>
          <span className="mx-1.5">/</span>
          <Link
            href={`/projects/${spec.project.slug}/specs/${spec.id}`}
            className="hover:underline"
          >
            {spec.title}
          </Link>
          <span className="mx-1.5">/</span>
          <span>버전</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {spec.title} — 버전 히스토리
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          총 {versions.length} 개. 최신 발행 순.
        </p>
      </header>

      {versions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          아직 발행된 버전이 없습니다. Spec 상세 페이지에서 발행해 보세요.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {versions.map((v) => (
            <li key={v.id}>
              <Link
                href={`/projects/${spec.project.slug}/specs/${spec.id}/versions/${v.id}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="w-12 shrink-0 font-mono text-sm text-zinc-700 dark:text-zinc-300">
                  {v.versionLabel}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded px-2 py-0.5 text-[10px] font-medium uppercase",
                    v.status === "Published" &&
                      "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
                    v.status === "Archived" &&
                      "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                    v.status === "Draft" &&
                      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
                  )}
                >
                  {v.status}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">
                    {v.changeSummary ?? (
                      <span className="text-zinc-400">(요약 없음)</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {v.changeType && (
                      <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                        {v.changeType}
                      </span>
                    )}
                    {v.createdBy.name ?? v.createdBy.email}
                  </div>
                </div>
                <time className="shrink-0 text-xs text-zinc-400">
                  {(v.publishedAt ?? v.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
