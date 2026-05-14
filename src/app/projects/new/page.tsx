import Link from "next/link";
import { createProject } from "@/server/projects/create-project";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewProjectPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">새 프로젝트</h1>
        <p className="mt-1 text-sm text-zinc-500">
          기획서를 모을 새 워크스페이스를 만듭니다.
        </p>
      </header>

      <form action={createProject} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">이름</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={100}
            placeholder="예: 검색팀 프로젝트"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">slug</Label>
          <Input
            id="slug"
            name="slug"
            required
            minLength={2}
            maxLength={50}
            pattern="[a-z0-9\-]+"
            placeholder="예: search-team"
          />
          <p className="text-xs text-zinc-500">
            URL 에 들어가는 식별자. 소문자/숫자/하이픈만. 나중에 변경 어려움.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">만들기</Button>
          <Link href="/projects" className={buttonVariants({ variant: "ghost" })}>
            취소
          </Link>
        </div>
      </form>
    </main>
  );
}
