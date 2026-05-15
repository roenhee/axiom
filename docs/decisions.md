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

## 템플릿 (앞으로 추가할 때 이 형식)

```
## YYYY-MM-DD — 짧은 제목

### D-NNN. 결정 내용

자세한 설명 한두 단락.

**이유**: 왜 이렇게 결정했는지.

**트레이드오프 (선택)**: 무엇을 포기했는지, 어떤 대가가 있는지.

**관련**: 영향 받는 docs/파일, 관련된 D-NNN.
```
