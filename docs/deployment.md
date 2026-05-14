# 사내 서버 이전 가이드

**v1이 본인 노트북에서 동작하는 게 확인된 후에 채운다.** 지금은 결정 사항 정리와 사전 준비 체크리스트만.

---

## 지금은 채울 수 없는 이유

사내 서버를 어떻게 쓸 수 있는지 아직 모르는 단계라서 (어떤 OS인지, Docker 가능한지, 사내 K8s/PaaS가 있는지, 외부 DB가 따로 있는지 등) 결정할 수 없다.

대신, **그 시점에 결정을 쉽게 만들기 위한 사전 준비**를 코드에 미리 박아둔다. `CLAUDE.md`의 "위험 1·2·3 방어 코드 원칙" 참조.

---

## v1 완성 후 결정해야 할 것

### 1. 어디에 배포할 것인가

옵션 (가능성이 있는 것부터):

- **A. 사내 Linux 서버 한 대에 docker-compose** — 본인이 SSH 접속 가능, Docker 설치 가능한 경우. 가장 단순
- **B. 사내 Linux 서버 한 대에 직접 설치** — Docker 불가능한 경우. Node + Postgres + nginx 직접 설치
- **C. 사내 K8s 클러스터에 Deployment** — 회사가 이미 K8s 운영 중이고 인프라 팀이 도와줄 수 있는 경우
- **D. 사내 PaaS (사내 Heroku-like 도구)** — 있다면

이 결정 전에 다음을 확인한다.

- 사내 서버에 SSH 접속 가능한가? 또는 누가 deploy를 해줄 수 있나?
- Docker 설치 가능한가?
- 사내 K8s/PaaS가 있나? 1인 프로젝트도 받아주나?
- DB는 별도로 제공받을 수 있나, 또는 같은 서버에 두는가?
- HTTPS 인증서 발급 방식?
- 사내 DNS — `spec-hub.internal` 같은 도메인을 받을 수 있나?
- 사내 SSO/IdP 연동 가능 여부 (Google → 사내 IdP로 교체)

### 2. preview infra

v1 단계에선 prototype 인스턴스 한 개만 띄우는 단순 구조였다. 사내 서버에선 어떻게 할지.

- **단순 유지** — 한 번에 한 명만 preview. 1~3인 사용 단계엔 충분
- **포트 풀** — pm2 또는 systemd로 worktree마다 다른 포트에 prototype 인스턴스. nginx upstream 동적 reload
- **컨테이너 동적 생성** — docker-compose 환경이면 가능. K8s면 Pod 동적 생성

PRD MVP에선 "단순 유지"로 충분.

### 3. 외부 의존성

다음을 사내 환경에서 어떻게 처리할지.

- **Anthropic API** — 사내 네트워크에서 외부 인터넷 호출 가능한가? Proxy 필요한가?
- **Google OAuth** — 사내 IdP로 교체할지, OAuth는 유지하고 사내 사용자만 허용할지
- **외부 npm registry** — 사내 mirror가 있는가?

---

## 사전 준비 (지금부터 지키는 것)

`CLAUDE.md`의 "위험 1·2·3 방어 코드 원칙"을 처음부터 지킨다.

### 방어 1 — Prototype repo 경로 환경변수화

```ts
// src/lib/prototype-repo.ts
const REPO_PATH = process.env.PROTOTYPE_REPO_PATH;
if (!REPO_PATH) throw new Error("PROTOTYPE_REPO_PATH not set");
```

코드에 절대 경로 하드코딩 금지. Git 조작은 이 모듈에 모두 모음.

### 방어 2 — Preview URL은 base + slug 조합

DB에는 `slug`(또는 branch 이름)만 저장. 응답 시 런타임에 조합:

```ts
const url = `${process.env.PROTOTYPE_PREVIEW_BASE_URL}/preview/${slug}/${path}`;
```

### 방어 3 — AI Runner는 한 모듈에 격리 + DB 진행 상태

`src/lib/ai-runner/` 안에만 AI 관련 코드. API route는 lib만 호출.

AI Task의 status를 DB에 단계별 기록 (`pending` → `plan_generated` → ...). 서버 재시작해도 어디까지 진행됐는지 알 수 있게 idempotent.

### 기타

- 모든 외부 호스트(`localhost`, `127.0.0.1` 등)는 환경변수로
- 시크릿은 모두 `.env` (커밋 안 함)
- 데이터베이스 마이그레이션은 Prisma migrate로 — 사내 서버에서 `prisma migrate deploy`로 재현 가능
- 파일 업로드 경로(`uploads/exports/`)도 환경변수로 외부에서 변경 가능하게

---

## 이전 시점 작업 (v1 완성 후 채울 섹션)

> 이 섹션은 v1 완성 후 실제 사내 서버 환경이 정해지면 채운다. 지금은 placeholder.

### A. docker-compose 시나리오인 경우

[ ] `docker-compose.prod.yml` 작성
[ ] Hub Dockerfile 작성
[ ] prototype Dockerfile 작성
[ ] nginx 설정 (reverse proxy + HTTPS)
[ ] 사내 서버에 SSH 접속 → Docker 설치 확인
[ ] DB 마이그레이션
[ ] 시크릿 환경변수 주입 방법 결정 (.env 직접 vs Vault 등)
[ ] 로그 수집 방식 결정
[ ] 백업 정책

### B. 직접 설치 시나리오인 경우

[ ] 사내 서버 OS 확인 후 setup.md의 Linux 가이드 따라 설치
[ ] systemd 서비스 파일 작성 (hub.service, prototype.service)
[ ] nginx 설정
[ ] 자동 재시작 / 로그 / 백업

### C. K8s 시나리오인 경우

[ ] Hub Dockerfile + image registry push
[ ] Deployment / Service / Ingress manifest
[ ] PersistentVolumeClaim (prototype repo worktree 저장용 — RWX 필요)
[ ] Secret 관리
[ ] HPA 설정 여부

---

## CI/CD

이전 시점에 함께 결정.

- GitHub Actions로 사내 서버에 자동 배포 — Actions에서 사내 서버 SSH 가능한가? 사내 네트워크라면 self-hosted runner가 필요할 수도
- 또는 사내 GitLab/Jenkins 같은 도구
- 자동 lint / typecheck / test는 처음부터 GitHub Actions에 걸어둬도 OK (코드만 검사하니 외부 접속 불필요)
