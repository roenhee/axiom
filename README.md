# Spec-Design-Prototype Hub

기획자, 디자이너, 개발자가 AI를 중심으로 제품 개발 산출물(기획서, Figma, Slot 기반 working mock, 개발자 export)을 하나의 버전 체계로 연결하여 작성·확인·관리·아카이브하는 사내 도구.

전체 제품 정의는 [`docs/prd.md`](docs/prd.md) 참조.

---

## 빠른 시작

### 1. 환경 준비

[`docs/setup.md`](docs/setup.md) 가이드를 따라 노트북에 Node 20+, PostgreSQL 16을 설치한다.

### 2. 레포 클론 + 환경변수

```bash
git clone <this-repo>
cd spec-design-prototype-hub
cp .env.example .env
# .env 파일 열어서 실제 값 채우기 (자세한 건 docs/setup.md)
```

### 3. Claude Code 열기

Claude Code 데스크톱 앱에서 이 레포 디렉토리를 연다. Claude Code가 자동으로 [`CLAUDE.md`](CLAUDE.md)를 읽는다.

### 4. 첫 작업: Phase 0

[`docs/development-phases.md`](docs/development-phases.md)의 **Phase 0** 항목을 Claude Code와 함께 진행한다.

Phase 0에서 다음을 init한다.

- Next.js 15 프로젝트
- Prisma + Postgres 연결
- Tailwind + shadcn/ui
- NextAuth Google OAuth
- 첫 빈 페이지 + 로그인

Phase 0이 끝나면 `npm run dev`로 띄워서 로그인 → 빈 홈 화면을 볼 수 있다.

---

## 디렉토리 구조

```
spec-design-prototype-hub/
├── CLAUDE.md                    ← Claude Code가 매번 자동으로 읽음
├── README.md                    ← 사람이 처음 읽는 파일 (지금 이 파일)
├── .env.example                 ← 환경변수 템플릿
├── .gitignore
└── docs/
    ├── prd.md                   ← 제품 요구사항 (Source of Truth)
    ├── setup.md                 ← 로컬 환경 셋업 가이드
    ├── development-phases.md    ← Phase 0~6 작업 계획
    ├── erd.md                   ← 데이터 모델
    ├── api.md                   ← API 명세
    ├── slot-contract.md         ← Slot 인터페이스 contract
    ├── deployment.md            ← 사내 서버 이전 가이드 (v1 후)
    └── decisions.md             ← 의사결정 이력
```

Phase 0이 끝나면 다음 디렉토리들이 추가된다.

```
├── src/                         ← Next.js 소스
├── prisma/                      ← Prisma schema + 마이그레이션
└── public/
```

---

## 두 레포 구조

이 프로젝트는 두 개의 Git 레포로 구성된다.

1. **이 레포 (hub)** — Next.js 풀스택 앱. Spec 관리, Slot Registry, AI Runner, Export.
2. **prototype repo (별도)** — Next.js 앱. Slot 기반 working wireframe.

**prototype repo는 Phase 3에서 처음 init한다.** Phase 0~2까지는 이 레포만 다루면 된다.

자세한 건 [`CLAUDE.md`](CLAUDE.md)의 "두 레포 구조" 섹션과 [`docs/slot-contract.md`](docs/slot-contract.md) 참조.

---

## 작업 방식

- **기획자 1인 + Claude Code 페어**로 개발
- 매 작업은 [`docs/development-phases.md`](docs/development-phases.md)의 한 항목 단위
- 의사결정은 [`docs/decisions.md`](docs/decisions.md)에 누적 기록
- 데이터 모델 / API / Slot contract 변경 시 해당 docs 파일도 같은 PR에서 갱신

자세한 작업 규칙은 [`CLAUDE.md`](CLAUDE.md) 참조.
