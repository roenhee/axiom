# 의사결정 이력

이 파일은 프로젝트를 진행하면서 합의한 결정을 누적 기록한다. 6개월 뒤 "왜 이렇게 했지?"를 찾을 수 있어야 한다.

**작성 규칙**

- 한 결정 = 한 항목. 한 줄짜리도 OK
- 날짜, 결정 내용, 짧은 이유 정도면 충분
- 사후 검토에 유용한 트레이드오프가 있으면 짧게 메모
- 결정이 번복되면 새 항목으로 추가 (이전 항목 지우지 않음)

---

## 2026-05-14 — 프로젝트 시작 결정 묶음

### D-001. 1인 + Claude Code 페어로 개발

기획자 1인이 PRD의 주인이 되고, Claude Code가 코드/인프라의 페어가 된다.

**이유**: 외부 개발 리소스 없이 진행. Claude Code의 능력을 최대한 활용.

### D-002. PRD 25개 MVP 기능 전부 만든다 (임의로 빼지 않는다)

Claude가 일정 짧게 하려고 임의로 기능을 빼는 일 없도록 명시.

**이유**: Claude의 초기 응답에서 임의로 PRD를 줄였던 일이 있었음. 기획자만 빼는 결정을 한다.

### D-003. 외부 호스팅 서비스 사용하지 않음

Vercel, Supabase, Railway, Render, Fly.io 등 외부 서비스 사용 금지. 로컬 또는 사내 서버에서만 동작.

**이유**: 사내 데이터/PRD를 외부에 두지 않는 회사 보안 정책 가정. 또한 사내 서버 이전 시 비용 최소화.

### D-004. 로컬은 직접 설치 (Docker 사용 안 함)

본인 노트북에 Node 20, PostgreSQL 16을 brew 등으로 직접 설치한다.

**이유**: 1인 작업의 매일 경험을 가볍게 유지. 디버깅 직관성. Docker Desktop의 리소스 부담 회피.

**트레이드오프**: 사내 서버 이전 시점에 환경 차이 해결 비용이 한 번 발생. 그 비용은 "위험 1·2·3 방어 코드"로 줄인다.

### D-005. 두 레포 구조 (hub + prototype)

PRD 9~11장의 prototype repo 분리 원칙을 그대로 따른다. Hub와 prototype은 별도 Git 레포.

**이유**: PRD의 핵심 원칙. AI patch의 격리, prototype 코드와 hub 운영 코드의 책임 분리.

### D-006. 위험 1·2·3 방어 코드 원칙

`CLAUDE.md`에 명시. Prototype repo 경로 환경변수화, Preview URL base+slug 조합, AI Runner 모듈 격리 + DB 진행 상태.

**이유**: 로컬 → 사내 서버 이전 비용을 작게 유지. 자세한 건 `docs/deployment.md`.

### D-007. 스택 확정

TypeScript, Next.js 15 App Router, PostgreSQL 16, Prisma, Tiptap, Tailwind, shadcn/ui, NextAuth (Google), Anthropic SDK + Claude Code SDK, simple-git.

**이유**: Claude Code가 가장 안정적으로 다루는 조합. 풀스택 한 덩어리로 1인 운영 용이.

### D-008. Phase 0~6 단계 계획 채택

자세한 건 `docs/development-phases.md`.

**이유**: 작업 단위를 화면/기능 단위로 작게 끊어 디버깅 가능성 확보.

### D-009. Claude의 행동 원칙 — 옵션 제시 + 기획자 결정

라이브러리/스택/모델 변경 등 되돌리기 어려운 결정은 Claude가 단독으로 하지 않고 두세 가지 옵션을 제시한 뒤 기획자가 고른다.

**이유**: 초기 대화에서 Claude가 임의로 결정한 일이 있었음. PRD/제품 결정의 주체는 기획자.

---

## 2026-05-14 — Phase 0 셋업 결정 묶음

### D-010. 로그인 우회 — dev seed user 패턴 (옵션 A)

NextAuth/Google OAuth 셋업을 Phase 0에서 하지 않는다. 대신:

- `User` 모델은 schema에 그대로 둔다 (ERD 일관성, 미래 사내 SSO 붙일 때 그대로 사용).
- `prisma/seed.ts`가 `.env`의 `DEV_USER_EMAIL`/`DEV_USER_NAME`에 해당하는 user를 upsert.
- `src/lib/auth/current-user.ts`의 `getCurrentUser()` / `getCurrentUserId()` 가 항상 이 user를 반환.
- 모든 server action / API route는 이 두 함수만 호출 — 호출처는 SSO 붙어도 그대로.

**이유**: 사내 SSO로 갈 거라 OAuth 셋업이 폐기될 일. 이 시점에 NextAuth 붙여 봐야 나중에 다 뜯어내야 함. 한편 User 모델 자체를 미루는 옵션 C는 ERD에 이미 User FK가 박혀 있어 마이그레이션 통증이 큼.

**트레이드오프**: 권한 시나리오(Phase 5 Viewer 등)를 클릭으로 시연하려면 DB에서 user의 role을 갈아 넣어야 함. 그때 필요해지면 옵션 B(URL param 스위처)로 보강한다.

**관련**: `src/lib/auth/current-user.ts`, `prisma/seed.ts`, `.env.example`, CLAUDE.md "스택" 표.

### D-011. Next.js 16 채택 (CLAUDE.md의 "Next.js 15"에서 변경)

`npx create-next-app@latest`가 Next 16.2.6을 설치. CLAUDE.md 본문은 "Next.js 15"라고 적혀 있었지만, 16의 App Router는 15와 호환되고 Turbopack도 기본 활성. 굳이 15로 다운그레이드할 이유 없음.

**이유**: 최신 stable. 새 프로젝트 시작 시점 그대로.

**관련**: `package.json`(next 16.2.6), `AGENTS.md`(Next 16 변경 주의사항), CLAUDE.md 스택 표 갱신.

### D-012. Prisma 7 + adapter-pg 채택

Prisma 7은 PrismaClient에 `adapter` 옵션 필수. `@prisma/adapter-pg`를 어댑터로 쓴다. 생성된 client는 `src/generated/prisma/client.ts`에 위치 (Prisma 7 기본).

**이유**: Prisma 7 기본 방식 따라감. 6 이하로 다운그레이드할 사유 없음.

**트레이드오프**: 학습 자료가 아직 Prisma 6 기준이 많음. 차이점 — `import { PrismaClient } from "@/generated/prisma/client"`, 생성자에 adapter 전달.

**관련**: `src/lib/db.ts`, `prisma/seed.ts`, `prisma.config.ts`.

### D-013. Phase 0에선 Tiptap / Anthropic / simple-git 도입 보류

PRD/CLAUDE.md 스택 표에 적혀 있지만 각각 Phase 1(Tiptap), Phase 4(Anthropic), Phase 3(simple-git)에 들어갈 때 install. 지금부터 깔아두면 미사용 dependency가 됨.

**이유**: 작은 의존성 덩어리 유지. 도입 시점에 최신 버전을 받는 게 유리.

**관련**: CLAUDE.md 스택 표에 도입 시점 메모 추가.

### D-014. `.claude/` 디렉토리는 git에 안 올림

`.claude/settings.local.json` 등 개인 세션 설정이 들어가 있어 공유 안 함. `.gitignore`에 `.claude/` 추가.

**이유**: 다른 작업자 노트북마다 개인 설정이 달라야 함.

**관련**: `.gitignore`.

---

## 2026-05-14 — Phase 1 진입 결정

### D-015. 데이터 호출 패턴 — 하이브리드 (Server Action 우선, 필요분만 API Route)

Phase 1 이후 모든 mutation/조회는 다음 원칙을 따른다.

- **기본은 Server Action** (`"use server"`). Hub UI 가 호출하는 모든 데이터 호출은 Server Action.
- **API Route 는 외부 노출이 필요한 endpoint 만 추가**. 외부 = 다른 사내 도구(Slack bot, CI, CLI 등) 또는 prototype repo 내부에서 호출되어야 하는 경우. MVP 범위 내에선 등장하지 않을 가능성이 큼.
- **`docs/api.md` 는 외부 노출 endpoint 만 명세**. 내부 Server Action 은 `docs/api.md` 가 아니라 코드 그 자체가 명세. (현재 api.md 에 적힌 Phase 1 endpoint 표는 "이런 의미의 호출이 있다"는 contract 차원으로 유지하되, 실제 구현은 Server Action 으로 매핑.)
- Server Action 의 위치 컨벤션 — `src/server/<도메인>/<동작>.ts` 또는 `src/app/.../actions.ts` 중 하나로 통일. 1-B 들어가면서 확정.

**이유**: PRD/CLAUDE.md 어디에도 외부 도구가 Hub 를 HTTP 호출하는 시나리오가 없음. AI Runner 는 sub-process(HTTP 아님), prototype repo 는 git 으로 조작. Server Action 이 코드량이 적고 타입 안전. 사내 서버 이전 시점에도 인프라는 동일 (모두 Next.js 프로세스 1개).

**트레이드오프**: 사내 다른 도구(Slack bot, 대시보드 등)와 연동 욕구가 생기는 시점에 endpoint 단위로 API Route 를 추가해야 함. 그때 명세는 `docs/api.md` 에 같이 적는다. 또한 모니터링 인프라에서 endpoint 단위 metric 이 필요해지면 그때 API Route 로 일부 옮길 수 있음.

**관련**: `docs/api.md`, Phase 1-B 진입 시 Server Action 위치 컨벤션 결정.

### D-016. Server Action 위치 — `src/server/<도메인>/<동작>.ts`

Server Action 코드는 `src/server/<도메인>/<동작>.ts` 한 파일당 한 액션 (예: `src/server/projects/create-project.ts`). 파일 첫 줄은 `"use server"`. UI 페이지(`src/app/...`)에서 import 해서 사용.

**이유**: Phase 5까지 가면 액션이 ~50개로 늘어남 (Project / Folder / Spec / SpecVersion / Revision / Slot / AI Task / Comment / Export / Sync). 도메인 디렉토리로 모아두면 검색/일괄 권한 enforcement 추가/리팩토링이 쉽다. UI 옆 `actions.ts` 패턴은 한 액션을 여러 페이지에서 쓰기 시작하면 어디 둘지 매번 판단해야 함.

**트레이드오프**: 페이지와 액션이 떨어져 있어 같이 수정할 때 두 군데 열어야 함. import 한 줄로 해결.

**관련**: `src/server/projects/`(1-B), 이후 모든 mutation 코드.

### D-017. Folder 트리 UI — dnd-kit + 자체 렌더링

자유 폴더 트리 (PRD 6.2) UI 는 `@dnd-kit/core` + `@dnd-kit/sortable` 만 DnD 용으로 쓰고, 트리 자체는 자체 재귀 컴포넌트로 그린다. `react-arborist` 같은 통합 라이브러리는 안 씀.

**이유**: PRD 6.2 의 "생성, 수정, 이동" 중 이동을 키보드 클릭 + DnD 양쪽으로 지원하려면 트리 렌더링을 우리가 통제해야 함. react-arborist 는 가상화/통합 강점이지만 폴더 수가 수백 이하라 가상화 불필요. dnd-kit 은 sensor 추상화 + 접근성 (키보드 DnD) 까지 지원.

**트레이드오프**: 트리 컴포넌트와 DnD wiring 을 직접 작성 (~300줄). 가상화는 미래 필요해지면 자체 추가 또는 라이브러리 교체.

**관련**: `src/components/folder-tree/`, Phase 6 UX 다듬기 때 가상화/단축키 보강.

### D-018. Spec 본문 에디터 — Tiptap + tiptap-markdown, 자동저장은 30 초 debounce + onBlur

Spec Markdown 본문 에디터로 Tiptap 채택. `tiptap-markdown` extension 으로 Markdown 입출력. `react-markdown-editor` 같은 단일 라이브러리는 안 씀.

자동저장 트리거:
1. 마지막 입력 후 **30 초 가만히** (debounce)
2. **에디터 blur** (포커스 해제) — debounce 끝나기 전이라도 즉시
- 둘 중 먼저 발생하는 쪽이 Revision 1 건 생성.

Revision 보관 정책:
- 모두 보관 (수량 제한 / 시간 압축 없음).
- 단, **직전 Revision 과 markdown 동일하면 server 에서 row 안 만듦** — 빈 입력 후 blur 같은 케이스에서 빈 row 폭증 방지.

revalidatePath 는 호출 **안 함**. 자동저장이 자주 일어나는데 페이지 리렌더하면 화면 깜빡임 + 포커스 손실. 페이지가 최신 본문을 다시 필요로 하는 시점은 새로고침 또는 SpecVersion Publish — 그때 RSC 가 다시 조회.

**이유**: PRD 5 / 7.2 의 Markdown + 편집 이력 요구. Tiptap 은 Block-based extension 모델이 강해 추후 Slot Mention 같은 커스텀 노드 추가 시 유리.

**트레이드오프**: Tiptap 의 markdown 변환은 일부 GFM 문법 (정의 리스트, 각주 등) 손실. 우리 PRD 는 기본 문법만 요구라 OK.

**관련**: `src/components/spec-editor/SpecEditor.tsx`, `src/server/revisions/`.

---

## 템플릿 (앞으로 추가할 때 이 형식)

```
## YYYY-MM-DD — 짧은 제목

### D-NNN. 결정 내용

자세한 설명 한두 단락.

**이유**: 왜 이렇게 결정했는지.

**트레이드오프 (선택)**: 무엇을 포기했는지, 어떤 대가가 있는지.

**관련**: 영향 받는 docs/파일, 관련된 D-NNN.
```
