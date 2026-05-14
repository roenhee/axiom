# 개발 단계 (Phase 0 ~ 6)

PRD 25개 MVP 기능 전체를 만들기 위한 작업 단위. 각 Phase는 위에서 아래로 순서대로 진행한다. 한 Phase가 끝나야 다음으로 간다.

**1인 + Claude Code 페어 기준 추정 일정: 약 14~18주.** 단, 실제 진행은 화면 단위로 끊으며, 일정은 가이드일 뿐이다.

매 작업은 다음 사이클을 돈다.

1. 그리기 — 만들 화면/기능을 종이나 글로 5~10줄 정리
2. 모델 확인 — 필요한 DB 컬럼이 schema에 있는지 점검. 없으면 schema 먼저 수정 + 마이그레이션
3. 시키기 — Claude Code에 작업 지시. 관련 docs 파일을 컨텍스트에 같이 넣음
4. 돌려보기 — `npm run dev`로 실제 클릭 테스트
5. 커밋 + docs 갱신 + `decisions.md` 한 줄

---

## Phase 0 — 기반 (약 1주)

### 목표

Next.js 프로젝트가 init되고, Postgres에 연결되고, Google 로그인이 동작하고, 빈 홈 화면이 뜬다.

### 작업

- [ ] `npx create-next-app@latest`로 Next.js 15 + TypeScript + App Router + Tailwind init
- [ ] shadcn/ui 셋업 (`npx shadcn-ui@latest init`)
- [ ] Prisma 셋업 + `prisma/schema.prisma` 첫 모델(User만) + 첫 마이그레이션
- [ ] NextAuth 셋업 + Google OAuth provider + User 모델 연동
- [ ] 로그인 페이지, 빈 `/` 홈 화면
- [ ] `package.json`에 스크립트 정리 (`dev`, `typecheck`, `lint`, `seed` 빈 placeholder 등)
- [ ] `CLAUDE.md`의 "명령어" 섹션을 실제 값으로 갱신
- [ ] `docs/decisions.md`에 Phase 0 결정사항 기록

### Definition of Done

- `npm run dev` → 브라우저 `http://localhost:3000` → Google 로그인 → 로그인된 빈 홈 화면이 뜬다
- 로그아웃 동작
- `npx prisma studio`로 User 테이블 보이고 본인 row가 있다

---

## Phase 1 — Spec 계층 + Version (약 2~3주)

### PRD 참조

- 6장 (정보 구조와 문서 계층)
- 7장 (Revision / Version 정책)
- 4장 (권한) — UserRole 모델만 생성. 실제 enforcement는 Phase 5

### 목표

기획자가 프로젝트를 만들고, 폴더 안에 Markdown Spec을 작성하고, Version을 Publish할 수 있다. 이 단계만 끝나도 "기획서 도구"로 단독 사용 가능.

### 작업

- [ ] Prisma 모델: Project, Folder, Spec, SpecVersion, Revision, UserRole (`docs/erd.md` 참조)
- [ ] Project 목록 / 생성 / 설정 페이지
- [ ] Folder 자유 CRUD (트리 UI)
- [ ] Spec 타입 enum: `FeatureGroup`, `Feature`, `Component`, `Tab`, `State`
- [ ] Spec 목록 + 생성
- [ ] Spec Detail — Tiptap Markdown 에디터
- [ ] Revision 자동저장 (onBlur 또는 30초 debounce)
- [ ] Version Publish (Draft → Published 상태 전이)
- [ ] Version history 페이지 (목록 + diff는 후순위)
- [ ] 관계 정보 입력 UI — `parent`, `contains`, `depends_on` 등 (PRD 6.4)
- [ ] `docs/api.md`에 이 단계 endpoint 추가
- [ ] `docs/erd.md` 최신화

### Definition of Done

- 빈 프로젝트 → 폴더 만들기 → Spec(Component 타입) 만들기 → Markdown 작성 → 30초 후 Revision 자동저장 → "Publish v1" → version 히스토리에 v1 표시
- Revision 5개 만들고 v1 → 추가 편집 → v2 Publish → 두 버전 모두 history에 보임

---

## Phase 2 — Figma 연결 + Compare View (약 1.5~2주)

### PRD 참조

- 5.2장 (Figma)
- 8장 (Figma 연결 정책)

### 목표

Spec에 Figma frame URL을 연결하고, 좌측 Spec / 우측 Figma의 Compare View로 함께 본다.

### 작업

- [ ] Prisma 모델: FigmaFrame, Spec↔FigmaFrame 다대다 연결 테이블
- [ ] Figma URL paste UI — frame ID 파싱 (`figma.com/file/{key}/?node-id={id}` 패턴)
- [ ] `figma.com/embed?...` 형태로 iframe embed
- [ ] required / recommended / optional / not_needed 4단계
- [ ] Figma Coverage 계산 + UI 표시 (PRD 8.3)
- [ ] Compare View 페이지 — 좌측 Spec markdown 렌더 / 우측 Figma iframe
- [ ] `docs/api.md`, `docs/erd.md` 갱신

### Definition of Done

- Spec Detail에서 Figma URL 추가 → embed로 보임
- 한 Spec에 여러 Figma frame 연결 → 각 frame의 required level 설정
- Coverage 표시 (예: "4 / 5 connected")
- Compare View에서 좌우 동시 보기

---

## Phase 3 — Slot 모델 + Registry + Prototype repo (약 3~4주, 가장 어려운 단계 1/2)

### PRD 참조

- 9장 (Prototype Repo 역할)
- 10장 (Slot 기반 Prototype 모델)
- 11장 (Slot Registry 정책)

### 목표

Hub에서 Surface/Tab/Region을 정의하고, SlotComponent/Variation/Instance를 등록한다. 별도 prototype repo가 Hub DB의 registry를 읽어 Slot을 실제로 렌더링하고, Hub는 그 prototype을 iframe으로 임베드한다.

### 작업 (hub repo)

- [ ] Prisma 모델: Surface, Tab, Region, SlotComponent, SlotVariation, SlotInstance, SyncRecord (`docs/erd.md`)
- [ ] 각 모델별 CRUD UI
- [ ] Slot Registry 조회/편집 페이지
- [ ] `src/lib/prototype-repo.ts` — Git 조작 모듈 ("방어 1" 원칙)
- [ ] Hub에서 prototype repo에 `registry/registry.json` 생성/갱신 (`simple-git`으로 commit/push)
- [ ] Slot Detail 페이지 — Spec 링크, Figma 링크, Prototype Preview iframe 한 화면
- [ ] Preview URL은 base + slug 조합으로 런타임 계산 ("방어 2" 원칙)

### 작업 (prototype repo — Phase 3 진입 시 별도 init)

- [ ] `~/work/prototype-repo`에서 `npx create-next-app` (slot-contract.md 따라 셋업)
- [ ] 디렉토리 구조: `surfaces/`, `slots/{component}/{variation}/`, `mock-data/`, `scenarios/`, `app/slot-renderer/`
- [ ] `registry/registry.json`을 읽고 동적으로 Slot 렌더링하는 SlotRenderer
- [ ] 샘플 Slot 한 개 (예: `PriceFilterSlot.search_all_tab`) 수동 작성

### Definition of Done

- Hub에서 새 Surface/Tab/Region/Slot 추가 → Hub가 prototype repo의 registry.json 갱신 + commit
- prototype repo `npm run dev` → 해당 Slot이 실제로 화면에 렌더
- Hub의 Slot Detail에서 그 Slot의 prototype preview가 iframe으로 임베드되어 보임
- PRD 18장 가격필터 시나리오 Step 1~4까지 동작

---

## Phase 4 — AI Task Plan + Patch + Preview (약 3~4주, 가장 어려운 단계 2/2)

### PRD 참조

- 12장 (AI 목업 생성/수정 플로우)
- 3.4장 (AI는 격리된 proposal 생성자)

### 목표

기획자가 AI 목업 생성을 요청하면, Hub가 AI Task Plan을 LLM으로 만들고, 사용자 확인 후 Claude Code SDK로 prototype repo worktree에서 patch 생성, Preview Ready 상태로 만든다.

### 작업

- [ ] Anthropic SDK 셋업
- [ ] `src/lib/ai-runner/` — 모든 AI 코드 격리 ("방어 3" 원칙)
- [ ] AI Task Plan 생성 API — 입력(Spec version + Slot context + 사용자 prompt) → 출력(PRD 12.5 7개 항목 JSON)
- [ ] AI Task Plan 확인/수정 UI (modal)
- [ ] worktree 생성 — `simple-git`으로 prototype repo의 새 branch + 임시 디렉토리 checkout
- [ ] Claude Code SDK sub-process 호출 — Task Plan을 입력, worktree에서 patch 생성
- [ ] `scripts/validate-slot-scope.ts` (prototype repo 안) — 변경 파일이 editable paths 안에 있는지 검증
- [ ] 통과하면 commit + push → preview build → prototype 인스턴스 재시작 → preview URL 갱신
- [ ] Preview Ready 상태 → 사용자가 Compare View에서 확인 → Publish 버튼
- [ ] Publish 시 main branch에 merge
- [ ] AI Task 진행 상태 DB 기록 — `pending` → `plan_generated` → `applying` → `preview_ready` → `published`/`failed`
- [ ] 타임아웃 + 취소 로직

### Definition of Done

- 가격필터 시나리오 Step 5~9 동작
- AI가 editable paths 밖 파일을 수정하면 validation에서 reject되고 사용자에게 표시
- Preview에서 실제 동작하는 mock이 보임
- 서버 재시작해도 진행 중이던 Task의 상태가 보존됨

---

## Phase 5 — Publish / Rollback / Sync / 댓글 / Export / 권한 (약 3~4주)

### PRD 참조

- 13장 (Publish / Rollback)
- 14장 (Sync Status)
- 15장 (댓글 / 확인 요청)
- 16장 (Developer Export)
- 4장 (권한) — 실제 enforcement

### 목표

PRD의 협업/운영 기능을 채운다.

### 작업

#### Publish / Rollback (13장)

- [ ] Slot Variation Publish + Published history (Spec ver, Figma frame, Prototype commit 모두 기록)
- [ ] Slot Variation 단위 Rollback (git revert 또는 이전 commit reset + registry 되돌리기)
- [ ] Prototype commit 단위 Rollback

#### Sync Status (14장)

- [ ] SyncRecord 모델
- [ ] 6개 상태 (`Not Checked`, `Checking Requested`, `Synced`, `Needs Update`, `Mismatch Found`, `No Impact`)
- [ ] 단위 4종 (Slot Variation, Slot Instance, Surface/Mock View, Spec Version)
- [ ] Sync 확인 요청 — 담당자 선택 + 메모

#### 댓글 (15장)

- [ ] Comment 모델
- [ ] Spec Version / Slot Variation / Sync 요청에 댓글
- [ ] thread, mention, resolved는 후순위 — 단순 평면 리스트

#### Developer Export (16장)

- [ ] ExportPackage 모델
- [ ] Feature Export / Slot Export 두 단위
- [ ] Draft / Official 두 종류
- [ ] export-manifest.json 생성 (PRD 16.6)
- [ ] CLAUDE.md / codex.md / AGENTS.md 템플릿 생성 (PRD 16.7)
- [ ] zip 압축 + 로컬 디스크 저장 (`uploads/exports/`) + 다운로드 URL

#### 권한 (4장)

- [ ] Project Owner / Prototype Owner / Task Owner / Viewer 4단계
- [ ] middleware에서 action 단위 enforcement
- [ ] 담당자 metadata — spec_owner, design_contact, prototype_contact, slot_owner

### Definition of Done

- 가격필터 시나리오 Step 10~11 동작
- Publish 후 → Rollback → 이전 상태로 복원 확인
- Sync Status 6개 상태 모두 토글 가능
- Feature Export 다운로드 → zip 열어보면 PRD 16.4 구조와 일치
- 권한 Viewer로 변경하면 Publish 버튼 사라짐

---

## Phase 6 — 다듬기 (약 1~2주)

### 목표

PRD 18장 가격필터 시나리오를 처음부터 끝까지 막힘없이 클릭으로 따라갈 수 있다.

### 작업

- [ ] PRD 18장 시나리오 처음~끝 클릭 테스트, 막히는 곳 수정
- [ ] 빈 상태 / 에러 상태 / 권한 부족 화면
- [ ] 성능 — Spec 목록 100개 초과 시 paginate
- [ ] 작은 UX 개선 (단축키, 로딩 인디케이터 등)
- [ ] `docs/deployment.md` 작성 — 사내 서버 이전 가이드

### Definition of Done

- PRD 18장 전체 시나리오가 클릭만으로 끝까지 동작
- 다른 사람이 본인 노트북에 와서 따라할 수 있는 수준

---

## 후순위 (MVP 이후, PRD 17.4)

다음은 MVP 범위 밖. v2에서 검토.

- 자동 영향도 분석
- Figma API 기반 업데이트 감지
- screenshot diff 자동 비교
- Slack / email 알림
- GitHub PR 자동 생성
- 실제 개발 repo 연동
- 고급 권한 정책
- 자동 Sync 판단
- multi-slot 대규모 AI 변경
- full graph view
- dashboard / analytics
