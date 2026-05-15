import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/server/projects/get-project";
import { listFolders } from "@/server/folders/list-folders";
import { listSpecs } from "@/server/specs/list-specs";
import { FolderSpecTree } from "@/components/folder-spec-tree/FolderSpecTree";
import { CenterPane } from "@/components/center-pane/CenterPane";
import { buttonVariants } from "@/components/ui/button";

interface LayoutProps {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

/**
 * 프로젝트 내부 워크스페이스 셸 (D-019/020/021).
 *
 * 좌측 — 폴더+Spec 통합 트리
 * 가운데 — 렌더링 뷰 토글 (Phase 2/3 에서 채워짐)
 * 우측 — 현재 라우트의 콘텐츠 (project 페이지 / spec 페이지 / settings / new-spec)
 *
 * 같은 layout 안에서 child route 가 바뀌어도 좌/중앙 패널은 유지됨.
 */
export default async function ProjectLayout({ params, children }: LayoutProps) {
  const { slug } = await params;

  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [folders, specs] = await Promise.all([
    listFolders(project.id),
    listSpecs(project.id),
  ]);

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-zinc-950">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-2.5 dark:border-zinc-800">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400">
            <Link href="/projects" className="hover:text-zinc-600 hover:underline">
              프로젝트
            </Link>
            <span className="mx-1.5">/</span>
            <span>{project.slug}</span>
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {project.name}
          </h1>
        </div>
        <Link
          href={`/projects/${project.slug}/settings`}
          className={buttonVariants({ variant: "outline", size: "xs" })}
        >
          설정
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_520px]">
        <aside className="min-h-0 border-r border-zinc-200 dark:border-zinc-800">
          <FolderSpecTree
            projectId={project.id}
            projectSlug={project.slug}
            folders={folders}
            specs={specs.map((s) => ({
              id: s.id,
              title: s.title,
              type: s.type,
              folderId: s.folderId,
            }))}
          />
        </aside>
        <section className="min-h-0 overflow-y-auto bg-zinc-50/60 dark:bg-zinc-900/30">
          <CenterPane />
        </section>
        <aside className="min-h-0 overflow-y-auto border-l border-zinc-200 dark:border-zinc-800">
          {children}
        </aside>
      </div>
    </div>
  );
}
