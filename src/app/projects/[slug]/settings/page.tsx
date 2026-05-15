import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/server/projects/get-project";
import { updateProject } from "@/server/projects/update-project";
import { archiveProject } from "@/server/projects/archive-project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 프로젝트 설정 — 우측 패널 (layout.tsx 셸 안).
 * 상단 breadcrumb / 제목은 셸 header 가 이미 보여줌 — 페이지는 본문만.
 */
export default async function ProjectSettingsPage({ params }: PageProps) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const archive = archiveProject.bind(null, project.id);

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">설정</h2>
        <p className="mt-0.5 text-xs text-zinc-500">프로젝트 메타 변경.</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          이름 수정
        </h3>
        <form action={updateProject} className="space-y-3">
          <input type="hidden" name="id" value={project.id} />
          <div className="space-y-1.5">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={100}
              defaultValue={project.name}
            />
          </div>
          <Button type="submit" size="sm">
            저장
          </Button>
        </form>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          위험 영역
        </h3>
        <div className="rounded-md border border-red-200 p-4 dark:border-red-900">
          <h4 className="text-sm font-medium">프로젝트 아카이브</h4>
          <p className="mt-1 text-xs text-zinc-500">
            아카이브하면 목록에서 사라집니다. 데이터는 보존되며 DB 수동 조작으로
            복구 가능. slug 는 그대로 점유.
          </p>
          <form action={archive} className="mt-3">
            <Button type="submit" variant="destructive" size="sm">
              이 프로젝트 아카이브
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
