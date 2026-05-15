"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

function validate(name: string, slug: string): string | null {
  if (name.length < 1 || name.length > 100) {
    return "name 은 1~100 자.";
  }
  if (slug.length < 2 || slug.length > 50) {
    return "slug 은 2~50 자.";
  }
  if (!SLUG_PATTERN.test(slug)) {
    return "slug 은 소문자/숫자/하이픈만 가능.";
  }
  return null;
}

/**
 * 새 프로젝트 생성 + 만든 사람을 ProjectOwner 로 자동 부여.
 * 성공 시 `/projects/<slug>` 로 리다이렉트.
 * slug 중복이면 throw — 폼에서 catch 해서 inline 표시 (1-B 는 단순 throw 만, UI 보강은 후속).
 */
export async function createProject(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();

  const err = validate(name, slug);
  if (err) throw new Error(err);

  const userId = await getCurrentUserId();

  const existing = await db.project.findUnique({ where: { slug } });
  if (existing) {
    throw new Error(`slug "${slug}" 는 이미 사용 중.`);
  }

  const project = await db.project.create({
    data: {
      name,
      slug,
      members: {
        create: {
          userId,
          level: "ProjectOwner",
        },
      },
      // D-031 — 모든 프로젝트에 "개발자 가이드" 예약 폴더 자동 생성.
      // 안에 들어가는 spec 들은 Phase 5 (PRD 16.7) Export 시 CLAUDE.md / AGENTS.md
      // prefix 로 조립되는 자리. isLocked 라 삭제/이름변경/이동 불가.
      folders: {
        create: {
          name: "개발자 가이드",
          parentId: null,
          order: 0,
          isLocked: true,
        },
      },
    },
    select: { slug: true },
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.slug}`);
}
