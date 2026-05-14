import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/server/projects/get-project";
import { listFolders } from "@/server/folders/list-folders";
import { listSpecs } from "@/server/specs/list-specs";
import { FolderTree } from "@/components/folder-tree/FolderTree";
import { SpecList } from "@/components/spec-list/SpecList";
import { buttonVariants } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [folders, specs] = await Promise.all([
    listFolders(project.id),
    listSpecs(project.id),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
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

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <aside>
          <FolderTree projectId={project.id} folders={folders} />
        </aside>
        <SpecList
          projectSlug={project.slug}
          specs={specs}
          folders={folders}
        />
      </div>
    </main>
  );
}
