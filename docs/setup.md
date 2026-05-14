# 로컬 환경 셋업 가이드

후보 2 (직접 설치) 방식. Docker 사용 안 함. 노트북에 Node와 PostgreSQL을 직접 설치한다.

---

## 1. Node.js 20+ 설치

### macOS

```bash
# nvm으로 설치 (권장 - 버전 관리 쉬움)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# 터미널 재시작 후
nvm install 20
nvm use 20
nvm alias default 20

# 또는 brew로 간단히
brew install node@20
```

### Linux (Ubuntu/Debian 사내 서버용)

```bash
# nvm 권장
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
```

확인:

```bash
node --version   # v20.x.x
npm --version
```

---

## 2. PostgreSQL 16 설치

### macOS

```bash
brew install postgresql@16
brew services start postgresql@16

# PATH에 추가 (zsh 기준)
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 동작 확인
psql --version
```

기본적으로 본인 macOS 사용자 이름으로 superuser가 만들어진다. 비밀번호 없이 접속 가능.

```bash
psql postgres
# postgres=# 프롬프트가 뜨면 OK
\q
```

### Linux (Ubuntu)

```bash
sudo apt update
sudo apt install -y postgresql-16
sudo systemctl start postgresql
sudo systemctl enable postgresql

# postgres 유저로 접속해서 본인 계정 만들기
sudo -u postgres psql
# postgres=#
CREATE USER myname WITH SUPERUSER PASSWORD 'devpass';
\q
```

---

## 3. 개발용 DB 생성

```bash
# macOS는 본인 이름으로 superuser이므로 그대로
createdb spec_hub_dev

# 또는 psql 안에서
psql postgres
# postgres=#
CREATE DATABASE spec_hub_dev;
\q
```

확인:

```bash
psql spec_hub_dev -c "SELECT version();"
```

---

## 4. 환경변수 (.env) 채우기

```bash
cp .env.example .env
```

`.env`를 열어서 다음 값들을 채운다.

### DATABASE_URL

macOS (본인 macOS 사용자 이름이 `myname`이라면):

```
DATABASE_URL="postgresql://myname@localhost:5432/spec_hub_dev"
```

Linux:

```
DATABASE_URL="postgresql://myname:devpass@localhost:5432/spec_hub_dev"
```

### NEXTAUTH_SECRET

```bash
# 무작위 시크릿 생성
openssl rand -base64 32
```

출력된 값을 `NEXTAUTH_SECRET`에 붙여 넣는다.

### NEXTAUTH_URL

로컬은 `http://localhost:3000`.

### GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

[Google Cloud Console](https://console.cloud.google.com/) → 새 프로젝트 → OAuth 동의 화면 → OAuth 2.0 클라이언트 ID 생성:

- 애플리케이션 유형: 웹 애플리케이션
- 승인된 리디렉션 URI: `http://localhost:3000/api/auth/callback/google`

발급된 client ID, secret을 `.env`에 채운다.

### ANTHROPIC_API_KEY

[Anthropic Console](https://console.anthropic.com/) → API Keys에서 발급. (Phase 4 들어가야 실제로 필요)

### PROTOTYPE_REPO_PATH

Phase 3 가서 채운다. Phase 0~2에선 비워둬도 됨.

권장 경로:

```
PROTOTYPE_REPO_PATH="/Users/myname/work/prototype-repo"
```

(macOS) 또는 `/home/myname/work/prototype-repo` (Linux).

### PROTOTYPE_PREVIEW_BASE_URL

Phase 3 후. 로컬은 `http://localhost:3001` 정도.

### HUB_BASE_URL

로컬은 `http://localhost:3000`. 추후 사내 서버 갈 때 변경.

---

## 5. Claude Code 데스크톱 앱

Claude Code 데스크톱 앱을 설치하고, 이 레포 디렉토리를 연다.

처음 열면 Claude Code가 `CLAUDE.md`를 읽고 컨텍스트를 잡는다. 이후 작업은 `docs/development-phases.md`의 Phase 0부터 따라간다.

---

## 6. (Phase 3 들어갈 때) prototype repo 준비

Phase 3 진입 직전에 별도 디렉토리에서 prototype repo를 init한다.

```bash
cd ~/work
mkdir prototype-repo
cd prototype-repo
git init
# Claude Code와 함께 Next.js init + slot-contract.md 따라 디렉토리 구조 만들기
```

자세한 건 `docs/slot-contract.md`와 `docs/development-phases.md`의 Phase 3 섹션 참조.

---

## 문제 해결

### `psql: command not found`

PATH에 Postgres bin 디렉토리 추가했는지 확인. macOS는 `/opt/homebrew/opt/postgresql@16/bin` (Apple Silicon) 또는 `/usr/local/opt/postgresql@16/bin` (Intel).

### `connection refused`

Postgres 데몬이 안 떠 있다.

```bash
# macOS
brew services list
brew services restart postgresql@16

# Linux
sudo systemctl status postgresql
sudo systemctl restart postgresql
```

### Prisma 마이그레이션 실패

`DATABASE_URL` 형식 확인. 비밀번호에 특수문자 있으면 URL 인코딩 필요.

### Google OAuth `redirect_uri_mismatch`

Google Cloud Console에서 승인된 리디렉션 URI를 `http://localhost:3000/api/auth/callback/google`로 정확히 일치시켜야 함. 끝의 슬래시 없음.
