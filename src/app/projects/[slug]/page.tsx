import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/server/projects/get-project";
import { listSpecs } from "@/server/specs/list-specs";
import { buttonVariants } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 워크스페이스의 빈 상태 — Spec 미선택.
 * 셸의 우측 패널 안에 렌더된다.
 */
export default async function ProjectWorkspacePage({ params }: PageProps) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const specs = await listSpecs(project.id);
  const isEmpty = specs.length === 0;

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-12 text-center">
      <div className="max-w-xs space-y-3">
        <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {isEmpty ? "이 프로젝트에 아직 Spec 이 없어요" : "Spec 을 선택하세요"}
        </div>
        <p className="text-xs text-zinc-500">
          {isEmpty
            ? "좌측에서 폴더와 Spec 을 만들어 시작하세요. 폴더는 자유 탐색용, 시스템 동작은 Spec 의 type 과 관계로 결정됩니다."
            : "좌측 트리에서 Spec 을 클릭하면 본문과 메타가 여기에 표시됩니다."}
        </p>
        {isEmpty && (
          <Link
            href={`/projects/${project.slug}/specs/new`}
            className={buttonVariants({ size: "sm" })}
          >
            첫 Spec 만들기
          </Link>
        )}
      </div>
    </div>
  );
}
