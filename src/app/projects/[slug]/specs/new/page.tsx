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

/**
 * 새 Spec 생성 폼 — 우측 패널 (layout.tsx 셸 안).
 * breadcrumb 은 셸 header 가 처리 — 폼만 노출.
 */
export default async function NewSpecPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { folder: preselectedFolderId } = await searchParams;

  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const folders = await listFolders(project.id);

  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">새 Spec</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          타입을 정한 뒤 제목과 폴더를 입력합니다. 본문은 다음 화면에서.
        </p>
      </div>

      <form action={createSpec} className="space-y-4">
        <input type="hidden" name="projectId" value={project.id} />

        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
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
          <p className="text-[11px] text-zinc-500">
            PRD 6.3 — Feature Group 묶음, Feature 기능, Component / Tab / State 그 안의 단위.
          </p>
        </div>

        <div className="space-y-1.5">
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
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" size="sm">
            만들기
          </Button>
          <Link
            href={`/projects/${project.slug}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
