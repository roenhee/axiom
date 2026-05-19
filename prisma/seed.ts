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
  apiSpec: string;
}[] = [
  {
    title: "고객 인증",
    type: "FeatureGroup",
    markdown: `# 고객 인증

이메일·비밀번호 기반의 고객 인증을 묶는 상위 그룹.
하위 Feature 들 (로그인 / 회원가입 / 비밀번호 찾기) 의 공통 정책·세션 모델·에러 응답 규약을 정의한다.

## 포함 Feature

| Feature | 설명 |
|---|---|
| 사용자 로그인 | 기존 사용자의 세션 획득 |
| 회원가입 | 신규 사용자 계정 생성 |
| 비밀번호 찾기 | 이메일 OTP 기반 재설정 |
| 세션 갱신 | 만료 직전 토큰 자동 회전 |

## 공통 정책

- 세션 토큰: HttpOnly Secure 쿠키 (\`sid\`). 만료 14일, 활동 시 슬라이딩 갱신.
- 동시 세션 최대 5개. 초과 시 가장 오래된 세션부터 폐기.
- 5회 연속 로그인 실패 시 계정 15분 잠금. PRD 12.3 의 잠금 정책.
- 모든 인증 API 응답은 아래 **공통 에러 형식** 을 따른다.

## 공통 에러 응답

\`\`\`json
{
  "code": "INVALID_CREDENTIALS",
  "message": "이메일 또는 비밀번호가 일치하지 않습니다.",
  "retryAfter": null
}
\`\`\`

| code | 의미 | retryAfter |
|---|---|---|
| \`INVALID_CREDENTIALS\` | 자격 증명 불일치 | null |
| \`ACCOUNT_LOCKED\` | 잠금 상태 | 초 |
| \`SESSION_EXPIRED\` | 세션 만료 | null |
| \`RATE_LIMITED\` | 너무 잦은 요청 | 초 |

## 세션 라이프사이클

> 로그인 직후 \`sid\` 쿠키 발급 → 매 요청 갱신 → \`/api/auth/logout\` 또는 14일 미사용 시 폐기.

## 체크리스트 (전체 그룹 공통)

- [ ] 모든 응답에 \`X-Request-Id\` 헤더 포함 (로그 추적)
- [ ] 4xx 응답도 공통 에러 형식 준수
- [ ] CSRF 토큰 별도 발급/검증 (이중 쿠키 패턴)
- [ ] 감사 로그: 로그인 성공/실패, 비밀번호 변경, 잠금 발생
`,
    apiSpec: `openapi: 3.0.3
info:
  title: Customer Auth API (공통)
  version: 1.0.0
  description: |
    고객 인증 그룹 공통 엔드포인트. 로그인/회원가입/비밀번호 찾기 같은
    개별 Feature 의 API 는 각 spec 에서 정의하고, 여기서는 그룹 전체에
    공유되는 세션/로그아웃 엔드포인트 + 공통 에러 형식만 정의한다.

paths:
  /api/auth/logout:
    post:
      summary: 현재 세션 종료
      operationId: logout
      responses:
        "204":
          description: 로그아웃 성공 (응답 본문 없음)
        "401":
          \$ref: "#/components/responses/SessionExpired"

  /api/auth/session:
    get:
      summary: 현재 세션 조회 (만료 직전 갱신 포함)
      operationId: getSession
      responses:
        "200":
          description: 세션 유효 — 사용자 요약 반환
          content:
            application/json:
              schema:
                \$ref: "#/components/schemas/SessionInfo"
        "401":
          \$ref: "#/components/responses/SessionExpired"

components:
  schemas:
    SessionInfo:
      type: object
      required: [userId, expiresAt]
      properties:
        userId:
          type: string
          example: "u_8h2k"
        expiresAt:
          type: string
          format: date-time
        scopes:
          type: array
          items:
            type: string
          example: ["read:self", "write:self"]
    ErrorResponse:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          enum:
            - INVALID_CREDENTIALS
            - ACCOUNT_LOCKED
            - SESSION_EXPIRED
            - RATE_LIMITED
        message:
          type: string
        retryAfter:
          type: integer
          nullable: true
          description: 재시도 가능까지 남은 초

  responses:
    SessionExpired:
      description: 세션이 만료되었거나 없음
      content:
        application/json:
          schema:
            \$ref: "#/components/schemas/ErrorResponse"
`,
  },
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

- 이메일: \`^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$\` 형식 일치
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
    apiSpec: `openapi: 3.0.3
info:
  title: Login API
  version: 1.0.0

paths:
  /api/auth/login:
    post:
      summary: 이메일/비밀번호 로그인
      operationId: login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                  example: "alice@example.com"
                password:
                  type: string
                  format: password
                  minLength: 1
      responses:
        "200":
          description: 로그인 성공 — Set-Cookie 로 sid 발급
          headers:
            Set-Cookie:
              schema:
                type: string
              description: "sid=<token>; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600"
          content:
            application/json:
              schema:
                type: object
                required: [userId]
                properties:
                  userId:
                    type: string
                  redirectTo:
                    type: string
                    description: 로그인 직전 페이지 (없으면 /dashboard)
        "401":
          description: 자격 증명 불일치
          content:
            application/json:
              schema:
                \$ref: "#/components/schemas/AuthError"
              example:
                code: INVALID_CREDENTIALS
                message: "이메일 또는 비밀번호가 일치하지 않습니다."
                retryAfter: null
        "423":
          description: 계정 잠금
          content:
            application/json:
              schema:
                \$ref: "#/components/schemas/AuthError"
              example:
                code: ACCOUNT_LOCKED
                message: "잠시 후 다시 시도해 주세요."
                retryAfter: 900
        "429":
          description: 요청 너무 잦음
          content:
            application/json:
              schema:
                \$ref: "#/components/schemas/AuthError"

components:
  schemas:
    AuthError:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          enum: [INVALID_CREDENTIALS, ACCOUNT_LOCKED, SESSION_EXPIRED, RATE_LIMITED]
        message:
          type: string
        retryAfter:
          type: integer
          nullable: true
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
    apiSpec: `openapi: 3.0.3
info:
  title: Profile Card Data API
  version: 1.0.0
  description: 프로필 카드가 표시하는 사용자 요약 데이터를 가져오는 엔드포인트.

paths:
  /api/users/{userId}/profile:
    get:
      summary: 프로필 카드용 사용자 요약 조회
      operationId: getUserProfile
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
        - name: size
          in: query
          description: 카드 사이즈 — 응답 필드 폭이 달라진다
          schema:
            type: string
            enum: [sm, md, lg]
            default: md
      responses:
        "200":
          description: 사용자 요약
          content:
            application/json:
              schema:
                \$ref: "#/components/schemas/UserProfile"
              example:
                id: "u_8h2k"
                name: "김지윤"
                title: "프로덕트 디자이너"
                department: "Design Platform"
                avatarUrl: "https://cdn.example.com/avatars/u_8h2k.png"
                status: "active"
                lastActiveAt: "2026-05-19T08:21:00Z"
        "404":
          description: 해당 사용자 없음

components:
  schemas:
    UserProfile:
      type: object
      required: [id, name, status]
      properties:
        id:
          type: string
        name:
          type: string
        title:
          type: string
          nullable: true
        department:
          type: string
          nullable: true
        avatarUrl:
          type: string
          format: uri
          nullable: true
        status:
          type: string
          enum: [active, away, busy, offline, inactive]
        lastActiveAt:
          type: string
          format: date-time
          nullable: true
`,
  },
  {
    title: "검색 결과 - 빈 / 에러 상태",
    type: "State",
    markdown: `# 검색 결과 페이지의 빈 / 에러 상태

검색 결과 페이지(Feature)의 두 가지 비정상 상태에 대한 UI / 메시지 정의.

## 다루는 상태

| 상태 | 트리거 | UX 의도 |
|---|---|---|
| 빈 결과 | 200 OK + \`results: []\` | 사용자에게 "찾지 못함" 을 명확히 전달 + 다음 행동 제안 |
| 일시 오류 | 5xx | 일시적임을 알리고 재시도 안내 |
| 점검 중 | 503 + \`Retry-After\` | 정확한 복귀 시각 또는 추정 시간 안내 |
| 네트워크 단절 | fetch reject | 클라이언트 측 메시지 (오프라인 등) |

## 빈 결과 UI

> "*\\\`{query}\\\`* 에 일치하는 결과가 없습니다."

및 다음 제안 표시:
- 가까운 철자 추천 (편집거리 ≤ 2) — 서버가 제공
- 인기 키워드 5개 (이번 주 기준)
- 필터를 한 단계 위로 풀어보는 버튼

## 일시 오류 UI

\`\`\`
😵  잠시 후 다시 시도해 주세요.

   문제가 계속되면 #help-search 로 알려주세요.
   [다시 시도]
\`\`\`

- \`Retry-After\` 헤더가 있으면 카운트다운 표시.
- 자동 재시도는 하지 않음 (사용자 의도 명확화).

## 메트릭 / 로깅

- 빈 결과 발생 시 쿼리·필터 조합을 분석 로그로 기록.
- 5xx 발생 시 sentry tag \`area=search-empty-state\` 로 grouping.

## 체크리스트

- [ ] 빈 결과 표시 시 검색바 포커스 유지 (즉시 다시 입력 가능)
- [ ] 일시 오류 화면에서 \`Esc\` 누르면 이전 페이지로 이동
- [ ] 점검 중 메시지의 복귀 시각은 사용자 로컬 타임존으로 표시
- [ ] 네트워크 단절 상태는 브라우저 \`navigator.onLine\` 으로 감지

## 디자인 / 톤

> 비난하지 않는다. 사용자를 안심시킨다. 다음에 무엇을 할 수 있는지 알려준다.
`,
    apiSpec: `openapi: 3.0.3
info:
  title: Search API — Empty / Error State Contract
  version: 1.0.0
  description: |
    이 spec 은 검색 결과 페이지의 "빈 / 에러" UI 상태를 트리거하는
    응답 형태를 정의한다. 정상 결과 응답은 별도 Feature spec 참조.

paths:
  /api/search:
    get:
      summary: 검색 (빈 / 에러 응답 케이스)
      operationId: search
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
            minLength: 1
            maxLength: 200
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
      responses:
        "200":
          description: |
            검색 성공. \`results\` 가 빈 배열이면 클라이언트는 "빈 결과" UI 를 표시.
            \`suggestions\` 가 있으면 함께 노출.
          content:
            application/json:
              schema:
                \$ref: "#/components/schemas/SearchResponse"
              examples:
                empty:
                  summary: 빈 결과
                  value:
                    query: "검색어"
                    total: 0
                    results: []
                    suggestions:
                      spellings: ["검색기"]
                      popular: ["로그인", "회원가입"]
        "500":
          description: 일시 오류
          content:
            application/json:
              schema:
                \$ref: "#/components/schemas/SearchError"
              example:
                code: TRANSIENT_ERROR
                message: "검색 서비스에 일시 장애가 있습니다."
        "503":
          description: 점검 중
          headers:
            Retry-After:
              schema:
                type: integer
              description: 점검 종료 예상까지 남은 초
          content:
            application/json:
              schema:
                \$ref: "#/components/schemas/SearchError"
              example:
                code: MAINTENANCE
                message: "검색 서비스 점검 중입니다."

components:
  schemas:
    SearchResponse:
      type: object
      required: [query, total, results]
      properties:
        query:
          type: string
        total:
          type: integer
          minimum: 0
        results:
          type: array
          items:
            type: object
        suggestions:
          type: object
          nullable: true
          properties:
            spellings:
              type: array
              items:
                type: string
            popular:
              type: array
              items:
                type: string
    SearchError:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          enum: [TRANSIENT_ERROR, MAINTENANCE, RATE_LIMITED]
        message:
          type: string
`,
  },
];

/// 이전 시드에서 생성됐지만 현재 EXAMPLE_SPECS 에는 없는 spec 들. 대상 폴더 안에서
/// 발견되면 삭제 (cascade 로 Revision / SpecVersion 도 함께 삭제). 신규 사용자에게
/// "각 종류별로 하나씩" 만 노출하기 위한 정리.
const OBSOLETE_EXAMPLE_TITLES = ["검색 결과 페이지"];

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

  // 2) 옛 예시 spec 정리 — 대상 폴더 안에 있을 때만.
  for (const obsolete of OBSOLETE_EXAMPLE_TITLES) {
    const ob = await db.spec.findFirst({
      where: { projectId, folderId: targetFolderId, title: obsolete },
      select: { id: true },
    });
    if (ob) {
      await db.spec.delete({ where: { id: ob.id } });
      console.log(`✓ 옛 예시 spec 제거: ${obsolete}`);
    }
  }

  // 3) 각 예시 spec — title 로 idempotent 처리.
  //   - 없으면 새로 생성 + Revision 1개
  //   - 있으면: 대상 폴더로 이동(필요 시) + 새 Revision 추가 (markdown / apiSpec 최신화).
  for (let i = 0; i < EXAMPLE_SPECS.length; i++) {
    const ex = EXAMPLE_SPECS[i];
    const existing = await db.spec.findFirst({
      where: { projectId, title: ex.title, parentSpecId: null },
      select: { id: true, folderId: true, type: true },
    });

    if (existing) {
      const updates: { folderId?: string; type?: typeof ex.type } = {};
      if (existing.folderId !== targetFolderId) updates.folderId = targetFolderId;
      if (existing.type !== ex.type) updates.type = ex.type;
      if (Object.keys(updates).length > 0) {
        await db.spec.update({ where: { id: existing.id }, data: updates });
      }

      // 최신 Revision 의 markdown / apiSpec 가 다르면 새 Revision 추가.
      const latest = await db.revision.findFirst({
        where: { specId: existing.id },
        orderBy: { createdAt: "desc" },
        select: { markdown: true, apiSpec: true },
      });
      const needsNewRevision =
        !latest || latest.markdown !== ex.markdown || latest.apiSpec !== ex.apiSpec;
      if (needsNewRevision) {
        await db.revision.create({
          data: {
            specId: existing.id,
            markdown: ex.markdown,
            apiSpec: ex.apiSpec,
            authorId,
          },
        });
        console.log(`✓ 예시 spec 본문/API 갱신: ${ex.title}`);
      }
      continue;
    }

    // 신규 생성 — 대상 폴더 안 형제 max order + 1.
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
      data: {
        specId: spec.id,
        markdown: ex.markdown,
        apiSpec: ex.apiSpec,
        authorId,
      },
    });
    console.log(`✓ 예시 spec 추가: ${ex.title} (${ex.type})`);
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
