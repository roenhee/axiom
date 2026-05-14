import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/server/projects/get-project";
import { listFolders } from "@/server/folders/list-folders";
import { createSpec } from "@/server/specs/create-spec";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpecType } from "@/generated/prisma/enums";

const TYPE_OPTIONS: { value: keyof typeof SpecType; label: string }[] = [
  { value: "FeatureGroup", label: "Feature Group (Epic)" },
  { value: "Feature", label: "Feature" },
  { value: "Component", label: "Component" },
  { value: "Tab", label: "Tab" },
  { value: "State", label: "State" },
];

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ folder?: string }>;
}

export default async function NewSpecPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { folder: preselectedFolderId } = await searchParams;

  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const folders = await listFolders(project.id);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-6">
        <div className="mb-1 text-xs text-zinc-500">
          <Link href="/projects" className="hover:underline">
            프로젝트
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={`/projects/${project.slug}`} className="hover:underline">
            {project.slug}
          </Link>
          <span className="mx-1.5">/</span>
          <span>새 Spec</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">새 Spec</h1>
        <p className="mt-1 text-sm text-zinc-500">
          타입을 정한 뒤 제목과 위치(폴더)를 입력합니다. 본문은 다음 화면에서.
        </p>
      </header>

      <form action={createSpec} className="space-y-5">
        <input type="hidden" name="projectId" value={project.id} />

        <div className="space-y-2">
          <Label htmlFor="title">제목</Label>
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
            placeholder="예: 가격 필터 기본 상태"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">타입</Label>
          <select
            id="type"
            name="type"
            required
            defaultValue="Feature"
            className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">
            PRD 6.3 — Feature Group 은 묶음, Feature 는 기능, Component / Tab / State 는 그 안의 단위.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="folderId">폴더</Label>
          <select
            id="folderId"
            name="folderId"
            defaultValue={preselectedFolderId ?? ""}
            className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
          >
            <option value="">(루트)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">
            폴더는 탐색용 — 시스템 동작은 type 과 관계 정보로 결정 (PRD 6.2).
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">만들기</Button>
          <Link
            href={`/projects/${project.slug}`}
            className={buttonVariants({ variant: "ghost" })}
          >
            취소
          </Link>
        </div>
      </form>
    </main>
  );
}
