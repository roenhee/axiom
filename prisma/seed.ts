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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
