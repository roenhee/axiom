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

  // 5. 예시 Spec 3개 — 샘플 프로젝트 루트에. 이미 있으면 건너뜀 (idempotent).
  await seedExampleSpecs(db, sampleProject.id, user.id);
}

// ============================================================
// 예시 Spec 3개 (D-040)
// 본문 마크다운은 툴바/preview 가 다루는 양식 (제목/표/체크리스트/코드 등) 골고루
// 포함하도록 작성 — 새 사용자가 "어떤 형식이 가능한지" 한눈에 보도록.
// ============================================================

const EXAMPLE_SPECS: {
  title: string;
  type: "FeatureGroup" | "Feature" | "Component" | "State";
  markdown: string;
}[] = [
  {
    title: "사용자 로그인",
    type: "Feature",
    markdown: `# 사용자 로그인

이메일 + 비밀번호로 로그인하는 표준 인증 플로우.

## 목적

- 기존 사용자가 자신의 계정으로 접속할 수 있게 한다.
- 잘못된 자격 증명 / 잠금된 계정 등 실패 케이스를 명확히 안내한다.

## 화면 구성

| 영역 | 내용 |
|---|---|
| 헤더 | 로고, "회원가입" 링크 |
| 본문 | 이메일 입력, 비밀번호 입력, 로그인 버튼 |
| 푸터 | "비밀번호 찾기", 약관 링크 |

## 입력 검증

- 이메일: \`^[^@\s]+@[^@\s]+\.[^@\s]+$\` 형식 일치
- 비밀번호: 1자 이상 (로그인 시점에는 강도 검증 X — 가입에서 검증)

## 동작

\`\`\`ts
async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new AuthError(await res.text());
  return res.json();
}
\`\`\`

## 실패 모드

- [ ] 잘못된 이메일 / 비밀번호 → "이메일 또는 비밀번호가 일치하지 않습니다"
- [ ] 5회 연속 실패 → 계정 15분 잠금
- [ ] 잠긴 계정 → "잠시 후 다시 시도해 주세요"
- [ ] 네트워크 오류 → "연결을 확인하고 다시 시도해 주세요"

## 성공 후 동작

> 로그인 직후 마지막으로 보던 페이지로 복귀. 처음 접속이라면 \`/dashboard\`.

## 관련 Spec

- [회원가입](./signup) — 신규 사용자
- [비밀번호 찾기](./password-reset) — 잊은 비밀번호 복구
`,
  },
  {
    title: "검색 결과 페이지",
    type: "Feature",
    markdown: `# 검색 결과 페이지

상단 검색바에서 키워드를 입력하면 도달하는 페이지.

## 목적

- **빠른 결과 표시** — 쿼리 후 200ms 이내에 첫 결과 그룹 노출
- **단계별 필터** — 사용자가 결과 너무 많아도 점진적으로 좁히도록

## 정보 구조

1. 상단: 검색바 (현재 쿼리 표시, 수정 가능)
2. 좌측: 필터 패널 (카테고리, 날짜, 작성자)
3. 중앙: 결과 리스트 — 페이지당 20건
4. 우측: 미리보기 (선택한 결과 상세)

## 결과 타입별 카드 디자인

| 타입 | 핵심 표시 | 부가 표시 |
|---|---|---|
| 문서 | 제목, 본문 요약 1줄 | 작성자, 날짜 |
| 사용자 | 이름, 직책 | 부서, 마지막 활동 |
| 첨부파일 | 파일명, 아이콘 | 크기, 업로드 날짜 |

## 정렬 옵션

- **관련도** *(기본)* — TF-IDF + 최근 활동 가중치
- **최신순** — 작성일 내림차순
- **이름순** — 가나다 오름차순

## 빈 결과 처리

쿼리에 매칭되는 항목이 0건이면:

> "*\\\`{query}\\\`* 에 일치하는 결과가 없습니다."

및 다음 제안 표시:
- 가까운 철자 추천 (편집거리 ≤ 2)
- 인기 키워드 5개 (이번 주 기준)

## 키보드 단축키

- \`↑\` / \`↓\` — 결과 이동
- \`Enter\` — 선택한 결과 열기
- \`/\` — 검색바로 포커스 이동
- \`Esc\` — 검색 닫고 이전 페이지

## 체크리스트 (구현 전 확인)

- [ ] 빈 쿼리(\`""\`)는 검색 API 호출 안 함
- [ ] 200자 초과 쿼리는 입력 시점에 잘라냄
- [ ] 결과 리스트 가상 스크롤로 렌더 (10K건 이상 가정)
- [ ] 검색 분석 로그 수집 (쿼리, 결과 수, 클릭한 결과)
`,
  },
  {
    title: "프로필 카드",
    type: "Component",
    markdown: `# 프로필 카드 컴포넌트

사용자 정보를 압축적으로 보여주는 재사용 카드.

## 사용처

| 화면 | 사이즈 | 비고 |
|---|---|---|
| 검색 결과 (사용자 카테고리) | sm | 이름 + 직책만 |
| 멤버 목록 페이지 | md | 사진 + 이름 + 부서 + 상태 |
| 사용자 상세 헤더 | lg | 전체 정보 + CTA 버튼 |

## Props

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| \`user\` | \`User\` | ✓ | 사용자 객체 (id, name, email, avatarUrl, ...) |
| \`size\` | \`"sm" \\| "md" \\| "lg"\` | | 기본 \`"md"\` |
| \`onClick\` | \`() => void\` | | 카드 자체 클릭 핸들러 |
| \`actions\` | \`ReactNode\` | | 우측에 표시할 추가 버튼들 |

## 상태

| 상태 | 표시 |
|---|---|
| 기본 | 회색 보더 + 아바타 컬러 |
| 호버 | 보더 강조 + 그림자 |
| 비활성 (퇴사자 등) | 50% 투명도 + 회색조 필터 |
| 로딩 | skeleton placeholder (이름, 아바타) |

## 슬롯 / 컴포지션

\`\`\`tsx
<ProfileCard
  user={user}
  size="md"
  actions={
    <>
      <Button size="sm">메시지</Button>
      <Button size="sm" variant="outline">팔로우</Button>
    </>
  }
/>
\`\`\`

## 접근성

- 카드 전체는 \`role="article"\`
- 클릭 가능 시 \`role="button"\` + \`tabindex="0"\` + \`Enter\` 키 지원
- 아바타 \`<img>\` 의 \`alt\` 는 사용자 이름

## 구현 시 주의

- [ ] 이름이 너무 긴 경우 ellipsis 처리 (한 줄)
- [ ] 아바타 URL 누락 시 이니셜 fallback
- [ ] 다크 모드에서 보더/배경 대비 충족
- [ ] \`onClick\` 와 \`actions\` 의 클릭 이벤트 충돌 방지 (\`stopPropagation\`)

> 참고: 디자인 시스템의 [Card](./card-base) 위에 빌드. 색상은 [디자인 토큰](./design-tokens) 사용.
`,
  },
];

async function seedExampleSpecs(
  db: PrismaClient,
  projectId: string,
  authorId: string,
): Promise<void> {
  // 1) 대상 폴더 "폴더 2026-05-18" 찾거나 생성 (사용자가 UI 에서 만든 폴더와 같은 이름).
  const TARGET_FOLDER_NAME = "폴더 2026-05-18";
  let targetFolder = await db.folder.findFirst({
    where: { projectId, parentId: null, name: TARGET_FOLDER_NAME },
    select: { id: true },
  });
  if (!targetFolder) {
    const maxF = await db.folder.aggregate({
      where: { projectId, parentId: null },
      _max: { order: true },
    });
    const maxS = await db.spec.aggregate({
      where: { projectId, folderId: null, parentSpecId: null },
      _max: { order: true },
    });
    const order = Math.max(maxF._max.order ?? -1, maxS._max.order ?? -1) + 1;
    targetFolder = await db.folder.create({
      data: {
        projectId,
        parentId: null,
        name: TARGET_FOLDER_NAME,
        order,
        isLocked: false,
      },
      select: { id: true },
    });
    console.log(`✓ 예시용 폴더 생성: ${TARGET_FOLDER_NAME}`);
  }
  const targetFolderId = targetFolder.id;

  // 2) 각 예시 spec — title 로 idempotent 처리. 이전 시드에서 root 에 만들어졌다면
  // 대상 폴더로 이동 (folderId 갱신).
  for (let i = 0; i < EXAMPLE_SPECS.length; i++) {
    const ex = EXAMPLE_SPECS[i];
    const existing = await db.spec.findFirst({
      where: { projectId, title: ex.title, parentSpecId: null },
      select: { id: true, folderId: true },
    });
    if (existing) {
      if (existing.folderId !== targetFolderId) {
        await db.spec.update({
          where: { id: existing.id },
          data: { folderId: targetFolderId },
        });
        console.log(`✓ 예시 spec 이동: ${ex.title} → ${TARGET_FOLDER_NAME}`);
      }
      continue;
    }

    // 대상 폴더 안 형제 max order + 1 (sub-spec 없음 — folder 안 spec 만).
    const maxSpec = await db.spec.aggregate({
      where: { projectId, folderId: targetFolderId, parentSpecId: null },
      _max: { order: true },
    });
    const baseOrder = (maxSpec._max.order ?? -1) + 1;

    const spec = await db.spec.create({
      data: {
        projectId,
        folderId: targetFolderId,
        parentSpecId: null,
        title: ex.title,
        type: ex.type,
        order: baseOrder,
      },
      select: { id: true },
    });
    await db.revision.create({
      data: { specId: spec.id, markdown: ex.markdown, authorId },
    });
    console.log(`✓ 예시 spec 추가: ${ex.title} (in ${TARGET_FOLDER_NAME})`);
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
