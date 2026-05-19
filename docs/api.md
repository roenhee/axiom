# API 명세

**새 endpoint를 만들기 전에 이 파일에 먼저 명세를 적는다.** 코드 → 문서 순서가 아니라 문서 → 코드 순서.

Next.js App Router의 `app/api/.../route.ts` 패턴 사용. 단순 RESTful 스타일.

각 endpoint는 어느 Phase에서 도입되는지 표시. 지금은 모두 **초안**이며 Phase 진행 중 확정된다.

---

## 공통 규칙

- **인증**: NextAuth 세션 쿠키. middleware에서 미인증 시 401
- **권한 체크**: Phase 5부터 활성. 그 전엔 로그인만 확인
- **응답 포맷**: JSON. 에러는 `{ error: { code, message } }`
- **페이지네이션**: `?page=1&size=20` 형태. 기본 size 20, 최대 100
- **타임존**: 모든 datetime은 ISO 8601 with timezone (예: `2026-05-14T00:00:00+09:00`)

---

## Phase 0 — 인증

NextAuth 표준. `app/api/auth/[...nextauth]/route.ts`. 별도 명세 안 적음.

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/auth/signin` | GET | 로그인 페이지 |
| `/api/auth/callback/google` | GET | Google OAuth callback |
| `/api/auth/signout` | POST | 로그아웃 |
| `/api/auth/session` | GET | 현재 세션 |

---

## Phase 1 — Project / Folder / Spec / Version

### Project

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/projects` | GET | 내가 멤버인 프로젝트 목록 |
| `/api/projects` | POST | 새 프로젝트 생성 |
| `/api/projects/:id` | GET | 프로젝트 상세 |
| `/api/projects/:id` | PATCH | 프로젝트 수정 |
| `/api/projects/:id` | DELETE | 프로젝트 아카이브 (soft delete) |

POST 요청 body:

```json
{
  "name": "검색팀 프로젝트",
  "slug": "search-team"
}
```

### Folder

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/projects/:projectId/folders` | GET | 프로젝트의 폴더 트리 |
| `/api/projects/:projectId/folders` | POST | 폴더 생성 |
| `/api/folders/:id` | PATCH | 이름/순서/부모 변경 |
| `/api/folders/:id` | DELETE | 폴더 삭제 (안에 Spec 없을 때만) |

### Spec

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/projects/:projectId/specs` | GET | Spec 목록 (folder, type 필터) |
| `/api/projects/:projectId/specs` | POST | Spec 생성 |
| `/api/specs/:id` | GET | Spec 상세 (메타데이터 + 최신 Draft) |
| `/api/specs/:id` | PATCH | 메타데이터 수정 (담당자 등) |
| `/api/specs/:id` | DELETE | Spec 삭제 |
| `/api/specs/:id/relations` | GET | 관계 정보 |
| `/api/specs/:id/relations` | POST | 관계 추가 |
| `/api/specs/:id/relations/:relationId` | DELETE | 관계 삭제 |

### Revision (자동저장)

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/specs/:id/revisions` | GET | Revision 목록 (페이지네이션) |
| `/api/specs/:id/revisions` | POST | 새 Revision 저장 (Tiptap 자동저장이 호출) |

POST body:

```json
{
  "markdown": "..."
}
```

### SpecVersion (공식 스냅샷)

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/specs/:id/versions` | GET | 버전 히스토리 |
| `/api/specs/:id/versions` | POST | 새 Version Publish |
| `/api/spec-versions/:id` | GET | 버전 상세 |
| `/api/spec-versions/:id/archive` | POST | Archived로 전환 |

POST `/api/specs/:id/versions` body:

```json
{
  "versionLabel": "v2",
  "changeSummary": "validation error 상태 추가",
  "changeType": "feature"
}
```

응답: 생성된 SpecVersion 객체.

---

## Phase 2 — Figma

D-015 에 따라 Phase 2 의 데이터 조작은 **Server Action 우선**. 아래 RESTful
표는 외부 통합/디버깅이 생길 경우의 참고용. 현재 사용 중인 server actions
는 모두 `src/server/figma-links/` 디렉토리.

### Server Actions (현재 구현)

| 함수 | 입력 | 동작 |
|---|---|---|
| `getFigmaPaneData(specId)` | specId | `listSpecFigmaLinks` + `getFigmaCoverage` 묶음. 가운데 패널 첫 fetch 용. |
| `listSpecFigmaLinks(specId)` | specId | Spec 에 연결된 frame 목록 (order asc). |
| `getFigmaCoverage(specId)` | specId | `{ total, byLevel, expectedCount, connectedCount }`. D-049 의 단순화 정의. |
| `createFigmaLink(formData)` | specId, url, label, requiredLevel | URL 파싱 → FigmaFrame upsert → SpecFigmaLink 생성. |
| `updateFigmaLinkLevel(linkId, level)` | linkId, FigmaRequiredLevel | requiredLevel 변경. |
| `renameFigmaFrame(formData)` | frameId, label | FigmaFrame.label 변경 (같은 frame 을 참조하는 모든 Spec 에 반영). |
| `deleteFigmaLink(linkId)` | linkId | Spec ↔ FigmaFrame 연결 해제. frame 자체는 남김. |

### URL 파싱 (`src/lib/figma-url.ts`)

받는 형태:
- `https://www.figma.com/file/{fileKey}/{name}?node-id=12-345`
- `https://www.figma.com/design/{fileKey}/{name}?node-id=12-345`
- `https://www.figma.com/proto/{fileKey}/{name}?node-id=12-345`

`node-id` 의 하이픈/콜론 형태 둘 다 받아 콜론 `12:345` 로 정규화 저장.
embed iframe src 는 `buildFigmaEmbedSrc(fileKey, nodeId)` 로 생성.

### RESTful 인터페이스 초안 (Phase 5+ 외부 통합 시)

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/specs/:id/figma-links` | GET | 이 Spec 의 Figma 연결 목록 |
| `/api/specs/:id/figma-links` | POST | Figma 연결 추가 (URL paste) |
| `/api/figma-links/:id` | PATCH | requiredLevel 변경 |
| `/api/figma-links/:id` | DELETE | 연결 해제 |
| `/api/figma-frames/:id` | PATCH | frame label 변경 |
| `/api/specs/:id/figma-coverage` | GET | coverage 계산 결과 |

POST `/api/specs/:id/figma-links` body:

```json
{
  "url": "https://www.figma.com/design/abc/Design?node-id=12-345",
  "label": "가격 필터 기본 상태",
  "requiredLevel": "required"
}
```

`getFigmaCoverage` 응답 (D-049 의 MVP 단순화):

```json
{
  "total": 5,
  "byLevel": { "required": 2, "recommended": 1, "optional": 2, "not_needed": 0 },
  "expectedCount": 3,
  "connectedCount": 3
}
```

PRD 8.3 의 `items` 별 connected/disconnected 항목 표시는 Scenario 모델이
들어오는 시점 (Phase 5) 에 재정의 — Phase 2 에선 byLevel 분포만 표시.

---

## Phase 3 — Slot 모델 + Registry

### Surface / Tab / Region

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/projects/:projectId/surfaces` | GET / POST | Surface 목록/생성 |
| `/api/surfaces/:id` | GET / PATCH / DELETE | |
| `/api/surfaces/:id/tabs` | GET / POST | |
| `/api/tabs/:id` | GET / PATCH / DELETE | |
| `/api/tabs/:id/regions` | GET / POST | |
| `/api/regions/:id` | GET / PATCH / DELETE | |

### SlotComponent / Variation / Instance

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/projects/:projectId/slot-components` | GET / POST | |
| `/api/slot-components/:id` | GET / PATCH / DELETE | |
| `/api/slot-components/:id/variations` | GET / POST | |
| `/api/slot-variations/:id` | GET / PATCH / DELETE | |
| `/api/regions/:regionId/slot-instances` | GET / POST | Region에 Slot Instance 배치 |
| `/api/slot-instances/:id` | GET / PATCH / DELETE | |

### Registry 동기화

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/projects/:projectId/registry/sync` | POST | DB → prototype repo registry.json 갱신 + commit |
| `/api/projects/:projectId/registry` | GET | DB 기준 registry JSON (Preview 빌드용) |

POST `/registry/sync` 응답:

```json
{
  "commitHash": "abc123",
  "changedFiles": ["registry/registry.json"]
}
```

### Preview

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/preview/url/:slotVariationId` | GET | 해당 variation의 preview URL 반환 |

응답 (방어 2 원칙에 따라 base + slug 조합):

```json
{
  "url": "http://localhost:3001/preview/main/slots/price-filter/search-all"
}
```

---

## Phase 4 — AI Task

### AI Task

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/ai-tasks` | POST | AI 목업 작업 요청 |
| `/api/ai-tasks/:id` | GET | Task 상태/세부 |
| `/api/ai-tasks/:id/plan` | GET | 생성된 Plan |
| `/api/ai-tasks/:id/plan` | PATCH | Plan 수정 (사용자가 검토 후) |
| `/api/ai-tasks/:id/approve-plan` | POST | Plan 승인 → patch 생성 시작 |
| `/api/ai-tasks/:id/cancel` | POST | 진행 중 Task 취소 |

POST `/api/ai-tasks` body:

```json
{
  "type": "UpdateSlotVariation",
  "specVersionId": "...",
  "slotVariationId": "...",
  "slotInstanceId": "...",
  "userPrompt": "validation error 상태 추가해줘"
}
```

응답: Task ID와 초기 상태 (`pending`).

GET `/api/ai-tasks/:id` 응답 예:

```json
{
  "id": "...",
  "status": "preview_ready",
  "plan": { ... },
  "branchName": "ai/task-abc",
  "previewSlug": "ai-task-abc",
  "previewUrl": "http://localhost:3001/preview/ai-task-abc/...",
  "changedFiles": ["slots/price-filter/search-all/index.tsx"],
  "createdAt": "..."
}
```

### Preview Deployment

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/preview-deployments/:id` | GET | Preview 상태 (building / ready / failed) |

---

## Phase 5 — 운영

### Publish

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/spec-versions/:id/publish` | POST | Spec Version Publish |
| `/api/slot-variations/:id/publish` | POST | Slot Variation Publish (AI Task에서 호출되거나 수동) |
| `/api/publish-records` | GET | 이력 (target, targetId 필터) |
| `/api/publish-records/:id/rollback` | POST | Rollback |

### Sync Status

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/sync-records` | GET | unit, targetId 필터 |
| `/api/sync-records` | POST / PATCH | 상태 업데이트 |
| `/api/sync-records/:id/request` | POST | 확인 요청 |

### Comment

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/comments` | GET | target, targetId 필터 |
| `/api/comments` | POST | 댓글 작성 |
| `/api/comments/:id` | DELETE | 본인 댓글 삭제 |

### Export

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/exports` | POST | Export 생성 요청 (async) |
| `/api/exports/:id` | GET | 상태 + 다운로드 URL |
| `/api/exports/:id/download` | GET | zip 파일 스트리밍 |

POST `/api/exports` body:

```json
{
  "unit": "Feature",
  "kind": "Official",
  "targetId": "feature.search.filter"
}
```

### Member / Role

| 경로 | 메소드 | 설명 |
|---|---|---|
| `/api/projects/:id/members` | GET | 멤버 목록 |
| `/api/projects/:id/members` | POST | 멤버 초대 |
| `/api/projects/:id/members/:userId` | PATCH | 권한 변경 |
| `/api/projects/:id/members/:userId` | DELETE | 제거 |

---

## 미정

- WebSocket / SSE 사용 여부 — AI Task 진행 상태 푸시. 일단 polling으로 시작
- 파일 업로드 endpoint — Export zip 다운로드 외 다른 용도 생기면 추가
- Search API — Spec 검색. Phase 5나 6에서 추가
