import Link from "next/link";
import { listMyProjects } from "@/server/projects/list-projects";
import { buttonVariants } from "@/components/ui/button";

export default async function ProjectsPage() {
  const projects = await listMyProjects();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">프로젝트</h1>
          <p className="mt-1 text-sm text-zinc-500">
            내가 멤버로 등록된 프로젝트 목록
          </p>
        </div>
        <Link href="/projects/new" className={buttonVariants()}>
          새 프로젝트
        </Link>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">
            아직 프로젝트가 없어요. 새 프로젝트를 만들어 시작하세요.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.slug}`}
                className="flex items-center justify-between px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    /{p.slug}
                  </div>
                </div>
                <time className="text-xs text-zinc-400">
                  {p.updatedAt.toISOString().slice(0, 10)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
