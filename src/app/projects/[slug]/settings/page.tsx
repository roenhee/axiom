import Link from "next/link";
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

export default async function ProjectSettingsPage({ params }: PageProps) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const archive = archiveProject.bind(null, project.id);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-8">
        <div className="mb-1 text-xs text-zinc-500">
          <Link href="/projects" className="hover:underline">
            프로젝트
          </Link>
          <span className="mx-1.5">/</span>
          <Link
            href={`/projects/${project.slug}`}
            className="hover:underline"
          >
            {project.slug}
          </Link>
          <span className="mx-1.5">/</span>
          <span>설정</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase text-zinc-500">
          이름 수정
        </h2>
        <form action={updateProject} className="space-y-4">
          <input type="hidden" name="id" value={project.id} />
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={100}
              defaultValue={project.name}
            />
          </div>
          <Button type="submit">저장</Button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase text-zinc-500">
          위험 영역
        </h2>
        <div className="rounded-lg border border-red-200 p-5 dark:border-red-900">
          <h3 className="font-medium">프로젝트 아카이브</h3>
          <p className="mt-1 text-sm text-zinc-500">
            아카이브하면 목록에서 사라집니다. 데이터는 그대로 보존되며 DB
            수동 조작으로 복구 가능 (UI 복구는 후속). slug 는 그대로 점유.
          </p>
          <form action={archive} className="mt-4">
            <Button type="submit" variant="destructive">
              이 프로젝트 아카이브
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
