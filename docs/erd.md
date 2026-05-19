# ERD — 데이터 모델

**이 파일은 진실의 원천이다.** `prisma/schema.prisma`를 수정하면 반드시 같은 PR에서 이 파일도 갱신한다.

PRD 19.2 미정사항에서 시작한 1차 초안. Phase가 진행되며 각 엔티티의 필드/관계가 확정된다. 지금 확정된 것은 없고, 모두 **초안**이다.

엔티티는 어느 Phase에서 처음 도입되는지 표시했다.

---

## 엔티티 목록

| 엔티티 | 도입 Phase | 설명 |
|---|---|---|
| User | 0 | 사용자 |
| UserRole | 1 | 프로젝트별 권한 |
| Project | 1 | 최상위 작업 단위 |
| Folder | 1 | 자유로운 탐색 폴더 |
| Spec | 1 | 기획서 |
| SpecVersion | 1 | Spec의 공식 스냅샷 |
| Revision | 1 | Spec 자동저장 이력 |
| FigmaFrame | 2 | Figma frame 메타데이터 |
| Surface | 3 | 화면/route |
| Tab | 3 | Surface 내 탭 |
| Region | 3 | Tab 내 영역 |
| SlotComponent | 3 | 재사용 가능한 Slot 정의 |
| SlotVariation | 3 | Slot의 화면별 변형 |
| SlotInstance | 3 | 특정 Surface/Tab/Region에 배치된 Slot |
| AITask | 4 | AI 목업 작업 |
| AITaskPlan | 4 | AI Task의 Plan JSON 스냅샷 |
| PreviewDeployment | 4 | Preview URL 정보 |
| PublishRecord | 5 | Publish 이력 |
| SyncRecord | 5 | Sync Status |
| Comment | 5 | 단순 댓글 |
| ExportPackage | 5 | Developer Export 이력 |

총 21개. PRD 19.2의 18개에서 일부 분리/추가됨.

---

## Phase 0 — User

사내 SSO 붙기 전까지 dev seed user 한 명만 존재 (decisions.md D-010). NextAuth Account/Session 테이블은 만들지 않는다. `image`도 후순위.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt       @map("updated_at")

  // Phase 1 역관계
  roles                   UserRole[]
  specsAsTaskOwner        Spec[]        @relation("SpecTaskOwner")
  specsAsDesignContact    Spec[]        @relation("SpecDesignContact")
  specsAsPrototypeContact Spec[]        @relation("SpecPrototypeContact")
  specsAsSlotOwner        Spec[]        @relation("SpecSlotOwner")
  versionsCreated         SpecVersion[]
  revisions               Revision[]
  // Phase 5 에서 댓글 작성자 등이 추가될 예정

  @@map("users")
}
```

---

## Phase 1 — Spec 계층

> 실제 구현된 schema는 [prisma/schema.prisma](../prisma/schema.prisma) 가 진실. 이 섹션은 schema 와 1:1 미러.

### Project

```prisma
model Project {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  archived  Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt       @map("updated_at")

  folders Folder[]
  specs   Spec[]
  members UserRole[]

  @@map("projects")
}
```

### Folder

자유로운 탐색 폴더. 시스템과 AI가 사용하는 구조화 정보가 아니다 (PRD 6.2).

```prisma
model Folder {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  parentId  String?  @map("parent_id")
  name      String
  order     Int      @default(0)
  // 시스템 예약 폴더 — 삭제/이름변경/이동 차단. 새 프로젝트 자동 생성 "개발자 가이드".
  isLocked  Boolean  @default(false) @map("is_locked")
  createdAt DateTime @default(now()) @map("created_at")

  project  Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent   Folder?  @relation("FolderTree", fields: [parentId], references: [id], onDelete: Restrict)
  children Folder[] @relation("FolderTree")
  specs    Spec[]

  @@index([projectId, parentId])
  @@map("folders")
}
```

### Spec

```prisma
enum SpecType {
  FeatureGroup   // = Epic
  Feature
  Component
  State
}

model Spec {
  id                 String   @id @default(cuid())
  projectId          String   @map("project_id")
  folderId           String?  @map("folder_id")
  // 트리 nesting — 다른 Spec 의 자식 Spec. SpecRelation contains (의미적 참조, M:N) 와는 별개.
  parentSpecId       String?  @map("parent_spec_id")
  type               SpecType
  title              String
  taskOwnerId        String?  @map("task_owner_id")
  designContactId    String?  @map("design_contact_id")
  prototypeContactId String?  @map("prototype_contact_id")
  slotOwnerId        String?  @map("slot_owner_id")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt       @map("updated_at")

  project          Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  folder           Folder? @relation(fields: [folderId], references: [id], onDelete: SetNull)
  parent           Spec?   @relation("SpecTree", fields: [parentSpecId], references: [id], onDelete: SetNull)
  children         Spec[]  @relation("SpecTree")
  taskOwner        User?   @relation("SpecTaskOwner",        fields: [taskOwnerId],        references: [id], onDelete: SetNull)
  designContact    User?   @relation("SpecDesignContact",    fields: [designContactId],    references: [id], onDelete: SetNull)
  prototypeContact User?   @relation("SpecPrototypeContact", fields: [prototypeContactId], references: [id], onDelete: SetNull)
  slotOwner        User?   @relation("SpecSlotOwner",        fields: [slotOwnerId],        references: [id], onDelete: SetNull)

  versions      SpecVersion[]
  revisions     Revision[]
  relationsFrom SpecRelation[] @relation("FromSpec")
  relationsTo   SpecRelation[] @relation("ToSpec")

  @@index([projectId, folderId])
  @@index([projectId, parentSpecId])
  @@map("specs")
}

enum SpecRelationType {
  contains
  depends_on
  related_component
  related_slot
  related_figma          // Phase 2 이후 별도 테이블로 분리 가능 (지금은 평면 보관)
  related_prototype_route
  related_ai_task
}

model SpecRelation {
  id     String           @id @default(cuid())
  fromId String           @map("from_id")
  toId   String           @map("to_id")
  type   SpecRelationType

  from Spec @relation("FromSpec", fields: [fromId], references: [id], onDelete: Cascade)
  to   Spec @relation("ToSpec",   fields: [toId],   references: [id], onDelete: Cascade)

  @@unique([fromId, toId, type])
  @@index([toId, type])
  @@map("spec_relations")
}
```

### SpecVersion

PRD 7.3, 7.4. 공식 협업 기준 스냅샷.

```prisma
enum SpecStatus {
  Draft
  Published
  Archived
}

model SpecVersion {
  id            String     @id @default(cuid())
  specId        String     @map("spec_id")
  versionLabel  String     @map("version_label")
  status        SpecStatus @default(Draft)
  markdown      String     @db.Text
  apiSpec       String?    @map("api_spec") @db.Text  // D-040 OpenAPI YAML/JSON snapshot
  changeSummary String?    @map("change_summary")
  changeType    String?    @map("change_type")
  createdById   String     @map("created_by_id")
  publishedAt   DateTime?  @map("published_at")
  createdAt     DateTime   @default(now()) @map("created_at")

  spec      Spec @relation(fields: [specId], references: [id], onDelete: Cascade)
  createdBy User @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@unique([specId, versionLabel])
  @@index([specId, status])
  @@map("spec_versions")
}
```

### Revision

PRD 7.2. 자동 저장.

```prisma
model Revision {
  id        String   @id @default(cuid())
  specId    String   @map("spec_id")
  markdown  String   @db.Text
  apiSpec   String?  @map("api_spec") @db.Text  // D-040 OpenAPI YAML/JSON 자동 저장 snapshot
  authorId  String   @map("author_id")
  createdAt DateTime @default(now()) @map("created_at")

  spec   Spec @relation(fields: [specId], references: [id], onDelete: Cascade)
  author User @relation(fields: [authorId], references: [id], onDelete: Restrict)

  @@index([specId, createdAt])
  @@map("revisions")
}
```

### UserRole

PRD 4장. Phase 1에선 모델만 만들고, Phase 5에서 실제 enforcement.

```prisma
enum RoleLevel {
  Viewer
  TaskOwner
  PrototypeOwner
  ProjectOwner
}

model UserRole {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  projectId String    @map("project_id")
  level     RoleLevel

  user    User    @relation(fields: [userId],    references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId])
  @@map("user_roles")
}
```

### Attachment

D-038. 임의 파일 (PDF / 이미지 / zip 등) 첨부. 폴더 트리에 폴더/Spec 과 함께
배치 — 같은 부모 안에서 `order` 통합 공간 (D-036 연장). 실제 파일은
`${UPLOAD_STORAGE_DIR}/<projectId>/<storedName>` 에 저장.

**D-045**: Office 파일 (PPTX/DOCX/XLSX) 은 업로드 직후 LibreOffice 로 PDF 변환
하여 미리보기 fidelity 보장. 변환 결과 PDF 는 `<projectId>/<stored>.preview.pdf`
로 같은 디렉토리에 저장. 원본 PPTX/DOCX/XLSX 는 그대로 남아 다운로드 시 제공.
`previewStatus / previewPath / previewError` 3개 컬럼이 변환 상태 추적.

```prisma
model Attachment {
  id           String   @id @default(cuid())
  projectId    String   @map("project_id")
  folderId     String?  @map("folder_id")
  fileName     String   @map("file_name")    // 원본명 (UI 표시)
  storedName   String   @map("stored_name")  // 랜덤 + 확장자
  mimeType     String   @map("mime_type")
  size         Int
  order        Int      @default(0)
  uploadedById String   @map("uploaded_by_id")
  createdAt    DateTime @default(now()) @map("created_at")

  // D-045 — Office 미리보기 변환 상태
  previewStatus String? @map("preview_status")  // null|"converting"|"ready"|"failed"
  previewPath   String? @map("preview_path")    // "<projectId>/<stored>.preview.pdf"
  previewError  String? @map("preview_error") @db.Text

  project    Project @relation(fields: [projectId],   references: [id], onDelete: Cascade)
  folder     Folder? @relation(fields: [folderId],    references: [id], onDelete: SetNull)
  uploadedBy User    @relation(fields: [uploadedById], references: [id], onDelete: Restrict)

  @@index([projectId, folderId])
  @@map("attachments")
}
```

---

## Phase 2 — Figma

### FigmaFrame

PRD 8장. URL paste → fileKey + nodeId 파싱 후 upsert. 같은 프로젝트 안에서
(fileKey, nodeId) 는 단 하나 — 여러 Spec 이 같은 frame 을 공유한다.

```prisma
enum FigmaRequiredLevel {
  required
  recommended
  optional
  not_needed
}

model FigmaFrame {
  id           String   @id @default(cuid())
  projectId    String
  fileKey      String   // figma.com/file/{fileKey} 또는 /design/{fileKey}
  nodeId       String   // node-id 의 콜론 정규화 형태 (예: "12:345")
  label        String   // 사람이 붙이는 frame 이름 (PRD 8.3 "기본 상태")
  createdById  String
  createdAt    DateTime @default(now())

  project   Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy User            @relation(fields: [createdById], references: [id])
  links     SpecFigmaLink[]

  @@unique([projectId, fileKey, nodeId])
}

model SpecFigmaLink {
  id            String             @id @default(cuid())
  specId        String
  figmaFrameId  String
  requiredLevel FigmaRequiredLevel @default(optional)
  order         Int                @default(0)
  createdAt     DateTime           @default(now())

  spec       Spec       @relation(fields: [specId],       references: [id], onDelete: Cascade)
  figmaFrame FigmaFrame @relation(fields: [figmaFrameId], references: [id], onDelete: Cascade)

  @@unique([specId, figmaFrameId])
}
```

**Phase 2 MVP 결정 (D-046):**
- 연결 단위는 **Spec 만**. PRD 8.1 의 Slot Component / Variation / Instance 측
  연결은 Phase 3 진입 시 별도 테이블 또는 nullable 컬럼 추가로 결정.
- SpecVersion 단위 연결은 MVP 에선 두지 않음 — Figma 연결은 Spec 메타 성격으로,
  Version 마다 별도 frame 묶음을 따로 두지 않는다. AI/Export 기준 (PRD 7.6) 은
  Spec 의 markdown snapshot 만 Version 이고 Figma 는 현 시점 연결 그대로 사용.

---

## Phase 3 — Slot 모델

PRD 10장 구조 그대로.

### Surface

```prisma
model Surface {
  id        String   @id @default(cuid())
  projectId String
  surfaceId String   // 사용자 ID, e.g. "surface.search_result"
  label     String
  route     String   // "/search"
  createdAt DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id])
  tabs    Tab[]

  @@unique([projectId, surfaceId])
}
```

### Tab

```prisma
model Tab {
  id        String   @id @default(cuid())
  surfaceId String
  tabId     String   // "tab.search_result.all"
  label     String
  order     Int      @default(0)

  surface Surface @relation(fields: [surfaceId], references: [id])
  regions Region[]

  @@unique([surfaceId, tabId])
}
```

### Region

```prisma
model Region {
  id     String @id @default(cuid())
  tabId  String
  regionId String  // "region.search_result.all.filter"
  label  String
  order  Int     @default(0)

  tab           Tab @relation(fields: [tabId], references: [id])
  slotInstances SlotInstance[]

  @@unique([tabId, regionId])
}
```

### SlotComponent

```prisma
model SlotComponent {
  id              String   @id @default(cuid())
  projectId       String
  componentId     String   // "slot_component.price_filter"
  name            String   // "PriceFilterSlot"
  description     String?
  representativeSpecId String?
  createdAt       DateTime @default(now())

  project        Project @relation(fields: [projectId], references: [id])
  variations     SlotVariation[]
  // representativeSpec relation: Spec
}
```

### SlotVariation

```prisma
enum SlotVariationStatus {
  Draft
  PreviewReady
  Published
  Archived
}

model SlotVariation {
  id              String   @id @default(cuid())
  slotComponentId String
  variationId     String   // "slot_variation.price_filter.search_all_tab"
  label           String
  status          SlotVariationStatus @default(Draft)
  // prototype repo 안의 경로 prefix (e.g. "slots/price-filter/search-all")
  pathPrefix      String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  slotComponent SlotComponent @relation(fields: [slotComponentId], references: [id])
  instances     SlotInstance[]

  @@unique([slotComponentId, variationId])
}
```

### SlotInstance

```prisma
model SlotInstance {
  id              String   @id @default(cuid())
  instanceId      String   // "slot_instance.search_result.all.filter.price_filter"
  regionId        String
  slotVariationId String
  displayOrder    Int      @default(0)
  // 연결 정보
  specVersionId   String?
  // figma는 SpecFigmaLink로 연결

  region        Region        @relation(fields: [regionId], references: [id])
  slotVariation SlotVariation @relation(fields: [slotVariationId], references: [id])
  specVersion   SpecVersion?  @relation(fields: [specVersionId], references: [id])

  @@unique([regionId, instanceId])
}
```

---

## Phase 4 — AI Task

PRD 12장.

```prisma
enum AITaskType {
  CreateSlotVariation
  UpdateSlotVariation
  AddSlotScenario
  InsertSlotInstance
}

enum AITaskStatus {
  pending           // 사용자 요청만 들어옴
  plan_generated    // AI Task Plan 생성됨
  plan_approved     // 사용자가 Plan 확인 완료
  applying          // Claude Code SDK 실행 중
  preview_ready     // patch 적용 + preview 빌드 성공
  published         // main branch merge 완료
  failed
  cancelled
}

model AITask {
  id              String   @id @default(cuid())
  projectId       String
  type            AITaskType
  status          AITaskStatus @default(pending)
  requestedById   String
  userPrompt      String   @db.Text
  // 기준 정보
  specVersionId   String?
  slotComponentId String?
  slotVariationId String?
  slotInstanceId  String?
  // 결과
  branchName      String?  // worktree branch
  previewDeploymentId String?
  errorMessage    String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  requestedBy User @relation(fields: [requestedById], references: [id])
  plan        AITaskPlan?
  // 다른 relations
}
```

```prisma
model AITaskPlan {
  id           String   @id @default(cuid())
  aiTaskId     String   @unique
  planJson     Json     // PRD 12.5의 7개 항목
  approvedAt   DateTime?
  modifiedBy   String?  // 사용자가 plan을 수정했으면

  aiTask AITask @relation(fields: [aiTaskId], references: [id])
}
```

```prisma
model PreviewDeployment {
  id         String   @id @default(cuid())
  // 절대 URL을 저장하지 않는다 — base는 환경변수, slug만 저장
  slug       String   // 런타임에 ${PROTOTYPE_PREVIEW_BASE_URL}/${slug}로 조합
  commitHash String
  status     String   // "building", "ready", "failed"
  createdAt  DateTime @default(now())

  @@unique([slug])
}
```

---

## Phase 5 — 운영

### PublishRecord

```prisma
enum PublishTarget {
  SpecVersion
  SlotVariation
  // SlotInstance도 가능
}

model PublishRecord {
  id            String   @id @default(cuid())
  target        PublishTarget
  targetId      String   // SpecVersion.id 또는 SlotVariation.id
  publishedById String
  // 기준 정보 스냅샷
  specVersionId   String?
  figmaFrameIds   Json?    // [id, id, ...]
  prototypeCommit String?
  branchName      String?
  changeSummary   String?
  publishedAt     DateTime @default(now())

  publishedBy User @relation(fields: [publishedById], references: [id])
}
```

### SyncRecord

PRD 14장.

```prisma
enum SyncStatus {
  NotChecked
  CheckingRequested
  Synced
  NeedsUpdate
  MismatchFound
  NoImpact
}

enum SyncUnit {
  SlotVariation
  SlotInstance
  SurfaceMockView
  SpecVersion
}

model SyncRecord {
  id              String   @id @default(cuid())
  unit            SyncUnit
  targetId        String   // 단위에 따른 ID
  status          SyncStatus @default(NotChecked)
  // 현재 연결 기준
  specVersionId   String?
  figmaFrameId    String?
  prototypeCommit String?
  // 확인 요청 정보
  requestedById   String?
  assignedToId    String?
  requestMemo     String?
  lastCheckedById String?
  lastCheckedAt   DateTime?
  updatedAt       DateTime @updatedAt
}
```

### Comment

PRD 15장. 단순 평면 리스트.

```prisma
enum CommentTarget {
  SpecVersion
  SlotVariation
  SyncRecord
}

model Comment {
  id        String   @id @default(cuid())
  target    CommentTarget
  targetId  String
  authorId  String
  body      String   @db.Text
  createdAt DateTime @default(now())

  author User @relation(fields: [authorId], references: [id])
}
```

### ExportPackage

PRD 16장.

```prisma
enum ExportUnit {
  Feature
  Slot
}

enum ExportKind {
  Draft
  Official
}

model ExportPackage {
  id           String   @id @default(cuid())
  projectId    String
  unit         ExportUnit
  kind         ExportKind
  targetId     String   // FeatureSpec.id 또는 SlotComponent.id 등
  manifestJson Json     // PRD 16.6
  // 파일 경로 - 로컬 디스크 uploads/exports/{id}.zip
  zipPath      String
  createdById  String
  createdAt    DateTime @default(now())

  createdBy User @relation(fields: [createdById], references: [id])
}
```

---

## 미정 (다음 Phase 진입 시 정한다)

- SpecVersion 본문을 DB text로 둘지 object storage로 뺄지 — 100개 이상 쌓이면 검토
- Revision 보관 기간 / 정리 정책
- SpecFigmaLink를 한 테이블로 둘지 Spec/Slot 별로 분리할지 — Phase 3 진입 시 재검토
- AITask의 worktree 정리 정책 (TTL)
- Comment의 thread, mention, resolved — v2

각 Phase 진입 시 이 섹션의 항목을 결정하고 `docs/decisions.md`에 기록한다.
