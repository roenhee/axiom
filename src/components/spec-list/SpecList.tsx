import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SpecListItem } from "@/server/specs/list-specs";
import type { FolderNode } from "@/server/folders/list-folders";

interface Props {
  projectSlug: string;
  specs: SpecListItem[];
  folders: FolderNode[];
}

const TYPE_LABEL: Record<SpecListItem["type"], string> = {
  FeatureGroup: "Feature Group",
  Feature: "Feature",
  Component: "Component",
  Tab: "Tab",
  State: "State",
};

const TYPE_TONE: Record<SpecListItem["type"], string> = {
  FeatureGroup:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  Feature: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  Component:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  Tab: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  State: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};

export function SpecList({ projectSlug, specs, folders }: Props) {
  const folderNameById = new Map(folders.map((f) => [f.id, f.name]));

  // 폴더별 그룹화 — 키는 folderId(null이면 "")
  const byFolder = new Map<string, SpecListItem[]>();
  for (const s of specs) {
    const key = s.folderId ?? "";
    const arr = byFolder.get(key) ?? [];
    arr.push(s);
    byFolder.set(key, arr);
  }

  // 그룹 출력 순서: 루트 먼저, 그다음 폴더 이름 순
  const groupKeys = [...byFolder.keys()].sort((a, b) => {
    if (a === "") return -1;
    if (b === "") return 1;
    const aName = folderNameById.get(a) ?? "";
    const bName = folderNameById.get(b) ?? "";
    return aName.localeCompare(bName);
  });

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Spec
        </h2>
        <Link
          href={`/projects/${projectSlug}/specs/new`}
          className={buttonVariants({ size: "xs" })}
        >
          + 새 Spec
        </Link>
      </header>

      {specs.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-zinc-500">
          아직 Spec 이 없어요. &ldquo;+ 새 Spec&rdquo; 으로 시작하세요.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {groupKeys.map((key) => {
            const groupSpecs = byFolder.get(key) ?? [];
            const groupLabel =
              key === "" ? "루트" : folderNameById.get(key) ?? "(이동된 폴더)";
            return (
              <div key={key}>
                <div className="bg-zinc-50 px-4 py-1.5 text-xs font-medium text-zinc-500 dark:bg-zinc-900/50">
                  {groupLabel}
                </div>
                <ul>
                  {groupSpecs.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/projects/${projectSlug}/specs/${s.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            TYPE_TONE[s.type],
                          )}
                        >
                          {TYPE_LABEL[s.type]}
                        </span>
                        <span className="flex-1 truncate">{s.title}</span>
                        <time className="shrink-0 text-xs text-zinc-400">
                          {s.updatedAt.toISOString().slice(0, 10)}
                        </time>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

    </section>
  );
}
