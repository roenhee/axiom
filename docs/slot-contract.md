# Slot Contract

Hub repo와 prototype repo가 공유하는 인터페이스. **이 문서를 양 레포에 동일한 내용으로 둔다.** 한 쪽 수정 시 다른 쪽도 같이 수정.

PRD 10~11장 기반.

---

## prototype repo 디렉토리 구조

```
prototype-repo/
├── README.md
├── package.json
├── next.config.js
├── app/
│   ├── layout.tsx
│   ├── page.tsx                       ← Surface 목록 (개발자용)
│   ├── preview/[branch]/[...path]/page.tsx   ← Preview 라우터
│   └── slot-renderer/
│       └── SlotRenderer.tsx           ← registry.json 읽어 Slot을 렌더하는 컴포넌트
├── surfaces/
│   └── {surface-id}/
│       └── index.tsx                  ← Surface 페이지 (필요시)
├── slots/
│   └── {slot-component}/
│       ├── _component/                ← Slot Component 공통 코드
│       │   └── index.tsx
│       └── {variation}/
│           ├── index.tsx              ← Slot Variation 실제 렌더 코드 ★ AI patch 대상
│           ├── mock-data.json         ★ AI patch 대상
│           └── scenarios.json         ★ AI patch 대상
├── mock-data/                         ← Variation 외부의 전역 mock data
├── scenarios/                         ← Variation 외부의 전역 scenario
├── components/
│   ├── common/                        ← 공통 UI 컴포넌트 (AI 수정 금지)
│   └── design-tokens/                 ← 디자인 토큰 (AI 수정 금지)
├── registry/
│   └── registry.json                  ← Hub DB에서 동기화. AI 수정 금지
└── scripts/
    └── validate-slot-scope.ts         ← AI patch 검증 스크립트
```

### AI editable paths (기본)

AI Task Plan의 `editable_paths` 기본값.

```
slots/{slot-component}/{variation}/**
```

특히 `index.tsx`, `mock-data.json`, `scenarios.json` 세 파일.

### AI forbidden paths (기본)

```
surfaces/**
components/common/**
components/design-tokens/**
slots/{*}/_component/**     ← Slot Component 공통 코드
registry/**                  ← Hub DB가 master
app/**                       ← Next.js 구조
scripts/**
package.json
next.config.js
```

이 분류는 PRD 10.10, 13.5 기준. Slot Component 공통 구조 수정은 Prototype Owner 권한 필요.

---

## registry.json 스키마

PRD 11.6 예시를 정식 스키마로.

```jsonc
{
  "version": 1,
  "generatedAt": "2026-05-14T00:00:00+09:00",
  "generatedFromHubCommit": "abc123",   // hub DB의 어느 시점인지 추적용
  "surfaces": [
    {
      "surfaceId": "surface.search_result",
      "label": "검색 결과",
      "route": "/search",
      "tabs": [
        {
          "tabId": "tab.search_result.all",
          "label": "전체",
          "regions": [
            {
              "regionId": "region.search_result.all.filter",
              "label": "필터 영역",
              "slots": [
                {
                  "slotInstanceId": "slot_instance.search_result.all.filter.price_filter",
                  "displayOrder": 20,
                  "slotComponentId": "slot_component.price_filter",
                  "slotVariationId": "slot_variation.price_filter.search_all_tab",
                  "pathPrefix": "slots/price-filter/search-all",
                  "specVersionId": "component.search.price_filter.v3",
                  "figmaFrameId": "figma.price_filter.default",
                  "syncStatus": "Not Checked"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### 필드 정의

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `version` | int | 필수 | 스키마 버전. 변경 시 증가 |
| `generatedAt` | ISO 8601 | 필수 | Hub가 생성한 시각 |
| `generatedFromHubCommit` | string | 선택 | 추적용 메타 |
| `surfaces[]` | array | 필수 | Surface 목록 |
| `surfaces[].surfaceId` | string | 필수 | `surface.{snake}` 형식 |
| `surfaces[].tabs[].regions[].slots[].slotInstanceId` | string | 필수 | `slot_instance.{path}` 형식 |
| `slots[].pathPrefix` | string | 필수 | prototype repo 내 경로 |
| `slots[].specVersionId` | string | 선택 | 연결된 Spec Version |
| `slots[].figmaFrameId` | string | 선택 | 연결된 Figma frame |
| `slots[].syncStatus` | enum | 선택 | PRD 14.2 |

---

## Slot Variation 컴포넌트 인터페이스

각 Slot Variation의 `index.tsx`가 export해야 하는 컴포넌트 시그니처.

```ts
// slots/{slot-component}/{variation}/index.tsx

import type { SlotProps } from '@/types/slot';

export default function PriceFilterSlotSearchAllTab(props: SlotProps) {
  // ...
  return <div>...</div>;
}

// 선택적 scenario별 mock data
export const scenarios = {
  default: { /* ... */ },
  validation_error: { /* ... */ },
  empty: { /* ... */ },
};
```

### SlotProps

```ts
export type SlotProps = {
  scenario?: string;        // "default", "validation_error" 등
  mockData?: unknown;       // mock-data.json에서 로드된 데이터
  // 필요시 추가
};
```

### mock-data.json 포맷

```jsonc
{
  "default": {
    "minPrice": 0,
    "maxPrice": 100000
  },
  "validation_error": {
    "minPrice": 100000,
    "maxPrice": 50000
  }
}
```

### scenarios.json 포맷

```jsonc
{
  "scenarios": [
    {
      "id": "default",
      "label": "기본 상태"
    },
    {
      "id": "validation_error",
      "label": "validation 실패",
      "description": "최소 가격이 최대 가격보다 큰 경우"
    },
    {
      "id": "empty",
      "label": "빈 상태"
    }
  ]
}
```

---

## SlotRenderer 동작

`app/slot-renderer/SlotRenderer.tsx`가 다음을 한다.

1. `registry.json` 읽기
2. URL path에서 `slotInstanceId` 또는 `surfaceId + tabId + regionId` 추출
3. 해당 `pathPrefix`의 Slot Variation을 동적 import (`dynamic(() => import('@/slots/...'))`)
4. `mock-data.json`과 `scenarios.json`을 같이 로드
5. URL의 `?scenario=...` 쿼리에 따라 해당 mock data를 props로 주입
6. Slot 컴포넌트 렌더

### Preview URL 패턴

```
http://localhost:3001/preview/{branch}/slots/{slot-component}/{variation}?scenario={scenarioId}
```

또는 Surface 단위:

```
http://localhost:3001/preview/{branch}/surface/{surfaceId}?tab={tabId}
```

Hub에서는 base URL(`PROTOTYPE_PREVIEW_BASE_URL`)과 slug 조합으로 런타임 생성.

---

## validate-slot-scope.ts

AI patch가 적용된 후 검증하는 스크립트.

### 입력

- AI Task Plan의 `editable_paths` (glob 배열)
- AI Task Plan의 `forbidden_paths` (glob 배열)
- 실제 변경된 파일 목록 (git diff)

### 동작

1. 변경된 파일이 모두 `editable_paths` 매칭에 포함되는가? — 그렇지 않으면 fail
2. 변경된 파일 중 `forbidden_paths`에 매칭되는 것이 있는가? — 있으면 fail
3. 신규 추가된 파일이 `editable_paths` 안에 있는가?

### 출력

```json
{
  "ok": true,
  "checkedFiles": ["slots/price-filter/search-all/index.tsx", "..."]
}
```

실패 시:

```json
{
  "ok": false,
  "violations": [
    {
      "file": "components/common/Button.tsx",
      "reason": "forbidden path"
    }
  ]
}
```

---

## Hub와 prototype repo 동기화 시점

| 시점 | 무엇이 일어나는가 |
|---|---|
| Hub에서 Surface/Tab/Region 변경 | DB 갱신 |
| Hub에서 SlotInstance 배치 변경 | DB 갱신 |
| 사용자가 "Sync to prototype" 또는 자동 트리거 | `/api/.../registry/sync` 호출 → registry.json 갱신 → commit |
| AI Task가 시작될 때 | worktree branch 생성 → 그 branch에 최신 registry.json 동기화 |
| AI patch 완료 | validation → commit → preview build |
| Publish | branch를 main에 merge |

---

## 미정

- Slot Variation의 storybook-like sandbox 페이지가 prototype repo에 별도로 필요한가? PRD 12.6 예시의 `/_sandbox/PriceFilter?variation=search_all_tab` URL 패턴
- Slot Component 공통 코드(`_component/`)의 인터페이스 — 추후 실제 Slot 한두 개 만들어보며 확정
- 대규모 mock data(이미지 등)의 저장 위치 — public/ 디렉토리 또는 별도 CDN

Phase 3 진입 시 실제 Slot 한두 개 만들면서 위 항목들 결정. `docs/decisions.md`에 기록.
