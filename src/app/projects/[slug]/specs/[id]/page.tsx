import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpec } from "@/server/specs/get-spec";
import { listFolders } from "@/server/folders/list-folders";
import { updateSpec } from "@/server/specs/update-spec";
import { deleteSpec } from "@/server/specs/delete-spec";
import { getLatestRevisionMarkdown } from "@/server/revisions/get-latest-revision";
import { listSpecVersions } from "@/server/spec-versions/list-spec-versions";
import { publishSpecVersion } from "@/server/spec-versions/publish-spec-version";
import { listSpecs } from "@/server/specs/list-specs";
import { listSpecRelations } from "@/server/spec-relations/list-spec-relations";
import { createSpecRelation } from "@/server/spec-relations/create-spec-relation";
import { deleteSpecRelation } from "@/server/spec-relations/delete-spec-relation";
import { SpecEditor } from "@/components/spec-editor/SpecEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpecType, SpecRelationType } from "@/generated/prisma/enums";
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

/** Phase 1 에서 Spec ↔ Spec 으로 의미가 명확한 3 종만 입력 허용.
 *  related_figma / related_slot / related_prototype_route / related_ai_task 는
 *  Phase 2~4 에서 별도 entity 가 등장하면 그에 맞춘 UI 로 추가. */
const RELATION_TYPE_OPTIONS: {
  value: keyof typeof SpecRelationType;
  label: string;
  description: string;
}[] = [
  { value: "contains", label: "포함 (contains)", description: "이 Spec 이 하위로 포함하는 문서" },
  { value: "depends_on", label: "의존 (depends_on)", description: "이 Spec 이 의존하는 다른 문서" },
  { value: "related_component", label: "관련 컴포넌트", description: "참조하는 Component Spec" },
];

const RELATION_LABEL: Record<string, string> = {
  contains: "포함",
  depends_on: "의존",
  related_component: "관련 컴포넌트",
  related_slot: "관련 Slot",
  related_figma: "관련 Figma",
  related_prototype_route: "관련 Prototype 경로",
  related_ai_task: "관련 AI Task",
};

const RELATION_REVERSE_LABEL: Record<string, string> = {
  contains: "포함됨",
  depends_on: "의존됨",
  related_component: "참조됨",
  related_slot: "참조됨",
  related_figma: "참조됨",
  related_prototype_route: "참조됨",
  related_ai_task: "참조됨",
};

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

  const [folders, initialMarkdown, versions, relations, allSpecs] =
    await Promise.all([
      listFolders(spec.project.id),
      getLatestRevisionMarkdown(spec.id),
      listSpecVersions(spec.id),
      listSpecRelations(spec.id),
      listSpecs(spec.project.id),
    ]);
  const deleteAction = deleteSpec.bind(null, spec.id);
  const recentVersions = versions.slice(0, 3);
  const nextLabel = computeNextLabel(versions.map((v) => v.versionLabel));
  const otherSpecs = allSpecs.filter((s) => s.id !== spec.id);

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
          <span>{spec.title}</span>
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

      <section className="mb-8 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            관계 정보
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            PRD 6.4 — 시스템과 AI 가 사용하는 구조화 정보. Figma / Slot / Prototype 경로 / AI Task
            는 해당 Phase 진입 시 별도 UI 로 추가.
          </p>
        </div>

        <form action={createSpecRelation} className="space-y-3 border-b border-zinc-100 p-5 dark:border-zinc-900">
          <input type="hidden" name="fromId" value={spec.id} />
          <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
            <select
              name="type"
              required
              defaultValue="contains"
              className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
            >
              {RELATION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              name="toId"
              required
              defaultValue=""
              className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
              disabled={otherSpecs.length === 0}
            >
              <option value="" disabled>
                {otherSpecs.length === 0 ? "프로젝트에 다른 Spec 이 없음" : "대상 Spec 선택"}
              </option>
              {otherSpecs.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.type}] {s.title}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={otherSpecs.length === 0}>
              관계 추가
            </Button>
          </div>
        </form>

        {relations.outgoing.length === 0 && relations.incoming.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-500">
            아직 등록된 관계가 없습니다.
          </div>
        ) : (
          <div>
            {relations.outgoing.length > 0 && (
              <div className="border-b border-zinc-100 dark:border-zinc-900">
                <div className="bg-zinc-50 px-4 py-1.5 text-xs font-medium text-zinc-500 dark:bg-zinc-900/50">
                  이 Spec 으로부터 →
                </div>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {relations.outgoing.map((r) => {
                    const removeAction = deleteSpecRelation.bind(null, r.id);
                    return (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm"
                      >
                        <span className="w-32 shrink-0 text-xs font-medium text-zinc-500">
                          {RELATION_LABEL[r.type] ?? r.type}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            TYPE_TONE[r.other.type],
                          )}
                        >
                          {r.other.type}
                        </span>
                        <Link
                          href={`/projects/${spec.project.slug}/specs/${r.other.id}`}
                          className="flex-1 truncate hover:underline"
                        >
                          {r.other.title}
                        </Link>
                        <form action={removeAction}>
                          <Button
                            type="submit"
                            size="xs"
                            variant="ghost"
                            title="관계 삭제"
                          >
                            ✕
                          </Button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {relations.incoming.length > 0 && (
              <div>
                <div className="bg-zinc-50 px-4 py-1.5 text-xs font-medium text-zinc-500 dark:bg-zinc-900/50">
                  ← 이 Spec 을 참조하는 곳 (읽기 전용)
                </div>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {relations.incoming.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm"
                    >
                      <span className="w-32 shrink-0 text-xs font-medium text-zinc-500">
                        {RELATION_REVERSE_LABEL[r.type] ?? r.type}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          TYPE_TONE[r.other.type],
                        )}
                      >
                        {r.other.type}
                      </span>
                      <Link
                        href={`/projects/${spec.project.slug}/specs/${r.other.id}`}
                        className="flex-1 truncate hover:underline"
                      >
                        {r.other.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
