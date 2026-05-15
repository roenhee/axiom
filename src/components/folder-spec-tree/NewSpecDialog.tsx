"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSpec } from "@/server/specs/create-spec";
import type { FolderNode } from "@/server/folders/list-folders";
import type { SpecNode } from "./FolderSpecTree";

const TYPE_OPTIONS = [
  { value: "FeatureGroup", label: "Feature Group (Epic)" },
  { value: "Feature", label: "Feature" },
  { value: "Component", label: "Component" },
  { value: "Tab", label: "Tab" },
  { value: "State", label: "State" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  folders: FolderNode[];
  specs: SpecNode[];
  /** 폴더에 새 Spec 만들 때 (parentSpecId 없음). */
  preselectedFolderId?: string | null;
  /** 부모 Spec 밑에 새 Spec 만들 때 (folderId 무시, 부모 따라감). */
  preselectedParentSpecId?: string | null;
}

/**
 * 새 Spec 생성 모달. AddMenu 의 "Spec" 선택 시 열림.
 * 폴더 행에서 열면 그 폴더가 pre-select.
 *
 * 성공 시 모달 닫고 새 Spec 상세로 router.push — 셸 layout 은 유지되므로
 * 좌측 트리 / 가운데 placeholder 그대로, 우측만 새 Spec 으로 갱신됨.
 */
export function NewSpecDialog({
  open,
  onClose,
  projectId,
  folders,
  specs,
  preselectedFolderId,
  preselectedParentSpecId,
}: Props) {
  const parentSpec = preselectedParentSpecId
    ? specs.find((s) => s.id === preselectedParentSpecId) ?? null
    : null;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 모달 열릴 때마다 error 초기화
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const { projectSlug, specId } = await createSpec(formData);
        onClose();
        router.push(`/projects/${projectSlug}/specs/${specId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "생성 실패");
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="새 Spec" size="md">
      <form action={handleSubmit} className="space-y-4 p-5">
        <input type="hidden" name="projectId" value={projectId} />
        {parentSpec && (
          <input
            type="hidden"
            name="parentSpecId"
            value={parentSpec.id}
          />
        )}

        {parentSpec && (
          <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            부모 Spec: <strong>{parentSpec.title}</strong>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="newspec-title">제목</Label>
          <Input
            id="newspec-title"
            name="title"
            required
            maxLength={200}
            placeholder="예: 가격 필터 기본 상태"
            autoFocus
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newspec-type">타입</Label>
          <select
            id="newspec-type"
            name="type"
            required
            defaultValue="Feature"
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500">
            PRD 6.3 — Feature Group 묶음, Feature 기능, Component / Tab / State 그 안의 단위.
          </p>
        </div>

        {!parentSpec && (
          <div className="space-y-1.5">
            <Label htmlFor="newspec-folder">폴더</Label>
            <select
              id="newspec-folder"
              name="folderId"
              defaultValue={preselectedFolderId ?? ""}
              disabled={pending}
              className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition focus-visible:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-zinc-700"
            >
              <option value="">(루트)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={pending}
          >
            취소
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "만드는 중…" : "만들기"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
