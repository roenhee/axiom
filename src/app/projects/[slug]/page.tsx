import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/server/projects/get-project";
import { buttonVariants } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-1 text-xs text-zinc-500">
            <Link href="/projects" className="hover:underline">
              프로젝트
            </Link>
            <span className="mx-1.5">/</span>
            <span>{project.slug}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
        </div>
        <Link
          href={`/projects/${project.slug}/settings`}
          className={buttonVariants({ variant: "outline" })}
        >
          설정
        </Link>
      </header>

      <section className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <h2 className="font-medium">아직 폴더나 Spec 이 없어요</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Phase 1-C / 1-D 에서 폴더 트리와 Spec 생성이 붙으면 여기에 표시됩니다.
        </p>
      </section>
    </main>
  );
}
