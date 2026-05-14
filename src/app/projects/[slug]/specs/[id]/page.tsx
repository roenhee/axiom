import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpec } from "@/server/specs/get-spec";
import { listFolders } from "@/server/folders/list-folders";
import { updateSpec } from "@/server/specs/update-spec";
import { deleteSpec } from "@/server/specs/delete-spec";
import { getLatestRevisionMarkdown } from "@/server/revisions/get-latest-revision";
import { listSpecVersions } from "@/server/spec-versions/list-spec-versions";
import { publishSpecVersion } from "@/server/spec-versions/publish-spec-version";
import { SpecEditor } from "@/components/spec-editor/SpecEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpecType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: { value: keyof typeof SpecType; label: string }[] = [
  { value: "FeatureGroup", label: "Feature Group (Epic)" },
  { value: "Feature", label: "Feature" },
  { value: "Component", label: "Component" },
  { value: "Tab", label: "Tab" },
  { value: "State", label: "State" },
];

function computeNextLabel(existing: string[]): string {
  let max = 0;
  for (const label of existing) {
    const m = /^v(\d+)$/.exec(label);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `v${max + 1}`;
}

const TYPE_TONE: Record<string, string> = {
  FeatureGroup:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  Feature: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  Component:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  Tab: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  State: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function SpecDetailPage({ params }: PageProps) {
  const { slug, id } = await params;

  const spec = await getSpec(id);
  if (!spec || spec.project.slug !== slug) notFound();

  const [folders, initialMarkdown, versions] = await Promise.all([
    listFolders(spec.project.id),
    getLatestRevisionMarkdown(spec.id),
    listSpecVersions(spec.id),
  ]);
  const deleteAction = deleteSpec.bind(null, spec.id);
  const recentVersions = versions.slice(0, 3);
  const nextLabel = computeNextLabel(versions.map((v) => v.versionLabel));

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
          <span>{spec.id.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              TYPE_TONE[spec.type],
            )}
          >
            {spec.type}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{spec.title}</h1>
        </div>
      </header>

      <section className="mb-8 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          메타데이터
        </div>
        <form action={updateSpec} className="space-y-5 p-5">
          <input type="hidden" name="id" value={spec.id} />

          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              defaultValue={spec.title}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">타입</Label>
            <select
              id="type"
              name="type"
              required
              defaultValue={spec.type}
              className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="folderId">폴더</Label>
            <select
              id="folderId"
              name="folderId"
              defaultValue={spec.folderId ?? ""}
              className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
            >
              <option value="">(루트)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit">저장</Button>
        </form>
      </section>

      <section className="mb-8">
        <SpecEditor specId={spec.id} initialMarkdown={initialMarkdown} />
      </section>

      <section className="mb-8 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            버전 발행
          </h2>
          <Link
            href={`/projects/${spec.project.slug}/specs/${spec.id}/versions`}
            className="text-xs text-zinc-500 hover:underline"
          >
            전체 히스토리 ({versions.length}) →
          </Link>
        </div>

        <form action={publishSpecVersion} className="space-y-4 p-5">
          <input type="hidden" name="specId" value={spec.id} />

          <p className="text-xs text-zinc-500">
            현재 저장된 본문을 <strong>{nextLabel}</strong> 으로 박아둡니다.
            편집 중 타이핑은 발행 전에 자동저장 (30 초 또는 다른 영역 클릭) 이 끝나야 반영됩니다.
          </p>

          <div className="space-y-2">
            <Label htmlFor="changeSummary">변경 요약 (선택)</Label>
            <Input
              id="changeSummary"
              name="changeSummary"
              maxLength={200}
              placeholder="예: validation 에러 상태 추가"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="changeType">변경 유형 (선택)</Label>
            <Input
              id="changeType"
              name="changeType"
              maxLength={50}
              placeholder="예: feature / fix / refactor"
            />
          </div>

          <Button type="submit">{nextLabel} 발행</Button>
        </form>

        {recentVersions.length > 0 && (
          <div className="border-t border-zinc-100 dark:border-zinc-900">
            <div className="px-4 py-2 text-xs font-medium text-zinc-500">
              최근 버전
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {recentVersions.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/projects/${spec.project.slug}/specs/${spec.id}/versions/${v.id}`}
                    className="flex items-center gap-3 px-4 py-2 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="font-mono text-xs text-zinc-500">
                      {v.versionLabel}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
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
                    <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                      {v.changeSummary ?? "(요약 없음)"}
                    </span>
                    <time className="shrink-0 text-xs text-zinc-400">
                      {(v.publishedAt ?? v.createdAt).toISOString().slice(0, 10)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase text-zinc-500">
          위험 영역
        </h2>
        <div className="rounded-lg border border-red-200 p-5 dark:border-red-900">
          <h3 className="font-medium">Spec 삭제</h3>
          <p className="mt-1 text-sm text-zinc-500">
            연결된 Version / Revision / 관계 정보도 함께 영구 삭제됩니다.
          </p>
          <form action={deleteAction} className="mt-4">
            <Button type="submit" variant="destructive">
              이 Spec 삭제
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
