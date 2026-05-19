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

## 2026-05-15 — Phase 1 UX 재설계 (3-pane 워크스페이스)

Phase 1 의 화면들을 기능 단위로 빠르게 만들었더니 프로젝트 내부 작업이 페이지
간 이동을 자주 요구하는 흐름이 되어 UX 가 어색했음. 기획자가 "프로젝트 안에서
좌·중·우 한 화면에서 작업한다" 는 명확한 그림을 제시해서 Phase 1-i ~ 1-l 로 재설계.

### D-019. 우측 패널 — 본문 / 메타 / 관계 / 히스토리 4 탭

Spec 의 모든 정보를 우측 패널 한 곳에 탭으로 묶는다. 페이지/모달 분리 없음.

**이유**: 기획자가 한 Spec 안에서 본문 편집 ↔ 메타 변경 ↔ 관계 추가 ↔ 버전 확인을
오가는 빈도가 높음. 페이지 분리는 작업 흐름을 끊고 좌/중앙 패널 상태 (선택된
Spec) 가 매번 다시 로드됨. 탭은 즉시 전환 + 좌/중앙 유지.

**트레이드오프**: 한 컴포넌트 (SpecTabs) 가 ~600 줄로 커짐. 추후 탭별로 분리할
여지는 있지만 현재 cohesion 이 더 중요. 탭 활성 상태는 URL 이 아니라 client
state — 새로고침 시 본문 탭으로 리셋되지만 무시 가능한 수준.

**관련**: `src/components/spec-tabs/SpecTabs.tsx`, Phase 1-j, 1-k.

### D-020. 가운데 패널 — 렌더링 뷰 (전체 목업 / 슬롯 목업 / 디자인 프레임)

좌·우 사이의 가운데 패널은 3 개 토글로 분기되는 렌더링 뷰 자리. Phase 1 시점엔
placeholder. Phase 2 에서 디자인 프레임 (Figma embed), Phase 3 에서 전체/슬롯
목업 (Slot Renderer iframe) 으로 채워짐.

**이유**: Phase 2/3 의 결과물이 들어올 자리를 미리 확보하면 사용자가 "여기에 곧
들어옴" 을 예측할 수 있고 셸 자체를 그때 다시 갈아엎지 않아도 됨. 토글 3 개는
PRD 5 / 9 / 10 의 3 가지 산출물 유형 (Figma frame / Slot mockup / Full surface
mockup) 에 1:1 매핑.

**트레이드오프**: 빈 placeholder 가 며칠~몇 주 동안 사용자에게 노출됨 — 단순
"Phase X 에서 채워집니다" 안내로 처리. 가운데가 가장 넓은 영역이라 placeholder
의 빈 느낌이 큼.

**관련**: `src/components/center-pane/CenterPane.tsx`, Phase 1-i.

### D-021. URL — `/projects/[slug]/specs/[id]` path param (탭은 URL 에 없음)

Spec 선택 상태만 URL 에 반영 (path param), 활성 탭은 client state 로 두고 URL
영향 없음.

**이유**: Spec 은 공유/북마크 단위로 자주 등장 (Slack 대화에서 "이 Spec 봐줘") —
URL 에 박혀야 함. 탭은 한 Spec 내부의 view 전환일 뿐이라 URL 영향 시 navigation
flicker 만 생김. Phase 4 의 AI Preview 같은 sub-state 가 생기면 그때 query
param 으로 보강.

**관련**: `src/app/projects/[slug]/layout.tsx`, `src/app/projects/[slug]/specs/[id]/page.tsx`.

### D-022. 셸은 layout.tsx 한 곳에 — settings / new-spec 도 셸 안

`/projects/[slug]/layout.tsx` 가 좌/중앙 패널을 SSR 해서 child route 변경에도
유지됨. settings / specs/new 같이 셸과 무관해 보이는 페이지도 셸 안의 우측
패널에 렌더 — 별도 헤더/breadcrumb 없이 본문만.

**이유**: 셸 밖으로 도망친 페이지 (settings 등) 가 있으면 사용자가 그 페이지에서
사이드바·중앙 패널의 상태를 잃음. 모든 프로젝트 내부 작업이 셸 안에서 일관되게
이루어지는 게 일관성·맥락 유지에 좋음. Route group 으로 셸 안/밖 분리하는 옵션도
검토했지만 settings 도 결국 프로젝트 내부 도구라 셸 안에 두는 게 자연스러움.

**트레이드오프**: settings/new-spec 페이지가 좌·중앙 패널과 한 화면에 보임 —
폼만 작게 차지하지만 의도된 디자인. 우측 패널 폭 (520px) 보다 폼이 더 큰 경우엔
수직 스크롤.

**관련**: `src/app/projects/[slug]/layout.tsx`, 1-i ~ 1-k.

### D-023. 좌측 트리 — 폴더 + Spec 통합, dnd-kit prefix 로 타입 분기

기존엔 폴더 트리와 Spec 목록이 좌측 패널에 따로 떠 있었음. 이제 한 트리에 폴더
안에 Spec 도 nested 로 표시. DnD id 는 `folder:<id>` / `spec:<id>` prefix 로
구분, drop 시점에 prefix 로 `moveFolder` / `moveSpec` 분기.

**이유**: PRD 6.2 가 폴더를 "탐색용 자유 구조" 로 정의 — Spec 도 그 안에 있어야
탐색 직관과 맞음. 별도 목록은 위치 정보를 두 번 보여줘서 중복.

**트레이드오프**: 행 종류가 2 가지 (Folder/Spec) 가 되어 DnD 검증 분기 필요.
Spec 은 후손이 없어 cycle 검사 불요, Folder 만 descendants 체크 유지.

**관련**: `src/components/folder-spec-tree/FolderSpecTree.tsx`, `src/server/specs/move-spec.ts`, Phase 1-i.

### D-024. dnd-kit hydration mismatch — mount 후에만 트리 렌더

`@dnd-kit/core` 6.3 의 `useDraggable` / `useDroppable` 가 컴포넌트마다 자체 id
카운터를 증가시키는데, 서버 렌더와 클라이언트 hydration 사이에 카운터 시작점이
달라 `aria-describedby` 가 안 맞아 hydration mismatch 경고 발생. 트리를 mount
이후에만 렌더하도록 가드 추가 (`useState(false)` + `useEffect(() => setMounted(true))`).

**이유**: 가장 작은 외과적 수정. 대안은 `next/dynamic` 으로 ssr:false 임포트지만
client wrapper 추가가 번거롭고, suppressHydrationWarning 은 근본 원인을 가리는
효과만 있음.

**트레이드오프**: 트리가 SSR 되지 않고 mount 후 한 frame 빈 "로딩…" 노출. 트리
데이터 자체는 layout.tsx 가 이미 fetch 해서 prop 으로 내려주므로 mount 즉시
완전 렌더 — 사용자 체감 거의 없음.

**관련**: `src/components/folder-spec-tree/FolderSpecTree.tsx` (mounted 가드), Phase 1-l.

---

## 2026-05-15 — Phase 1 UX polish 2 (resize / 메뉴 통합 / Spec 계층)

### D-025. 좌·우 패널 폭은 drag handle 로 사용자 조정, min 만 강제

좌측 (트리) / 우측 (Spec) 패널은 4px handle 을 잡고 드래그해 폭 조정. 좌 200 / 우 360
min 만, max 없음. 가운데는 남은 공간 + min 400 (D-027). 값은 localStorage 로
세션 간 유지.

**이유**: 사용자마다 모니터 폭, 작업 흐름이 달라 한 layout 으로 강제하면 어색.
3-pane 셸의 영구 사용성을 높이려면 사용자가 자기 화면에 맞게 조정 가능해야 함.

**트레이드오프**: 별도 state 관리 + handle 컴포넌트. localStorage 키 2 개 추가.

**관련**: `src/components/workspace-shell/ResizeHandle.tsx`, `ResizableShell.tsx`, Phase 1-m.

### D-026. + 추가 메뉴 통합 + 트리 끝 + 만들기 행

이전 [+ 폴더] [+ Spec] 두 버튼 / 폴더 행 hover [+ S] [+] 두 버튼 → 단일 [+ 추가]
버튼 + dropdown 메뉴. 트리 가장 하단에는 항상 [+ 만들기] 행 노출.

**이유**: 트리거가 두 개 → 시각 산만, hover 액션 영역 넓어짐. 한 트리거에 메뉴
선택지 두 개가 더 단순. 트리 끝 + 행은 스크롤 후에도 시작 지점 제공.

**관련**: `src/components/folder-spec-tree/AddMenu.tsx`, `FolderSpecTree.tsx`, Phase 1-n.

### D-027. 가운데 패널 min 400px

좌/우 드래그가 가운데를 침범하지 못하게 min-width: 400px. drag handle 도
viewport - MIN_CENTER - 2*handle 까지만 좌/우 합계 허용.

**이유**: 가운데 (Phase 2/3 의 렌더링 뷰) 는 가장 큰 공간이 필요한 영역이라
사용자가 실수로 0 으로 줄이지 않도록.

**관련**: `ResizableShell.tsx`, Phase 1-p.

### D-028. Spec 생성은 모달, /specs/new 페이지 제거

`+ 추가 → Spec` 클릭 시 모달 — 폼 채우고 만들기 → 새 Spec 으로 router.push.
별도 `/specs/new` 라우트 제거. createSpec 액션은 server-side redirect 대신
{ projectSlug, specId } 반환하도록 변경.

**이유**: 셸 안에서 페이지 이동 한 번을 줄임. 좌측 트리 / 가운데 placeholder
상태 유지하며 우측만 새 Spec 으로 갱신되는 흐름이 끊김없음. createSpec 의 redirect
는 client-side router.push 로 동일 효과.

**관련**: `src/components/folder-spec-tree/NewSpecDialog.tsx`, `src/components/ui/modal.tsx`, `src/server/specs/create-spec.ts`, Phase 1-o.

### D-029. Spec 계층 — spec.parentSpecId 컬럼 추가 (1:N 부모)

Spec 자체에 `parentSpecId` 컬럼 추가. 한 Spec 은 한 부모 Spec 만 가짐. 트리에서
폴더처럼 nesting. 자식 Spec 의 folderId 는 무시 (parentSpecId 가 있으면 트리에서
부모 spec 따라감).

**이유 (대안 비교)**: PRD 6.4 의 SpecRelation `contains` 도 의미상 부모-자식이지만
M:N 관계라 트리에 한 자식이 여러 부모 밑에 중복 표시되는 문제. 트리 구조는 1:N
이 자연스럽고, 1:N 강제는 schema 컬럼이 가장 단순.

**관계 의미 분리**:
- `parentSpecId` — 트리/조립 (1:N). UI 표시·이동 (DnD) 의 기준.
- `SpecRelation contains` — 의미적 참조 (M:N). PRD 6.4 의 "이 Spec 이 다른 Spec
  을 contain 한다" 라는 관계 정보 (관계 탭에서 등록).

같은 두 Spec 이 parent-child 면서 contains relation 도 가질 수 있음. 서로 별개.

**트레이드오프**: schema 추가 + 마이그레이션 1회. 두 필드를 두는 정신적 복잡도가
있지만 의미가 다른 두 관계라 분리하는 게 옳음. 후속에서 한 자식 spec 이 여러
부모를 가질 필요가 명확해지면 그때 contains 로 합치는 선택이 가능.

**관련**: `prisma/schema.prisma` Spec.parentSpecId, `src/server/specs/move-spec.ts`,
`src/server/specs/create-spec.ts`, `src/components/folder-spec-tree/FolderSpecTree.tsx`, Phase 1-q.

### D-030. 트리 끝 트리거 텍스트 "+ 만들기"

헤더 "+ 추가" 와 다르게 트리 끝 행은 "+ 만들기". 두 트리거가 같은 기능이지만
다른 텍스트 — 시각적 무게 / 위치 의미가 달라 OK.

**이유**: 기획자 요청. 트리 끝의 행은 "여기서부터 새로 만들 수 있다" 라는
다음 행동 안내 톤이라 동사형 "만들기" 가 더 어울림. 헤더 "+ 추가" 는 액션 버튼.

**관련**: `FolderSpecTree.tsx`, Phase 1-p.

---

## 2026-05-15 — 개발자 가이드 예약 폴더

### D-031. 모든 프로젝트에 "개발자 가이드" 예약 폴더 자동 생성

새 프로젝트 만들 때 createProject 가 동일 트랜잭션 안에서 `name="개발자 가이드"`
폴더를 함께 생성 (isLocked=true). 사용자는 이 폴더 안에 markdown spec 을
자유롭게 추가/편집할 수 있지만 폴더 자체는 삭제/이름변경/이동 불가.

**이유**:
1. 새 프로젝트가 완전히 빈 트리로 시작하면 "뭐부터 만들지?" 막막함이 큼. 한 칸
   채워져 있으면 작업 시작 지점.
2. 기획자 폴더 (feature 단위 — 검색, 결제 등) 와 개발 성격 문서 (AI 컨텍스트,
   개발 환경, API 안내 등) 가 시각적으로 분리됨 — 컨텍스트 충돌 적음.
3. PRD 16.7 (Phase 5 Developer Export) 의 CLAUDE.md / AGENTS.md 조립이 자연스
   럽게 이 폴더의 콘텐츠를 prefix 로 사용할 자리 — Phase 5 진입 시 이 폴더의 spec
   들을 export.md 의 앞부분으로 합칠 룰 확정.

**isLocked schema**:
- Folder.isLocked Boolean default false. true 면 deleteFolder / renameFolder /
  moveFolder 가 throw. UI 에서도 더보기 메뉴 / 드래그 핸들 숨김.
- 자식 (sub-folder, spec) 은 일반 폴더와 동일하게 자유 편집.

**트레이드오프**: schema 추가 1 컬럼 + 마이그레이션 1 회. 사용자가 폴더를 빈
폴더라 거추장스럽게 느낄 가능성 — 안에 placeholder spec 도 자동 생성할지는
검토했으나 너무 prescriptive 라 보류 (사용자 결정).

**관련**: `prisma/schema.prisma` Folder.isLocked, `src/server/projects/create-project.ts`,
`src/server/folders/delete-folder.ts` / `rename-folder.ts` / `move-folder.ts`,
`src/components/folder-spec-tree/FolderSpecTree.tsx` (FolderRow lock 처리),
`prisma/seed.ts` (샘플 프로젝트 backfill), Phase 1-u.

---

## 2026-05-15 — SpecType 정리

### D-032. SpecType 에서 Tab 제거 — Component 로 흡수

PRD 6.3.4 Tab Spec (탭 또는 화면 내 주요 구간) 이 6.3.3 Component Spec (UI 컴포넌트
한 개의 동작) 과 의미 겹침. 두 단위 모두 "UI 영역의 동작 명세" 라서 사용자에게 어떤
타입을 선택할지 결정 비용만 발생. enum 4 타입으로 축소.

**처리**:
- `enum SpecType` 에서 `Tab` 멤버 제거. PostgreSQL enum 직접 삭제 불가라 수동
  마이그레이션 (`20260515090000_spec_type_remove_tab`) — enum recreate 패턴.
  마이그레이션 시점에 Tab 타입 spec 0 개 (DB 안전).
- 탭/화면 구간 같은 명세는 광의의 Component 로 작성. PRD 6.3.3 Component 설명도
  "UI 컴포넌트 또는 화면 구간" 으로 살짝 확장 의미.
- 코드 7 곳의 TYPE_LABEL / TYPE_OPTIONS / TYPE_TONE / SPEC_TYPE_ICON / SPEC_TYPE_ORDER
  / TYPE_ICON_COLOR / DOC_TYPES 모두 Tab 항목 삭제. PRD 7 곳 + erd.md 갱신.

**Surface 내부 Tab / Region 은 별개**: Phase 3 의 Slot system 에서 prototype repo
Surface 안 구간 단위 "Tab" 은 그대로 유지. SpecType 의 Tab 과 이름만 같았던 별개
개념. PRD 10 장 / 11 장에 영향 없음.

**이유**: 4 타입 (FeatureGroup / Feature / Component / State) 가 의미 직관 명확.
+ 추가 메뉴 / HelpPopover 도 한 항목 줄어 더 단순.

**관련**: `prisma/schema.prisma` SpecType, `prisma/migrations/20260515090000_*`,
`docs/prd.md` 6.3.4 제거 + 6.1 계층도 / 8.1 / 5.2 / 16.2.1 / 21 정리, `docs/erd.md`,
`src/server/specs/create-spec.ts`, `src/components/spec-tabs/SpecTabs.tsx`,
`src/components/folder-spec-tree/FolderSpecTree.tsx`, `src/components/folder-spec-tree/HelpPopover.tsx`,
Phase 1-w.

---

## 2026-05-15 — 트리 UX 추가 폴리시 + SpecType 계층 강제

### D-033. dropdown 메뉴는 항상 트리거 오른쪽 아래 / portal 로 격리

이전 AddMenu 의 `align` prop (left/right) 이 호출처마다 달라 사용자가 위치
혼란 호소. 모든 dropdown 을 트리거 기준 오른쪽 아래 (top = bottom + 4, left =
trigger.left) 로 통일. AddMenu 를 portal 로 리팩토링 — 좌측 트리 aside 의
overflow-hidden 에 갇혀 잘리던 문제도 함께 해소.

**관련**: `src/components/folder-spec-tree/AddMenu.tsx`, Phase 1-x.

### D-034. 같은 위계로 이동하는 gap drop zone + Spec.order

폴더/Spec 트리에서 드래그할 때 row 위로만 떨어뜨릴 수 있어서 "다른 row 의
자식" 으로만 이동 가능. 사용자가 "동일 위계로 옮기기" 요구 → row 사이 간격에
gap drop zone 추가.

- Spec.order Int @default(0) 컬럼 추가 + 마이그레이션. 같은 부모 안 형제 순서
  기록.
- moveFolder / moveSpec 에 newOrder 옵션. 지정 시 같은 부모 안 형제 모두 0..N
  으로 재정렬.
- GapZone 컴포넌트 — dragging 중에만 렌더, isOver 시 파란 line.
- dnd-kit collision detection 을 `pointerWithin` (with rectIntersection
  fallback) 으로 변경 — 좁은 gap rect 가 활성 row 의 큰 rect 에 가려 잡히지
  않던 문제 해결. gap 발견 시 row 보다 우선.

**관련**: `prisma/schema.prisma` Spec.order, `src/server/folders/move-folder.ts`,
`src/server/specs/move-spec.ts`, `src/components/folder-spec-tree/FolderSpecTree.tsx`,
Phase 1-y.

### D-035. SpecType 계층 부분 강제 — 옵션 C

부모 spec 의 type 보다 상위 위계 type 은 자식으로 불가. PRD 6.1 계층도 의도
(FeatureGroup > Feature > Component ≈ State) 와 데이터 일관성 확보.

**룰**:
- FeatureGroup (rank 0): 모든 type 자식 OK
- Feature (rank 1): Feature / Component / State (FeatureGroup 불가)
- Component (rank 2): Component / State (Feature 이상 불가)
- State (rank 3): State 만 (실질 leaf)

같은 type 또는 더 하위 type 으로의 nesting 은 모두 허용 — Feature 안 sub-Feature
같은 분해는 자연스러운 사용 패턴이라 보존.

**구현**:
- `src/lib/spec-type-hierarchy.ts` 신규 — SPEC_TYPE_RANK / isChildTypeAllowed /
  childTypeRejectionReason. server / client 공유.
- 서버 (createSpec / moveSpec): parentSpecId 가 있고 type 위배면 throw.
- 클라이언트 (FolderSpecTree):
  · buildAddMenuItems 에 parentSpecType 받아 메뉴에서 상위 type 항목 제외.
  · handleDragEnd 에서 spec → spec sub-drop / gap-spec drop 시 부모 type 검증,
    위배면 alert 후 이동 거부.

**옵션 A (strict, type=type 만) / 옵션 B (자유) 와 비교**: A 는 Feature 안에
sub-Feature 도 막아 유연성 떨어짐. B 는 의미 깨짐 위험. C 는 잘못된 nesting
(작은 단위 안에 큰 단위) 만 막아 균형 좋음.

**관련**: `src/lib/spec-type-hierarchy.ts`, `src/server/specs/create-spec.ts`,
`src/server/specs/move-spec.ts`, `src/components/folder-spec-tree/FolderSpecTree.tsx`,
Phase 1-z.

---

## 2026-05-15 — 폴더/Spec 통합 순서 공간

### D-036. 같은 부모 안 폴더/Spec 이 order 공간을 공유

이전: folder.order 와 spec.order 가 분리된 namespace — UI 도 folders 먼저, specs
나중에 렌더. 사용자가 "spec 이 folder 위에 와도 된다" 요청.

이후: 같은 부모 (folder/root 레벨) 안에서 folder/spec 형제 모두 같은 order 정수
공간에 들어감. reorder transaction 이 양쪽 테이블을 함께 0..N 으로 renumber.

**룰**:
- folder/root 레벨 reorder: folder + spec 통합. locked 폴더는 항상 최상단 유지
  (앞쪽 K 개 자리 고정).
- sub-spec 레벨 reorder: spec sibling 만 (spec 안엔 folder 없음).
- 신규 생성 (createFolder / createSpec) 시 order = 같은 부모 형제(folder+spec
  통합) max + 1.

**구현**:
- src/server/folders/move-folder.ts: newOrder 지정 시 폴더+spec 통합 sibling
  list 만들어 renumber. locked 자리 제외하고 clamp.
- src/server/specs/move-spec.ts: 동일 로직. parentSpecId 가 있으면 sub-spec
  레벨이라 spec 만, 없으면 folder/root 레벨이라 통합.
- src/server/folders/create-folder.ts / src/server/specs/create-spec.ts:
  nextOrder = max(folder.order, spec.order) + 1.
- src/components/folder-spec-tree/FolderSpecTree.tsx:
  · renderFolderContents 가 folderChildren / rootSpecChildren 을 merged
    array 로 정렬 후 한 loop 으로 렌더 (locked 먼저, 그 다음 order asc).
  · GapZone 의 kind 구분 제거 — 통합 id 형식 `gap:<folderId|_>:<parentSpecId|_>:<order>`.
  · handleDragEnd 의 gap drop 분기도 단일 GAP_PREFIX 로 단순화.
- 기존 데이터: 마이그레이션 없이 자연 호환. 모두 order=0 인 상태는 stable
  sort 로 folders 먼저 → 이전 동작 유지. 사용자가 reorder 하면 unique order
  배치 시작.

**트레이드오프**: server reorder 로직이 좀 더 복잡 (두 테이블 동시 transaction).
사용자 입장에선 UX 자연스러움 — folder 와 spec 위치를 자유롭게 섞을 수 있음.

**관련**: D-029 / D-034 와 함께 트리 자유도 결정 묶음. Phase 1-aa.

---

## 2026-05-18 — Spec 본문 에디터 툴바 + Preview 모드

### D-037. Spec 본문 = Tiptap 툴바 + Edit/Preview 토글

배경: 기획자만이 아니라 비-MD 사용자도 본문을 편하게 작성해야 함. 기존 Tiptap
은 WYSIWYG 이지만 툴바가 없어 굵게/목록/표 같은 흔한 양식 적용이 직관적이지
않음. 또한 작성 중인 본문이 "최종 출판물" 처럼 보이는지 한 번 더 확인할
미리보기 수요가 있음.

이후:
- SpecEditor 에 툴바 추가. 필수 양식 (H1~H3, 굵게, 기울임, 취소선, 글머리/번호
  목록, 인용, 인라인 코드, 코드 블록, 링크) + 옵션 1 (표 3×3, 체크리스트,
  구분선). 모든 버튼에 `title` 로 툴팁 제공.
- 본문 탭 안에 [편집 ⇄ 미리보기] 서브 토글. 미리보기는 react-markdown +
  remark-gfm + prose CSS — 출판물 형태. 편집 모드에서 입력하면 미리보기
  상태에 즉시 반영 (autosave 와 별개로 React state 유지).
- Tiptap 인스턴스는 모드 전환 시 unmount 되지 않도록 hidden 처리 → 작업 중
  내용 / autosave 타이머 유지.

**이유**: 경로 X (Tiptap 유지 + 툴바 보강) 채택. 비-MD 사용자에게 친절하고
도입 비용이 가장 작음. 미리보기는 export (Phase 5) prep 단계로도 활용 —
같은 prose CSS 를 export 렌더링에서도 재사용 가능.

**트레이드오프**: Tiptap 의 편집 화면과 react-markdown 의 preview 화면이 두
개의 다른 렌더러임 — 미세한 시각 차이 가능. 둘 다 prose 클래스를 쓰므로 큰
차이 없을 예정.

**관련**:
- 새 Tiptap extensions 7개 추가 (link, table×4, task-list×2). 모두 공식
  @tiptap/extension-* 패키지로 reversibility OK.
- src/components/spec-editor/SpecEditor.tsx — 툴바 + onMarkdownChange prop.
- src/components/spec-tabs/SpecTabs.tsx — BodyTab 에 모드 토글.

---

## 2026-05-18 — 파일 첨부 / 이미지 업로드

### D-038. 첨부 파일은 트리에 폴더/Spec 과 함께 위치 (folder-level)

배경: 사용자가 .pdf, 이미지, 기타 임의 파일을 프로젝트에 올리고 미리보기·다운로드
할 수 있어야 함. 또한 Spec 본문에서 이미지 임베드 수요.

이후:
- 신규 `Attachment` 모델 — `projectId`, `folderId`(nullable), `fileName` 원본,
  `storedName` 디스크 저장명, `mimeType`, `size`, `order`, `uploadedById`.
  같은 부모(folderId/root) 안에서 폴더/Spec 과 통합 order 공간 (D-036 연장).
- 디스크 저장: `${UPLOAD_STORAGE_DIR}/<projectId>/<storedName>` ("방어 1"
  원칙 — env 로만 경로 주입). 기본 `./uploads/attachments`.
- API 라우트:
  - POST `/api/attachments` — multipart 업로드. fields: file, projectId,
    folderId?. 멤버십 + 폴더 검증. 최대 50MB.
  - GET `/api/attachments/[id]` — 파일 스트리밍. `?inline=1` 이면
    Content-Disposition inline (브라우저 임베드용).
- 폴더 트리:
  - 우상단 `+` 옆에 업로드 아이콘 추가 → 클릭 시 즉시 파일 선택 → 업로드 →
    `router.refresh()` 로 트리 반영.
  - Attachment 는 root(folderId=null) 로 업로드. 트리에 폴더/Spec 과 같은
    행 단위로 표시 (mime 별 아이콘).
  - DnD 로 이동은 후속 — 지금은 행 표시 / 클릭 navigate / 삭제만.
- 우측 패널 미리보기: `/projects/<slug>/attachments/<id>` 라우트.
  - 이미지 → `<img>`, PDF → `<iframe>`, 비디오 → `<video>`, 그 외 → 다운로드
    안내. 모두 prose CSS 와 무관한 native preview.
- 에디터 이미지 업로드: 툴바 이미지 아이콘 → 파일 선택 → 같은
  `/api/attachments` 엔드포인트 호출 → 응답 URL 로 `setImage({src,alt})`.
  새 `@tiptap/extension-image` 패키지 추가. 업로드한 이미지도 첨부로 트리에
  등장 (별도 hidden 플래그 없음 — 사용자가 필요 시 트리에서 정리).

**이유**: folder-level 배치(C) 가 D-036 의 "같은 부모 통합 order" 와 자연
스럽게 묶임. project-level(A) 분리 시 별도 첨부 패널이 필요해 UI 복잡도 증가.
디스크 + DB row 조합은 (외부 호스팅 금지) 정책과 일관, 사내 서버 이전 시
파일 dir 만 옮기면 되어 부담 작음.

**트레이드오프**: 디스크 / DB row 양쪽 정리 필요 (delete 시 unlink 실패해도
DB 삭제 진행 — orphan 파일은 추후 cleanup 작업). 이미지 임베드 시 트리에
첨부가 노출되어 시각적 noise 가능 — 사용자 정리 책임.

**관련**:
- `prisma/schema.prisma` — `Attachment` model. 마이그레이션
  `20260518025756_phase1_attachment`.
- `.env.example` — `UPLOAD_STORAGE_DIR` 신규.
- `src/server/attachments/{list,get,delete,upload-paths}.ts`
- `src/app/api/attachments/route.ts` (POST), `/[id]/route.ts` (GET).
- `src/components/folder-spec-tree/FolderSpecTree.tsx` — UploadButton,
  AttachmentRow, 통합 order merge.
- `src/components/attachment-view/AttachmentView.tsx` —
  `/projects/<slug>/attachments/<id>` 라우트의 우측 패널 컴포넌트.
- `src/components/spec-editor/SpecEditor.tsx` — `ImageUploadButton` 툴바,
  `@tiptap/extension-image` 등록.

---

## 2026-05-18 — PDF / PPTX 첨부 미리보기 + 페이지 nav

### D-039. PDF=react-pdf, PPTX=pptx-preview (client-only)

배경: 사용자가 첨부한 PDF / PPTX 를 우측 스펙 패널에서 페이지 단위로 미리보기.
브라우저 native iframe 은 PDF 만 지원 + chrome 디자인 일관성 부족, PPTX 는 미지원.
외부 호스팅/서비스 금지 (D-008) 라 self-host 가능한 client lib 필요.

이후:
- PDF: `react-pdf` v10 + `pdfjs-dist` v5.4.296 (react-pdf 내장 버전 정렬).
  - Worker: `public/pdf.worker.min.mjs` 로 self-host. `scripts/copy-pdf-worker.mjs`
    가 `postinstall` 에서 `node_modules` → `public/` 으로 복사.
  - 우리 디자인의 prev/next 버튼 + 페이지 카운터 (`X / Y`).
- PPTX: `pptx-preview` v1.0.7 (jszip + echarts 기반 순수 프론트엔드).
  - `mode: "slide"` 단일 슬라이드 뷰 + 우리 prev/next 버튼.
  - 라이브러리 내부 페이지네이션은 CSS 로 숨김 (`.pptx-preview-host`).
- 두 컴포넌트 모두 `next/dynamic` 로 `ssr:false` 임포트 — 라이브러리들이
  SSR 단계에서 `DOMMatrix` / `canvas` / `window` 참조 → 서버 렌더 오류.

**이유**: react-pdf 는 Mozilla 공식 pdfjs 의 React 래퍼로 가장 안정적.
pptx-preview 는 외부 서비스 의존 없이 브라우저에서 동작하는 거의 유일한 옵션.
PPTX 의 일부 fidelity 손실 (복잡한 애니메이션 / 폰트) 은 다운로드로 우회.

**트레이드오프**:
- 번들 크기: pdfjs-dist ~1MB + pptx-preview/echarts ~2MB 추가. dynamic 임포트로
  필요 시점에만 로드 — 초기 페이지 영향 작음.
- 워커 파일 복사 단계 추가 (`postinstall` 체인). 신규 클론 시 `npm install`
  로 자동 처리됨.
- npm 의 `pptxjs` 패키지는 placeholder/dummy (v0.0.0) 라 미사용 — 실제로 동작하는
  `pptx-preview` 채택.

**관련**:
- `src/components/attachment-view/PdfPreview.tsx`
- `src/components/attachment-view/PptxPreview.tsx`
- `src/components/attachment-view/AttachmentView.tsx` (dynamic import)
- `scripts/copy-pdf-worker.mjs` + `package.json` postinstall.
- `src/app/globals.css` — `.pptx-preview-host` 내부 pagination 숨김 규칙.

---

## 2026-05-18 — Spec 에 API 명세 탭 + 자동 발행

### D-040. Spec 본문과 별개로 OpenAPI YAML 보관 + 변경 시 자동 발행

배경: 기획자가 Body 에 자유 마크다운으로 적던 API 정보를 구조화. Phase 5
Developer Export 시 OpenAPI 그대로 추출되게, Phase 4 AI Runner 가 endpoint
구조를 정확히 읽도록.

이후:
- Spec 우측 패널에 새 "API" 탭 (모든 SpecType 노출 — Component/State 도 필요 시
  내부 API 명세 적을 수 있음).
- 탭 안에 [편집 ⇄ 미리보기] 서브 토글:
  - 편집: CodeMirror v6 + `@codemirror/lang-yaml` (YAML 작성, 줄 번호 / fold).
  - 미리보기: `swagger-ui-react` (Swagger UI 표준 렌더). SSR window 참조라
    `next/dynamic({ ssr: false })`.
- 저장 정책:
  - autosave 30초 debounce / blur (Body 와 같은 패턴).
  - `Revision.apiSpec` 컬럼 추가 — Body 만 바뀌었어도 직전 apiSpec 그대로
    carry-forward (매 row 가 full snapshot).
  - autosave 시 마지막 SpecVersion 의 apiSpec 과 다르면 **자동으로 새
    SpecVersion 발행** (`changeType="api"`, `changeSummary="API 스펙 자동
    발행 vN"`). Body 는 수동 발행 그대로.
- 역할 분리 가이드:
  > **Body** = "왜 이 기능이 필요한지, 어떤 흐름인지" — 사람을 위한 설명
  > **API** = "어떤 endpoint 로 어떤 데이터를 주고받는지" — 기계 + 개발자 명세

**이유**: Swagger UI = 업계 표준. CodeMirror = 가벼운 ESM YAML 에디터.
API 변경은 의미상 큰 변화 → 자동 발행이 사용자 입장에서 직관적. 반면 Body 는
자유 메모처럼 자주 바뀌어 매번 발행하면 noise.

**트레이드오프**:
- 번들: swagger-ui-react ~700KB, @uiw/react-codemirror + lang-yaml ~400KB,
  yaml parser ~50KB. dynamic 임포트로 API 탭 진입 시점에만 로드.
- Revision 마다 apiSpec 컬럼 carry-forward → 디스크 약간 redundancy. 트레이드
  오프로 단순한 query (한 row 가 한 시점의 full snapshot).
- API 자동 발행으로 SpecVersion 가 늘 수 있음. 30초 debounce + "마지막 발행본과
  다를 때만" 조건으로 spam 방지.

**관련**:
- Schema: `Revision.apiSpec`, `SpecVersion.apiSpec` 추가. 마이그레이션
  `20260518061057_phase1_api_spec`.
- `src/server/revisions/update-api-spec.ts` — autosave + auto-publish.
- `src/server/revisions/get-latest-api-spec.ts`
- `src/components/api-editor/ApiEditor.tsx` — CodeMirror.
- `src/components/api-editor/ApiSwaggerView.tsx` — Swagger UI (ssr:false).
- `src/components/spec-tabs/SpecTabs.tsx` — `ApiTab` 컴포넌트.

---

## 2026-05-18 — Spec 본문 템플릿

### D-041. 빈 본문일 때 사용자가 직접 템플릿을 골라 삽입 가능

배경: 새 Spec 만들면 본문이 빈 상태로 시작 — 사용자가 "어떻게 채워야 할지"
막막함. 표준 양식 (목적/시나리오/검증/실패 모드 등) 을 매번 처음부터 적기 부담.

이후:
- `src/lib/spec-templates.ts` — `SPEC_TEMPLATES` 상수 (현재 2 개: "기능 명세서",
  "컴포넌트 명세서").
- 빈 본문일 때 (`editor.isEmpty === true`) 편집 영역에 `TemplatePicker` overlay
  표시. 사용자가 클릭하면 `editor.commands.setContent(markdown)` 로 삽입 + 자동
  저장 트리거.
- SpecType 과 매칭 X — 어떤 spec 에서든 자유 선택 (사용자 결정).
- 본문을 다 지우면 (`editor.isEmpty` 다시 true) picker 가 재등장 — 재선택 가능.
- 자동 적용 안 함 (Spec 생성 시 빈 상태 유지) — 사용자가 "비워두기" 도 의도일 수
  있어 강제하지 않음.

**이유**: 가장 가벼운 형태로 가치 확보 (코드 상수 + overlay). 매칭 안 하는 이유는
사용자가 다양한 spec 에 같은 양식을 쓰거나, 같은 타입에서도 다른 양식을 쓰고
싶을 수 있어 자유도가 더 중요하다고 판단.

**트레이드오프**: 템플릿 종류 / 내용은 개발자만 수정 가능. 팀별 / 프로젝트별
다른 양식이 필요하면 따로 PR 필요.

**후속 작업 (TODO — Phase 5 운영 도구 단계)**:
- **마스터 계정용 admin 페이지에서 템플릿 추가/편집 기능 필요**. 현재는 코드
  상수로만 관리되어 새 템플릿 추가하려면 코드 수정 + 배포 필요.
- 필요한 작업:
  - DB 테이블 `SpecTemplate` 신규 (id, name, description, markdown, createdById, updatedAt)
  - admin 권한 사용자만 접근하는 `/admin/templates` 페이지 — 목록 / 생성 / 편집 / 삭제 / 순서
  - 마이그레이션 시 현재 코드 상수 → DB seed 로 옮김
- 호환: `SPEC_TEMPLATES` 를 fallback 으로 두고 DB 가 비어있으면 코드 상수 사용 — 점진적 이행 가능.

**관련**:
- `src/lib/spec-templates.ts` — 상수 + 타입 정의.
- `src/components/spec-editor/TemplatePicker.tsx` — picker UI.
- `src/components/spec-editor/SpecEditor.tsx` — `isEmpty` 상태 + overlay 렌더링.

---

## 2026-05-19 — Server action 의 redirect/notFound 신호를 클라이언트 catch 가 삼키지 않게

### D-042. 모든 server-action try/catch 는 `isNextControlFlowError(e)` 로 NEXT_ digest 에러를 다시 throw 한다

문제: 파일 / Spec / 프로젝트 삭제 같이 server action 이 `redirect()` 또는 `notFound()` 를
호출(또는 revalidate 후 현재 라우트 segment 에서 그것들이 발동)하면, Next.js 는
`NEXT_REDIRECT` / `NEXT_NOT_FOUND` digest 를 가진 Error 를 throw 한다. 클라이언트
컴포넌트의 `try { await action() } catch (e) { window.alert(e.message) }` 패턴이
이걸 정상 에러로 오해해서 alert 에 "NEXT_REDIRECT" 가 그대로 노출됐다.

해결:
- `src/lib/is-next-error.ts` — `isNextControlFlowError(e)` 헬퍼. `digest` 가 `NEXT_`
  prefix 면 true.
- 모든 server-action `try/catch` 에서 catch 직전에
  `if (isNextControlFlowError(e)) throw e;` 를 두어 navigation 신호는 Next.js 에 위임.
- 더불어 `deleteAttachment` 도 삭제 후 `redirect(`/projects/${slug}`)` 로 명시적
  이동을 시작 — 사용자가 첨부 페이지를 열어둔 상태였다면 revalidate 결과 라우트가
  `notFound()` 로 빠지는 걸 우회.

**이유**: redirect / notFound 는 Next.js 의 control-flow 신호이지 실패가 아니다. 잡아서
alert 으로 보여주는 것 자체가 버그.

**관련**:
- `src/lib/is-next-error.ts` (신규)
- `src/server/attachments/delete-attachment.ts` — redirect 추가
- `src/components/attachment-view/AttachmentView.tsx`,
  `src/components/folder-spec-tree/FolderSpecTree.tsx` (3곳),
  `src/components/spec-tabs/SpecTabs.tsx`,
  `src/components/workspace-shell/ResizableShell.tsx` — catch 가드 적용

---

## 2026-05-19 — Office 첨부 (PPTX/DOCX/XLSX) 는 서버에서 PDF 로 변환해 미리보기

### D-045. pptx-preview 라이브러리를 제거하고, 업로드 시점에 LibreOffice 로 PDF 변환 → react-pdf 로 렌더

**증상 (D-045 직전)**: PPTX 첨부의 표 / 차트 / 한국어 폰트가 깨져 보임. pptx-preview
(v1.0.7, closed-source) 는 순수 JS 로 PowerPoint 의 복잡한 레이아웃 엔진을 흉내내는
한계 — 표 cell 병합, 폰트 메트릭 정밀도, SmartArt / chart 등에서 충실도가 낮음.

**선택지 비교**:
- react-doc-viewer 같은 OSS 뷰어 → 결국 MS Office Online / Google Docs Viewer 로
  리다이렉트하는 구조. **사내 hub URL 은 외부 서버가 fetch 못함** + 인증 쿠키 cross-origin
  불가 + 회사 문서 외부 서비스 전송 정책 이슈로 부적합.
- 다른 JS 라이브러리 (pptxjs 등) → 같은 fundamental 한계 (PowerPoint 엔진 미보유)
  로 의미 없는 swap.
- **LibreOffice headless 변환** → 채택. LibreOffice 의 PPT 호환성이 사실상 업계 표준.
  표 / 차트 / 한국어 폰트 모두 PowerPoint 가 그린 그대로 렌더. PDF 로 떨어진 뒤에는
  이미 stack 에 있는 react-pdf 로 표시.

**구현 (이 PR)**:

- `prisma/schema.prisma` — `Attachment` 에 3개 컬럼 추가: `previewStatus` /
  `previewPath` / `previewError`. 마이그레이션 `phase1_attachment_preview`.
- `src/lib/office-to-pdf.ts` — LibreOffice CLI sub-process 호출 한 곳에 격리
  (CLAUDE.md 위험 방어 3 의 AI Runner 패턴 동일). `--headless --norestore
  --nofirststartwizard --nologo --invisible -env:UserInstallation=...` 안전 플래그.
  90초 타임아웃, 임시 디렉토리 / profile 격리, exit code / stderr tail 보존.
- `src/server/attachments/queue-preview-conversion.ts` — in-process fire-and-forget
  큐. 호출 시 status `converting` 으로 표시 → LibreOffice 호출 → 성공 시 `ready` +
  `previewPath` / 실패 시 `failed` + `previewError`. 같은 attachment 중복 enqueue 는
  in-flight Set 으로 skip (idempotent).
- `src/app/api/attachments/route.ts` (업로드) — office 파일 감지 시 `previewStatus`
  `converting` 으로 row 생성 + `void enqueuePreviewConversion(id)` (응답 안 기다림).
- `src/app/api/attachments/[id]/route.ts` — `?preview=1` 쿼리 추가. preview ready 면
  변환된 PDF (Content-Type=application/pdf, inline) 반환. ready 아니면 425.
- `src/app/api/attachments/[id]/preview-status/route.ts` — 클라이언트 폴링용 가벼운
  status 조회 endpoint.
- `src/components/attachment-view/OfficePreview.tsx` (신규) — 상태별 UI:
  null (legacy 업로드) → lazy enqueue + "변환 중…" 표시
  "converting" → 2초 간격 폴링 (5초 백오프), "변환 중…" 표시
  "ready" → `<PdfPreview url=/api/attachments/<id>?preview=1>` 로 렌더
  "failed" → 에러 메시지 + 다운로드 + 다시 시도 버튼
- `src/components/attachment-view/AttachmentView.tsx` — PptxPreview 분기를 OfficePreview
  로 교체. PPTX/PPT/DOCX/DOC/XLSX/XLS 모두 같은 경로.
- `src/server/attachments/delete-attachment.ts` — 원본 + previewPath 양쪽 unlink.
- `src/components/attachment-view/PptxPreview.tsx` 삭제.
- `pptx-preview` npm 의존성 제거.
- `globals.css` 의 `.pptx-preview-host` 관련 CSS hack 제거.
- `.env.example` / `.env` — `LIBREOFFICE_PATH` 추가 (default
  `/Applications/LibreOffice.app/Contents/MacOS/soffice`).
- `docs/setup.md` — "LibreOffice 설치" 섹션 추가.
- `docs/erd.md` — Attachment 스키마 diff 반영.

**Legacy 호환**: D-045 이전 업로드된 PPTX/DOCX/XLSX 첨부는 `previewStatus === null`.
처음 열릴 때 OfficePreview 가 자동으로 enqueue 해서 변환. 일괄 backfill cron 은 v1
범위 밖 (필요 시 후속 결정).

**트레이드오프**:
- LibreOffice 설치 (~500MB) 요구. CLAUDE.md "외부 호스팅 사용 안 함" 정책엔 부합
  (로컬 바이너리). 사내 서버 이전 시에도 같은 패키지 설치로 충족.
- 변환 시간 30MB PPT 기준 5~15초. fire-and-forget 으로 업로드 응답 자체엔 비용 없음.
  사용자는 "변환 중…" 표시를 잠시 봄.
- 디스크 사용량 office 첨부당 약 2배 (원본 + PDF). v1 수용.
- in-process 큐의 한계: 서버 재시작 중 변환 진행 중이던 row 는 "converting" 으로 멈춤.
  v1 에선 다음 view 시 "Try again" 버튼으로 사용자가 retry. 정식 queue 는 추후.

**관련**:
- `prisma/migrations/20260519004151_phase1_attachment_preview/`
- 위 모듈/컴포넌트 일체
- `docs/setup.md` "LibreOffice" 섹션
- D-038 (Attachment), D-039 (이전 PPTX 미리보기 방식, 이 결정으로 대체됨)

---

## 2026-05-19 — Worktree 는 `.claude/` 밖에 두고 `turbopack.root` 명시

### D-044. Git worktree 가 `<repo>/.claude/worktrees/...` 안에 있으면 dev 서버가 Mac 을 freeze 시킨다 — 반드시 `~/work/<name>/` 같은 별도 경로로 옮긴 뒤에 띄운다

**증상**: Next dev (Turbopack) 를 worktree 에서 띄우면 Mac 전체가 멈추고 강제 재부팅이
필요한 수준의 freeze 가 반복 발생.

**원인**:
- Claude Code 의 isolation 모드는 worktree 를 기본적으로 `<repo>/.claude/worktrees/<name>/`
  에 만든다. `<repo>/.claude/` 는 Claude Code 의 세션 디렉토리.
- Next dev (Turbopack) 는 `.next/dev/` 에 컴파일마다 초당 수천 개 파일을 쓰고 지운다.
- worktree 가 `.claude/` 안에 있으면 그 쓰기 firehose 가 모두 Claude Code 의 file
  watcher 로 흘러간다. 동시에 macOS fsevents 자체 부하 + Turbopack 자기 watcher 까지
  같은 트리를 폭격해서 시스템이 freeze.
- 추가로, worktree 가 메인 레포 안에 있으면 `package-lock.json` 이 두 개로 보이고
  Next 가 workspace root 를 잘못 추론해 file watcher 가 상위 디렉토리까지 훑는다.

**해결 — 두 단계 모두 필수**:

1. **worktree 를 `.claude/` 밖으로 이동**:

   ```bash
   mkdir -p ~/work
   git -C <main-repo> worktree move \
     <main-repo>/.claude/worktrees/<name> \
     ~/work/<name>
   ```

   이후 dev 는 새 경로에서만 띄운다 (`cd ~/work/<name> && npm run dev`).

2. **`next.config.ts` 에 `turbopack.root` 명시** (이미 적용):

   ```ts
   import path from "node:path";
   const config: NextConfig = {
     turbopack: { root: path.resolve(__dirname) },
   };
   ```

   worktree 가 어디 있든 file watcher 가 상위로 새지 않도록 보호.

**검증 결과 (이 이슈를 발견한 세션)**:
- 옛 위치 (`<repo>/.claude/worktrees/kind-lehmann-a35672/`): dev 띄우면 Mac freeze.
- 새 위치 (`~/work/sdph-a35672/`): next-server idle CPU 0.0%, RSS 1.25GB, 페이지 응답
  ~0.6s. 메모리 압박 없음, lockfile 경고도 사라짐.

**트레이드오프**:
- Claude Code 가 새 isolation worktree 를 만들 때마다 수동 이동 1회 필요.
  자동화하려면 `~/.claude/worktree-base-path` 같은 글로벌 설정이 있는지 확인 필요 (별도 조사).

**관련**:
- `CLAUDE.md` — "Git worktree 위치 규약" 섹션 + "절대 하지 말 것" 항목.
- `next.config.ts` — `turbopack.root` 설정.

---

## 2026-05-19 — 샘플 프로젝트 예시 spec 을 4개 (각 타입 1개) + apiSpec 채움

### D-043. EXAMPLE_SPECS 를 FeatureGroup / Feature / Component / State 한 개씩으로 정리하고 각 spec 의 OpenAPI YAML 동봉

- "고객 인증" (FeatureGroup), "사용자 로그인" (Feature), "프로필 카드" (Component),
  "검색 결과 - 빈 / 에러 상태" (State).
- 각 spec 의 Revision 에 `markdown` + `apiSpec` 함께 저장. UI 에 새로 들어온 사람이
  "어떤 타입을 어떻게 채우는지" + "API 탭은 어떤 모양인지" 한눈에 보이도록.
- seed 는 idempotent — 같은 title 이 이미 있으면 markdown / apiSpec 만 새 Revision 으로
  갱신, type 도 필요 시 보정. 옛 "검색 결과 페이지" 는 OBSOLETE_EXAMPLE_TITLES 로
  정리 (대상 폴더 안에 있을 때만 삭제).

**관련**:
- `prisma/seed.ts`

---

## 2026-05-19 — Phase 2 진입 결정 묶음

### D-046. Figma 연결 단위는 Spec 만 (Phase 2 MVP)

PRD 8.1 은 Feature/Spec/Slot Component/Variation/Instance 모두 연결 가능하다고
명시하지만, Phase 2 에서는 **Spec 단위 연결만** 구현한다. Slot 측 모델 자체가
Phase 3 에서 처음 들어오므로 그 시점에 다시 결정:

1. `SpecFigmaLink` 에 nullable 컬럼 (`slotComponentId` 등) 추가 — 한 테이블 유지
2. 별도 테이블 `SlotFigmaLink` 분리 — 깔끔하지만 join 분기 ↑

또한 SpecVersion 단위로 별도 figma 묶음을 두지 않는다. Figma 연결은 Spec
메타 성격으로 본다. PRD 7.6 (AI/Export 는 Published Version 기준) 의 영향
범위는 markdown snapshot 이고, figma 는 현 시점 상태 그대로 사용.

**이유**: Phase 2 MVP 의 범위를 좁히고, slot 모델이 안정된 뒤 결정해도 비용이 작다.

**관련**: `prisma/schema.prisma` FigmaFrame / SpecFigmaLink, `docs/erd.md` Phase 2.

### D-047. Figma UI 위치 — 가운데 "디자인 프레임" 뷰 안에 인라인

연결 추가 (URL paste), required level 토글, frame label 편집, 연결 해제를
모두 `CenterPane` 의 design 모드 안에서 처리. 우측 SpecTabs 에는 새 탭을
추가하지 않는다.

**이유**: 사용자가 frame 을 등록하고 바로 embed 미리보기를 보는 흐름이 자연스럽고,
가운데 패널의 "디자인 프레임" placeholder 가 이미 D-020 에서 Phase 2 자리로 박혀
있었다. 우측 4탭 (본문/API/관계/히스토리) 은 그대로 유지.

**트레이드오프**: 가운데 패널이 Phase 3 의 슬롯 목업까지 떠안게 되면 점점 복잡해진다.
일단 design 모드 안의 컴포넌트는 독립적으로 둬서 분리 가능하게 유지.

**관련**: `src/components/center-pane/CenterPane.tsx`, D-020.

### D-048. Compare View — 현재 3-pane 셸이 곧 Compare View

PRD 8.4 의 "좌 Spec / 우 Figma" 좌우 비교 요건은 이미 워크스페이스 3-pane
(좌 트리 / 가운데 디자인 / 우 Spec 본문) 구조가 만족한다. 별도 페이지
(`/specs/:id/compare`) 는 만들지 않는다.

**이유**: URL/네비게이션이 단일하고, 트리에서 다른 Spec 으로 이동해도 좌우
비교 컨텍스트가 그대로 유지된다.

**트레이드오프**: 1024×768 같은 좁은 화면에서는 3-pane 이 좁아진다 — D-025 의
drag handle 로 사용자가 좌/우 패널을 접어 가운데 + 우 (Spec vs Figma) 형태로
좁힐 수 있게 이미 처리됨.

**관련**: PRD 8.4, D-020, D-025.

### D-050. Phase 2 시드 데이터에 Figma frame 추가하지 않음

`prisma/seed.ts` 의 sample 프로젝트에 예시 Figma frame 을 미리 박아 두지 않는다.

**이유**:
- 가짜 fileKey/nodeId 를 두면 iframe embed 가 빈 화면이 되어 오히려 혼란.
- 진짜 community Figma URL 은 영속성 보장 안 됨 + 회사 보안 정책 가정에 맞지 않음.
- 사용자가 직접 첫 frame 을 추가하는 과정이 그 자체로 좋은 onboarding —
  AddFigmaForm 의 description 에 "Figma → Share → Copy link" 안내 있음.

**관련**: D-043 (예시 spec 시드), `src/components/center-pane/DesignFramePane.tsx` AddFigmaForm.

### D-049. Figma Coverage 의 N/M 정의 — Phase 2 에선 단순화

PRD 8.3 예시의 "4 / 5 connected" 형태에서 분모 5 (expected) 는 Scenario 모델
(State spec, 단위별 expected frame 정의) 이 없으면 정확히 계산할 수 없다.
Phase 2 MVP 에선 다음 단순한 정의로 가져간다:

- `total` = Spec 에 등록된 frame 수
- `expected` = required + recommended 의 합
- `connected` = 현재는 `expected` 와 동일 (즉 등록된 것 중 required/recommended)

PRD 의 N/M 정확한 의미 (expected 가 미리 정해지고 실제 연결 수와 비교) 는
Phase 5 (Sync Status) 진입 시 재정의.

**관련**: `src/server/figma-links/get-figma-coverage.ts`.

---

## 2026-05-19 — 세션 운영 정책 (Claude Code worktree 미사용 기본)

### D-051. 새 Claude Code 세션은 worktree 없이 메인 레포에서 시작한다

기획자가 새 세션을 여는 동기는 거의 항상 **"context 길이가 길어져서 효율
떨어지는 걸 끊으려는 것"** 이지, 두 가지 변경을 동시에 진행하려는 게 아니다.
그럴 때 worktree 를 만들면 다음 문제가 생긴다:

- 메인 dev 서버에서 변경이 안 보임 (다른 branch / 다른 디렉토리)
- worktree 마다 `npm install`, `prisma generate`, `.next/` 가 별도로 쌓임
- 머지 한 단계가 추가됨
- `.claude/worktrees/` 안에서 dev 띄우면 Mac freeze (D-044)

따라서 다음을 기본으로 한다:

- 새 세션 시작 시 Claude Code 의 "isolated worktree" / "create branch" 옵션을
  쓰지 않는다 — 그냥 메인 레포 디렉토리에서 시작
- 작업은 main branch 에 직접 커밋
- worktree 는 진짜 병렬 작업이 필요할 때만 (두 변경 흐름을 동시에)

**이유**: 가장 흔한 운영 흐름 (직렬 세션) 에 맞춰 마찰을 0 으로. worktree
가 주는 격리 가치는 1인 + 직렬 진행 환경에선 거의 0.

**예외**: Phase 4 의 AI Task Plan worktree (prototype repo 측) 는 코드 책임
(격리된 patch 생성) 이고, 이 결정의 "세션 worktree" 와 별개.

**관련**: `CLAUDE.md` "세션 운영" 섹션, D-044 (`.claude/worktrees/` freeze).

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
