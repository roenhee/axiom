import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL 환경변수가 비어 있다.");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  // 1. Dev seed user (D-010)
  const email = process.env.DEV_USER_EMAIL ?? "dev@local";
  const name = process.env.DEV_USER_NAME ?? "Dev User";

  const user = await db.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });
  console.log(`✓ Dev user 준비됨: ${user.email} (id=${user.id})`);

  // 2. 샘플 빈 프로젝트 — 1-B 들어가서 UI 띄울 때 보일 첫 데이터
  const sampleProject = await db.project.upsert({
    where: { slug: "sample" },
    update: {},
    create: {
      name: "샘플 프로젝트",
      slug: "sample",
      members: {
        create: {
          userId: user.id,
          level: "ProjectOwner",
        },
      },
    },
  });
  console.log(
    `✓ Sample project 준비됨: ${sampleProject.name} (slug=${sampleProject.slug})`,
  );

  // 3. "개발자 가이드" 예약 폴더 — 모든 프로젝트가 가져야 함 (D-031). 기존 프로젝트엔 backfill.
  let devGuideFolder = await db.folder.findFirst({
    where: { projectId: sampleProject.id, isLocked: true },
    select: { id: true },
  });
  if (!devGuideFolder) {
    devGuideFolder = await db.folder.create({
      data: {
        projectId: sampleProject.id,
        parentId: null,
        name: "개발자 가이드",
        order: 0,
        isLocked: true,
      },
      select: { id: true },
    });
    console.log("✓ 개발자 가이드 폴더 backfill");
  }

  // 4. 샘플 프로젝트 한정: 개발자 가이드 안에 starter spec 1개 (없을 때만).
  // 일반 새 프로젝트는 빈 폴더로 시작 — 샘플은 사용자가 "어떻게 채우는지" 보이도록 1개 시드.
  const existingDevSpec = await db.spec.findFirst({
    where: { folderId: devGuideFolder.id },
    select: { id: true },
  });
  if (!existingDevSpec) {
    const placeholderMarkdown = `# 프로젝트 안내

이 문서는 Claude / Codex 같은 AI 에이전트가 프로젝트를 빠르게 이해하도록
돕기 위해 작성합니다. Phase 5 의 Developer Export 시 자동으로 CLAUDE.md /
AGENTS.md 의 prefix 로 들어갑니다.

## 도메인 / 용어
(여기 채우기)

## 코딩 컨벤션
(여기 채우기)

## 자주 쓰이는 API
(여기 채우기)

## 주의 사항
(여기 채우기)
`;
    const starterSpec = await db.spec.create({
      data: {
        projectId: sampleProject.id,
        folderId: devGuideFolder.id,
        title: "프로젝트 안내",
        type: "Feature",
      },
      select: { id: true },
    });
    await db.revision.create({
      data: {
        specId: starterSpec.id,
        markdown: placeholderMarkdown,
        authorId: user.id,
      },
    });
    console.log("✓ 샘플 개발자 가이드 starter spec 추가");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
