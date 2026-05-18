import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/server/projects/get-project";
import { listFolders } from "@/server/folders/list-folders";
import { listSpecs } from "@/server/specs/list-specs";
import { listAttachments } from "@/server/attachments/list-attachments";
import { ResizableShell } from "@/components/workspace-shell/ResizableShell";

interface LayoutProps {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

/**
 * 프로젝트 내부 워크스페이스 셸 (D-019/020/021/022/025).
 *
 * 데이터 로드 (server) → ResizableShell (client) 에 prop 으로 주입.
 * resize 상태는 client 가 localStorage 와 함께 관리.
 *
 * 같은 layout 안에서 child route 가 바뀌어도 좌/중앙 패널은 유지됨.
 */
export default async function ProjectLayout({ params, children }: LayoutProps) {
  const { slug } = await params;

  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [folders, specs, attachments] = await Promise.all([
    listFolders(project.id),
    listSpecs(project.id),
    listAttachments(project.id),
  ]);

  return (
    <ResizableShell
      projectId={project.id}
      projectName={project.name}
      projectSlug={project.slug}
      folders={folders}
      specs={specs.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        folderId: s.folderId,
        parentSpecId: s.parentSpecId,
        order: s.order,
      }))}
      attachments={attachments}
    >
      {children}
    </ResizableShell>
  );
}
