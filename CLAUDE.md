# CLAUDE.md

이 파일은 Claude Code가 이 레포에서 작업할 때 매번 자동으로 읽는 파일이다. 모든 작업의 진입점이다.

---

## 프로젝트

**Spec-Design-Prototype Hub** — 기획자, 디자이너, 개발자가 AI를 중심으로 제품 개발 산출물(Markdown 기획서, Figma 디자인, Slot 기반 working mock, 개발자 export)을 하나의 버전 체계로 연결하여 작성·확인·관리·아카이브하는 사내 도구.

전체 제품 정의는 `docs/prd.md`에 있다. 작업 전 반드시 해당 PRD 섹션을 먼저 읽는다.

---

## 작업자와 역할

- 본 프로젝트는 **기획자 1인 + Claude Code 페어**로 개발한다.
- **기획자가 PRD와 의사결정의 주인**이다. Claude는 코드, 인프라, 기술적 트레이드오프의 제시자다.
- 기획자가 한국어로 대화한다. Claude의 답변과 문서도 기본 한국어. 코드 식별자만 영어.

### Claude의 행동 원칙 (중요)

1. **임의로 PRD를 줄이지 않는다.** PRD에 있는 25개 MVP 기능을 전부 만든다는 것이 합의된 전제다. 빼고 싶은 게 보이면 먼저 기획자에게 두세 가지 옵션과 함께 묻고, 결정이 나면 `docs/decisions.md`에 기록한 뒤에만 뺀다.
2. **기술 선택을 단독 결정하지 않는다.** 라이브러리 선택, 데이터 모델 변경, 인프라 변경 등 한 번 박으면 되돌리기 어려운 결정은 항상 "옵션 2~3개 + 트레이드오프 + 추천"을 제시하고 기획자가 고르게 한다.
3. **작업 단위는 작게.** 한 PR/커밋은 PRD의 한 sub-section 정도. 한 작업이 3일 이상 걸리면 더 작게 쪼갠다.
4. **모든 의사결정은 `docs/decisions.md`에 한 줄이라도 기록.** 기획자가 6개월 뒤 "왜 이렇게 했지?"를 찾을 수 있어야 한다.

---

## 합의된 의사결정 (요약)

자세한 건 `docs/decisions.md`. 핵심만:

- 외부 호스팅 서비스(Vercel, Supabase, Railway 등)를 **사용하지 않는다**. 모든 인프라는 본인 노트북 또는 사내 서버에서 돌아가야 한다.
- 로컬 개발 환경은 **Postgres와 Node를 직접 설치**(Docker 사용 안 함). 자세한 건 `docs/setup.md`.
- 사내 서버 배포는 v1 완성 후 별도 결정. 그때까지 **사내 서버 이전을 어렵게 만드는 패턴은 처음부터 피한다** (자세한 건 아래 "위험 1·2·3 방어 코드 원칙").

---

## 스택

| 영역 | 선택 |
|---|---|
| 언어 | TypeScript |
| 프레임워크 | Next.js 16 App Router (D-011, Turbopack 기본) |
| DB | PostgreSQL 16 (로컬 직접 설치) |
| ORM | Prisma 7 (adapter 방식 — `@prisma/adapter-pg`) |
| 에디터 | Tiptap (Markdown 입출력) — Phase 1에서 도입 |
| UI | Tailwind CSS v4 + shadcn/ui |
| 인증 | dev seed user 우회 (D-010) — 사내 SSO 붙이는 시점에 `src/lib/auth/current-user.ts` 본문만 갈아끼움 |
| AI | Anthropic SDK + Claude Code SDK (sub-process) — Phase 4에서 도입 |
| Git 조작 | simple-git — Phase 3에서 도입 |

새 라이브러리를 도입할 때는 반드시 기획자에게 옵션 제시 후 결정.

---

## 두 레포 구조

이 프로젝트는 **두 개의 Git 레포**로 구성된다.

1. **hub repo (이 레포)** — Next.js 풀스택 앱. Spec 관리, Slot Registry, AI Runner, Export.
2. **prototype repo (별도)** — Next.js 앱. Slot 기반 working wireframe. 사용자가 preview에서 실제로 보는 화면.

두 레포는 같은 머신의 인접한 경로에 둔다. 권장:

```
~/work/spec-design-prototype-hub/   ← 이 레포 (hub)
~/work/prototype-repo/                ← Slot 기반 prototype
```

Hub의 `.env`에 `PROTOTYPE_REPO_PATH`로 prototype repo의 절대 경로를 박는다. Hub의 AI Runner는 `simple-git`으로 이 경로의 worktree를 조작한다.

**Prototype repo는 Phase 3에서 처음 init한다.** Phase 0~2까지는 hub repo만 다루면 된다.

---

## Git worktree 위치 규약 (D-044)

**Claude Code 가 isolation 모드로 worktree 를 만들 때 기본 경로는
`<repo>/.claude/worktrees/<name>/` 인데, 이 경로에서 `npm run dev` 를 돌리면 Mac 이
freeze 된다. 반드시 `~/work/` 같은 별도 경로로 옮긴 다음에 dev 서버를 띄운다.**

### 왜
- `<repo>/.claude/` 는 Claude Code 의 세션 디렉토리. agent 가 watch 중.
- Next dev (Turbopack) 는 `.next/dev/` 에 초당 수천 개 파일을 쓴다.
- worktree 가 `.claude/` 안에 있으면 그 모든 쓰기가 Claude watcher 로 흘러들어가
  fsevents 폭주 → 시스템 freeze.

### 새 worktree 만들 때 절차

```bash
# 1) Claude Code isolation 으로 만들어졌든, 수동으로 만들었든
#    .claude/ 안에 있다면 즉시 옮긴다.
mkdir -p ~/work
git -C <main-repo> worktree move \
  <main-repo>/.claude/worktrees/<name> \
  ~/work/<name>

# 2) 옮긴 후 옛 경로에 stale .next 가 있으면 지운다.
#    (대부분 자동 이동되지만 옛 위치에 흔적이 남기도 함)

# 3) 새 경로에서만 dev 를 돌린다.
cd ~/work/<name> && npm run dev
```

### 추가 안전장치
- `next.config.ts` 에 `turbopack.root = path.resolve(__dirname)` 박혀있다.
  worktree 가 메인 레포 안에 있더라도 Turbopack 의 file watcher 가 상위로 안 올라가도록.
- 메인 레포 / 다른 worktree 에 stale `.next/` 가 남아있다면 회수하는 게 좋다 (수 백 MB ~ 1GB).

---

## 위험 1·2·3 방어 코드 원칙 (사내 서버 이전 비용을 작게 유지)

지금은 로컬에서만 돌리지만, 나중에 사내 서버로 옮길 때 비용을 작게 유지하려면 다음 세 가지를 처음부터 지킨다.

### 방어 1 — Prototype repo 경로는 환경변수로만

- 코드에 절대 경로를 박지 않는다. 항상 `process.env.PROTOTYPE_REPO_PATH`로 읽는다.
- Git 조작은 **한 모듈에 모은다**: `src/lib/prototype-repo.ts`. 나중에 환경이 바뀌어도 이 모듈만 갈아끼우면 된다.
- "Hub 인스턴스가 단 하나"라는 암묵적 가정을 코드에 박지 않는다. 전역 변수, in-memory lock 같은 거 피한다. 필요하면 DB row의 lock 컬럼으로.

### 방어 2 — Preview URL은 base + slug 조합으로 런타임 계산

- DB에 `preview_url` 같은 절대 URL 컬럼을 두지 않는다.
- 대신 `preview_branch` 또는 `preview_slug` 같은 식별자만 DB에 저장.
- 런타임에 `${process.env.PROTOTYPE_PREVIEW_BASE_URL}/${slug}` 형태로 조합.
- 그래야 사내 서버 가서 base URL이 바뀌어도 DB 마이그레이션이 필요 없다.

### 방어 3 — AI Runner는 한 모듈에 격리 + 진행 상태 DB 기록

- AI Runner 관련 코드는 `src/lib/ai-runner/` 디렉토리에 모은다.
- `app/api/ai/tasks/[id]/route.ts` 같은 곳에선 lib 모듈을 호출만 한다.
- AI Task의 진행 상태(`pending` → `plan_generated` → `applying` → `preview_ready` → `published` 등)를 DB에 단계별 기록.
- 서버 재시작/장애 시 어디까지 진행됐는지 알 수 있어야 한다. 멱등성(idempotent) 유지.
- sub-process 호출은 타임아웃과 취소 로직을 처음부터 넣는다.

---

## 진실의 원천 (Source of Truth)

| 무엇 | 원천 |
|---|---|
| 제품 요구사항 | `docs/prd.md` |
| 데이터 모델 | `docs/erd.md` + `prisma/schema.prisma` (둘은 항상 일치) |
| API 명세 | `docs/api.md` |
| Slot 인터페이스 | `docs/slot-contract.md` (hub repo와 prototype repo 양쪽에 동일하게 둠) |
| 작업 진행 단위 | `docs/development-phases.md` |
| 의사결정 이력 | `docs/decisions.md` |
| 로컬 환경 셋업 | `docs/setup.md` |
| 사내 서버 이전 가이드 | `docs/deployment.md` (v1 완성 후 채움) |

---

## 작업 시작 시 체크리스트

새 작업/PR을 시작할 때마다:

- [ ] `docs/development-phases.md` 확인 — 지금이 어느 Phase인지
- [ ] 관련된 `docs/prd.md` 섹션 다시 읽기
- [ ] `docs/erd.md` — 건드릴 엔티티 확인
- [ ] `docs/api.md` — 영향 받는 endpoint 확인
- [ ] Slot 관련이면 `docs/slot-contract.md` 확인
- [ ] `docs/decisions.md` — 과거에 결정한 것 중 영향 받는 것

---

## 작업 종료 시 체크리스트

PR/커밋 마무리 전:

- [ ] 데이터 모델 변경했으면 **`docs/erd.md`도 같은 커밋에서 갱신**했는가?
- [ ] 새 endpoint 만들었으면 `docs/api.md`에 명세 추가했는가?
- [ ] Slot contract 영향 있었으면 `docs/slot-contract.md` 갱신했는가?
- [ ] 의사결정 있었으면 `docs/decisions.md`에 한 줄이라도 적었는가?
- [ ] 마이그레이션 파일 생성했는가? (`npx prisma migrate dev --name <설명>`)
- [ ] 로컬에서 `npm run dev` 띄우고 클릭 테스트 했는가?
- [ ] PRD 18장 가격필터 시나리오에 영향 있으면 그 시나리오 처음~끝 클릭 테스트 했는가?

---

## 명령어

```bash
# 의존성
npm install                        # postinstall에서 prisma generate 자동 실행

# 개발 서버 — http://localhost:3000
npm run dev

# 빌드 / 프로덕션 실행
npm run build
npm start

# 타입체크 / 린트
npm run typecheck                  # tsc --noEmit
npm run lint                       # eslint

# 시드 데이터 (dev seed user 만들기 — 최초 셋업 + 시나리오 추가 시)
npm run seed

# DB
npm run db:migrate -- --name <설명>   # 마이그레이션 생성+적용 (= prisma migrate dev)
npm run db:studio                   # Prisma Studio (DB GUI)
```

### 자주 쓰는 한 줄 (트러블슈팅)

```bash
# Postgres 서비스 상태
brew services list | grep postgres

# DB 직접 접속
psql spec_hub_dev

# Prisma client만 다시 생성 (schema 변경 후 마이그레이션은 안 돌리고)
npx prisma generate
```

---

## 절대 하지 말 것

- 외부 호스팅 서비스에 의존하는 코드 추가 (Vercel KV, Supabase Auth 등)
- 데이터 모델만 바꾸고 `docs/erd.md` 안 바꾸기
- 두세 가지 옵션 제시 없이 라이브러리/스택 결정
- `docs/decisions.md`에 기록 없이 PRD에서 기능 빼기
- prototype repo 경로 하드코딩
- preview URL을 DB에 절대 URL로 저장
- AI Runner 코드를 여기저기 흩뿌리기
- **`<repo>/.claude/worktrees/...` 안에서 `npm run dev` 돌리기** — Mac freeze.
  반드시 `~/work/<name>/` 같은 별도 경로로 worktree 옮긴 뒤에 dev 띄운다. (D-044)
- `try { await serverAction() } catch (e) { alert(e.message) }` 패턴에서
  NEXT_ digest 에러를 흡수하기 — 반드시 `isNextControlFlowError(e)` 로 거르고 다시 throw. (D-042)
