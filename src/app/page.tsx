import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        Project Axiom
      </h1>
      <p className="text-sm text-zinc-500">Phase 1 — Spec 계층 + Version</p>
      <Link href="/projects" className={buttonVariants()}>
        프로젝트 목록 보기 →
      </Link>
      <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-zinc-500">현재 사용자 (dev seed)</div>
        <div className="mt-1 font-medium">{user.name ?? "(이름 없음)"}</div>
        <div className="text-xs text-zinc-500">{user.email}</div>
        <div className="mt-2 text-xs text-zinc-400">id: {user.id}</div>
      </div>
      <p className="max-w-md text-center text-xs text-zinc-500">
        사내 SSO 붙기 전까지 src/lib/auth/current-user.ts 가 항상 이 user 를
        반환합니다. (CLAUDE.md 로그인 우회 전략 A, docs/decisions.md D-010)
      </p>
    </main>
  );
}
