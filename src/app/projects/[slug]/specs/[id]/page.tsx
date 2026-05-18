import { notFound } from "next/navigation";
import { getSpec } from "@/server/specs/get-spec";
import { listFolders } from "@/server/folders/list-folders";
import { getLatestRevisionMarkdown } from "@/server/revisions/get-latest-revision";
import { getLatestApiSpec } from "@/server/revisions/get-latest-api-spec";
import { listSpecVersions } from "@/server/spec-versions/list-spec-versions";
import { listSpecs } from "@/server/specs/list-specs";
import { listSpecRelations } from "@/server/spec-relations/list-spec-relations";
import { SpecTabs } from "@/components/spec-tabs/SpecTabs";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

function computeNextLabel(existing: string[]): string {
  let max = 0;
  for (const label of existing) {
    const m = /^v(\d+)$/.exec(label);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `v${max + 1}`;
}

/**
 * Spec 상세 — 우측 패널 (layout.tsx 의 3-pane 셸 안).
 * 본문 / 메타 / 관계 / 히스토리 4개 탭 (D-019).
 */
export default async function SpecDetailPage({ params }: PageProps) {
  const { slug, id } = await params;

  const spec = await getSpec(id);
  if (!spec || spec.project.slug !== slug) notFound();

  const [folders, initialMarkdown, initialApiSpec, versions, relations, allSpecs] =
    await Promise.all([
      listFolders(spec.project.id),
      getLatestRevisionMarkdown(spec.id),
      getLatestApiSpec(spec.id),
      listSpecVersions(spec.id),
      listSpecRelations(spec.id),
      listSpecs(spec.project.id),
    ]);

  const nextLabel = computeNextLabel(versions.map((v) => v.versionLabel));
  const otherSpecs = allSpecs
    .filter((s) => s.id !== spec.id)
    .map((s) => ({ id: s.id, title: s.title, type: s.type }));

  return (
    <SpecTabs
      spec={{
        id: spec.id,
        projectId: spec.project.id,
        title: spec.title,
        type: spec.type,
        folderId: spec.folderId,
      }}
      initialMarkdown={initialMarkdown}
      initialApiSpec={initialApiSpec}
      folders={folders}
      versions={versions}
      nextLabel={nextLabel}
      relations={relations}
      otherSpecs={otherSpecs}
    />
  );
}
