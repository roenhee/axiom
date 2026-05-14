# AI 기반 제품화 산출물 관리 도구 PRD v0.1

## 0. 문서 개요

### 0.1 문서 목적

본 문서는 기획자, 디자이너, 개발자가 AI를 중심으로 제품 개발에 필요한 산출물을 함께 작성, 확인, 관리, 아카이브할 수 있는 내부 도구의 제품 방향과 MVP 범위를 정리한 PRD이다.

이 문서는 다음 목적을 가진다.

1. 지금까지 논의하고 확정한 제품 방향과 의사결정을 하나의 기준 문서로 정리한다.
2. 제품의 핵심 개념, 정보 구조, 권한, 워크플로우, MVP 범위를 명확히 정의한다.
3. 이후 화면 설계, 데이터 모델링, prototype repo 구조 설계, AI workflow 설계, 개발 백로그 작성의 기준 문서로 사용한다.

### 0.2 문서 상태

- 문서 버전: v0.1
- 문서 성격: 제품 PRD + 의사결정 기록
- 현재 상태: 제품 방향 및 MVP 범위 1차 확정
- 이후 필요 작업:
  - MVP 화면 IA 정의
  - 핵심 데이터 모델 정의
  - prototype repo 상세 구조 정의
  - AI Task Plan 및 patch workflow 상세 설계
  - 개발 백로그 작성

### 0.3 제품 가칭

본 문서에서는 제품명을 임시로 다음과 같이 지칭한다.

> Spec-Design-Prototype Hub

실제 제품명은 추후 별도로 결정한다.

---

## 1. 제품 컨셉

### 1.1 한 줄 정의

이 제품은 MD 기반 기획서, Figma 디자인, Slot 기반 working mock, 개발자용 export를 하나의 버전 체계로 연결하여 제품 개발 산출물을 확인, 작성, 관리, 아카이브할 수 있게 하는 내부 제품화 도구다.

### 1.2 제품 설명

제품 개발 과정에서 기획서, 디자인, 목업, 개발 지시문, AI 작업 컨텍스트는 서로 밀접하게 연결되어 있지만 실제 업무에서는 여러 도구에 흩어져 관리되는 경우가 많다.

본 제품은 이 산출물들을 하나의 프로젝트 구조 안에서 연결한다.

- 기획자는 Markdown 기반 기획서를 작성하고 버전 단위로 관리한다.
- 디자이너는 기획서 및 상태/시나리오 단위로 Figma frame을 연결한다.
- 기획자 또는 담당자는 AI를 활용해 Slot 기반 working mock을 생성하거나 수정한다.
- 내부 도구는 기획서, Figma, working mock을 함께 보여준다.
- 담당자는 결과물을 Publish하고 필요 시 Rollback할 수 있다.
- 개발자는 Feature 또는 Slot 단위 export package를 다운로드하여 Claude Code, Codex 등 개인 개발 환경에서 활용할 수 있다.

### 1.3 핵심 사용자

| 사용자 | 주요 목적 |
|---|---|
| 기획자 | 기획서를 작성하고, 디자인/목업과 함께 요구사항을 관리한다. |
| 디자이너 | Figma frame을 기획서 및 Slot과 연결하고, 디자인 기준을 아카이브한다. |
| 개발자 | 기획서, 디자인, 목업, AI 지시문이 포함된 개발 context를 다운로드해 구현에 활용한다. |
| Prototype 관리자 | prototype repo, Slot 구조, 공통 컴포넌트, 디자인 토큰 등 구조적 안정성을 관리한다. |
| 프로젝트 관리자 | 프로젝트 설정, 멤버, 권한, 전체 복구와 운영을 관리한다. |

### 1.4 제품이 제공하는 가치

1. **산출물 정렬**  
   기획서, 디자인, 목업, 개발자용 context를 하나의 기준으로 연결한다.

2. **버전 추적성**  
   특정 목업이나 export가 어떤 Spec Version, Figma frame, Prototype Commit 기준인지 추적할 수 있다.

3. **AI 목업 안정성**  
   AI가 전체 prototype을 임의로 수정하지 않고, Slot Variation 단위로 격리된 변경을 생성하도록 한다.

4. **협업 비용 감소**  
   기획자, 디자이너, 개발자가 동일한 화면에서 기획서, 디자인, working mock을 함께 확인할 수 있다.

5. **개발 전달 효율화**  
   개발자가 필요한 기획서, 디자인 링크, mock data, scenario, AI 지시문을 하나의 export package로 받을 수 있다.

---

## 2. 배경과 문제 정의

### 2.1 현재 문제

제품 개발 과정에서 다음 문제가 반복적으로 발생한다.

#### 2.1.1 산출물이 흩어져 있음

기획서는 문서 도구에 있고, 디자인은 Figma에 있으며, 목업은 별도 파일이나 임시 코드에 있고, 개발 지시문은 Slack, ticket, 개인 메모, AI 프롬프트 등에 흩어져 있다.

이로 인해 특정 기능을 구현하거나 검토할 때 필요한 context를 한 번에 파악하기 어렵다.

#### 2.1.2 최신 기준을 알기 어려움

다음과 같은 질문에 명확히 답하기 어렵다.

- 이 목업은 어떤 기획서 버전 기준인가?
- Figma는 최신 기획서 기준으로 반영되어 있는가?
- 현재 보고 있는 mock이 최신 디자인과 맞는가?
- 개발자가 받은 문서는 어느 시점의 기준인가?

#### 2.1.3 AI 목업 생성 시 영향 범위가 불안정함

AI를 활용해 working mock이나 wireframe을 만들면 생산성은 높아질 수 있다. 그러나 전체 prototype repo를 AI가 자유롭게 수정하게 두면 다음 문제가 생긴다.

- 특정 컴포넌트를 수정하다가 다른 탭이나 화면까지 변경할 수 있다.
- 여러 사용자가 동시에 다른 영역을 수정할 때 충돌이 생길 수 있다.
- 기획자가 AI로 목업을 만들었는데 공통 컴포넌트나 전체 layout이 깨질 수 있다.
- 어떤 변경이 어떤 기획서에 의해 발생했는지 추적하기 어렵다.

#### 2.1.4 개발 전달 context가 부족함

개발자는 단순 기획서 링크만으로 구현을 시작하기 어렵다. 구현을 위해서는 다음이 함께 필요하다.

- 요구사항의 기준 문서
- 관련 Figma frame
- 동작 예시가 있는 working mock
- 상태/시나리오별 mock data
- AI coding assistant용 지시문
- 구현 범위와 수정 금지 범위

현재는 이 context를 수동으로 모아 전달해야 한다.

### 2.2 제품이 해결하려는 문제

본 제품은 다음 문제를 해결한다.

1. 기획서, 디자인, 목업, 개발자용 context를 연결해 하나의 아카이브로 관리한다.
2. 각 산출물이 어떤 버전 기준인지 명확히 추적한다.
3. AI 목업 작업을 Slot 단위로 격리해 안전하게 관리한다.
4. 담당자가 빠르게 Publish하고 문제가 있으면 Rollback할 수 있게 한다.
5. 개발자가 필요한 context를 Feature 또는 Slot 단위로 export할 수 있게 한다.

---

## 3. 제품 원칙

본 제품은 다음 원칙을 따른다.

### 3.1 MD 기획서는 요구사항의 Source of Truth다

Markdown 기반 기획서는 요구사항의 기준 문서다. 제품의 정책, 동작, 상태, 예외 조건은 기획서 Version 기준으로 관리한다.

### 3.2 Figma는 UI/비주얼 디자인 기준이다

Figma는 시각적 디자인 기준으로 사용된다. 단순 참고 링크가 아니라, Feature, Component, Tab, State, Scenario 단위로 기획서 및 목업과 연결되는 디자인 아카이브로 관리한다.

### 3.3 Prototype은 실제 제품 코드가 아니라 동작 검증용 working wireframe이다

Prototype repo는 실제 제품 구현체가 아니다. 기획서와 Figma를 바탕으로 주요 사용자 흐름과 인터랙션을 검증하기 위한 별도 working wireframe app이다.

### 3.4 AI는 공식 수정자가 아니라 격리된 proposal 생성자다

AI가 생성하거나 수정한 목업은 곧바로 공식 결과물이 되지 않는다. AI 결과물은 격리된 branch 또는 worktree에서 생성되는 patch proposal이며, Preview 확인 후 담당자가 Publish해야 공식 prototype에 반영된다.

### 3.5 목업 작업은 Slot 단위로 격리한다

대부분의 과제는 하나의 Slot, 즉 하나의 컴포넌트 또는 화면 내 영역에 영향을 준다. 따라서 prototype 구조는 Slot 기반으로 관리하고, AI 목업 작업의 기본 단위는 Slot Variation으로 제한한다.

### 3.6 리뷰 승인보다 담당자 Publish와 Rollback을 중심으로 운영한다

이 제품은 승인으로 막는 도구가 아니라, 변경을 안전하게 격리하고 추적 가능하게 만드는 도구다. Spec, Figma, Slot Variation 수준의 산출물은 담당자가 직접 Publish할 수 있다. 문제가 생기면 Slot 또는 Commit 단위로 Rollback한다.

### 3.7 Sync 여부는 자동 판단하지 않고 사람이 수동으로 확인한다

Spec, Figma, Prototype이 서로 같은 기준인지 여부는 시스템이 자동으로 최종 판정하지 않는다. 시스템은 판단에 필요한 Version, Frame, Commit, 연결 정보를 제공하고, 담당자가 Compare View와 문서를 확인한 뒤 Sync Status를 수동 지정한다.

### 3.8 모든 산출물은 기준 버전과 연결 정보를 남긴다

Published Spec, Figma 연결, Slot Variation, Prototype Preview, Developer Export는 모두 기준이 되는 Spec Version, Figma Frame, Prototype Commit 정보를 기록해야 한다.

---

## 4. 핵심 사용자와 권한

### 4.1 권한 모델 개요

본 제품의 권한은 직무별로 세분화하지 않고, 변경 영향 범위 기준으로 단순하게 관리한다.

권한은 다음 4단계 위계형 구조를 따른다.

```text
Project Owner
  > Prototype Owner
    > Task Owner
      > Viewer
```

상위 권한은 하위 권한을 모두 포함한다.

### 4.2 Viewer

Viewer는 읽기 전용 사용자다.

Viewer가 할 수 있는 일:

- Spec 보기
- Figma 연결 보기
- Working Mock Preview 보기
- Compare View 보기
- Sync Status 보기
- Version History 보기
- Published Export 다운로드

MVP에서는 Viewer는 기본적으로 쓰기 권한을 가지지 않는다. 댓글 작성 권한은 후속 논의에서 별도 결정한다.

### 4.3 Task Owner

Task Owner는 기획자, 디자이너, 일반 기여자, Slot 담당자를 포괄하는 실무 담당자 권한이다.

Task Owner는 Viewer 권한을 포함한다.

Task Owner가 할 수 있는 일:

- Spec Draft 작성/수정
- Spec Version Publish
- Figma frame 연결/수정
- Figma required level 설정
- Figma Coverage 관리
- Slot Variation 생성/수정
- Slot Variation Publish
- Slot Instance 삽입/수정 요청 또는 등록
- AI 목업 생성/수정 요청
- AI Task Plan 확인/수정/실행
- Preview 확인
- Sync Status 수동 업데이트
- 댓글 작성
- Sync 확인 요청
- Feature Export 생성
- Slot Export 생성
- Draft Export 생성
- Official Export 생성
- Slot Variation 단위 Rollback

### 4.4 Prototype Owner

Prototype Owner는 prototype repo와 Slot 구조의 안정성을 관리하는 역할이다.

Prototype Owner는 Task Owner 및 Viewer 권한을 포함한다.

Prototype Owner가 할 수 있는 일:

- Task Owner의 모든 작업
- Surface 생성/수정/삭제
- Tab 구조 변경
- Region 구조 변경
- Slot Registry 구조 변경
- Slot Component 공통 구조 수정
- Slot Renderer 수정
- 공통 컴포넌트 수정
- 디자인 토큰 수정
- Prototype shell 수정
- Preview build 실패 대응
- 구조적 Rollback
- 여러 Slot에 영향을 주는 변경 Publish

Prototype Owner는 모든 산출물을 승인하는 사람이 아니라, Slot 격리 범위를 벗어나는 구조적 변경을 관리하는 사람이다.

### 4.5 Project Owner

Project Owner는 프로젝트 전체 관리자다.

Project Owner는 Prototype Owner, Task Owner, Viewer 권한을 모두 포함한다.

Project Owner가 할 수 있는 일:

- Prototype Owner의 모든 작업
- 프로젝트 생성/삭제
- 프로젝트 설정 변경
- 멤버 초대/제거
- 권한 부여/변경
- Project Owner 지정
- Prototype Owner 지정
- 전체 prototype rollback
- 프로젝트 아카이브
- 위험 변경 복구

### 4.6 담당자 metadata

Spec Owner, Design Owner, Slot Owner와 같은 세부 담당자는 별도 권한이 아니라 metadata로 관리한다.

예시:

```yaml
spec_id: feature.search.price_filter
task_owner: roen
design_contact: designer_a
prototype_contact: frontend_b
slot_owner: roen
```

이 metadata는 다음 용도로 활용한다.

- 댓글 대상 지정
- Sync 확인 요청 대상 지정
- 알림 대상 지정
- 담당자 필터링
- 업무 이력 추적

---

## 5. Source of Truth 정의

본 제품은 각 산출물의 역할을 다음과 같이 정의한다.

| 산출물 | 역할 |
|---|---|
| MD 기획서 | 요구사항의 Source of Truth |
| Figma | UI/비주얼 디자인 기준 |
| Prototype | 동작 검증용 산출물 |
| AI Patch | 승인 전 제안 또는 목업 생성 proposal |
| Developer Export | 구현 전달 패키지 |

### 5.1 MD 기획서

MD 기획서는 요구사항의 기준 문서다. 기획 의도, 정책, 사용자 흐름, 상태, 예외, 인터랙션 조건은 Spec Version으로 관리된다.

### 5.2 Figma

Figma는 UI 및 비주얼 디자인 기준이다. Feature, Component, Tab, State, Scenario 단위로 연결될 수 있다.

### 5.3 Prototype

Prototype은 실제 제품 구현이 아니라 기획과 디자인을 동작 가능한 형태로 검증하기 위한 working wireframe이다.

### 5.4 AI Patch

AI가 생성하거나 수정한 목업은 공식 결과물이 아니다. AI Patch는 Preview 상태로 생성되며, 담당자가 Publish해야 공식 prototype에 반영된다.

### 5.5 Developer Export

Developer Export는 구현 전달 패키지다. 개발자가 구현에 필요한 Spec, Figma, Prototype, mock data, scenario, AI 지시문을 포함한다.

---

## 6. 정보 구조와 문서 계층

### 6.1 전체 정보 구조

본 제품의 문서 계층은 다음 구조를 따른다.

```text
Project
  └─ 자유 Folder
      └─ Feature Group / Epic
          └─ Feature Spec
              ├─ Component Spec
              ├─ Tab Spec
              └─ State Spec
```

### 6.2 자유 Folder와 구조화 관계의 분리

폴더 구조는 사람이 문서를 탐색하고 정리하기 위한 UI 계층이다. 사용자는 프로젝트 내에서 자유롭게 폴더를 생성, 수정, 이동할 수 있다.

반면 시스템과 AI가 사용하는 기준은 문서 타입과 관계 정보다.

즉:

```text
폴더 = 사람을 위한 탐색 구조
문서 타입과 관계 = 시스템과 AI를 위한 구조화 데이터
```

### 6.3 문서 타입

#### 6.3.1 Feature Group / Epic

여러 Feature Spec을 묶는 상위 단위다.

포함할 수 있는 내용:

- 문제 정의
- 목표
- 전체 사용자 흐름
- 공통 정책
- 릴리즈 범위
- 포함된 Feature Spec 목록
- 관련 Figma 목록
- 관련 prototype surface/route

Feature Group / Epic 단위 변경은 직접 목업 수정으로 이어지지 않는다. 먼저 하위 Feature 또는 Slot 단위 작업으로 분해한다.

#### 6.3.2 Feature Spec

실제 기능 단위 기획서다.

포함할 수 있는 내용:

- 기능 목적
- 사용자 시나리오
- 주요 정책
- 포함되는 Component / Tab / State Spec
- 관련 Slot Component / Variation
- 관련 Figma frame
- 관련 Prototype Preview

#### 6.3.3 Component Spec

특정 UI 컴포넌트의 동작과 상태를 정의한다.

포함할 수 있는 내용:

- 컴포넌트 목적
- 입력/출력
- 상태값
- 인터랙션
- validation
- error/empty/loading 상태
- 관련 Figma frame
- 관련 Slot Component / Variation

#### 6.3.4 Tab Spec

탭 또는 화면 내 주요 구간의 구성과 동작을 정의한다.

포함할 수 있는 내용:

- 탭의 목적
- 탭 내 Slot 구성
- 노출 조건
- 탭 전환 동작
- 관련 Figma frame
- 관련 Surface / Region

#### 6.3.5 State Spec

특정 상태를 정의한다.

예:

- loading
- empty
- error
- validation 실패
- 권한 없음
- 네트워크 실패

Level 3 Scenario-based prototype을 만들 때 중요한 문서 타입이다.

### 6.4 관계 정보

각 문서는 다음 관계 정보를 가질 수 있다.

| 관계 | 의미 |
|---|---|
| parent | 상위 문서 |
| contains | 포함하는 하위 문서 |
| depends_on | 의존하거나 영향을 받는 문서 |
| related_figma | 연결된 Figma frame |
| related_prototype_route | 연결된 prototype route |
| related_component | 연결된 component |
| related_slot | 연결된 Slot Component / Variation / Instance |
| related_ai_task | 연결된 AI Task |

contains와 depends_on은 구분해야 한다.

- contains: 문서 계층상 포함 관계
- depends_on: 기능이나 동작상 의존 관계

---

## 7. Revision / Version 정책

### 7.1 기본 원칙

본 제품은 기획서 편집 이력과 공식 버전을 구분하여 관리한다.

| 개념 | 의미 |
|---|---|
| Revision | 자동 저장되는 편집 이력 |
| Version | 공식 협업 기준이 되는 스냅샷 |

### 7.2 Revision

Revision은 사용자의 모든 편집 내용을 자동 저장한 이력이다.

용도:

- 복구
- 변경 추적
- 편집 히스토리 확인

Revision은 AI mock update나 Developer Export의 기준이 되지 않는다.

### 7.3 Version

Version은 사용자가 명시적으로 생성하는 공식 기준 스냅샷이다.

Version은 다음 기능의 기준이 된다.

- 협업
- Figma 연결
- AI 목업 생성/수정
- Prototype Preview
- Sync Status 확인
- Developer Export

### 7.4 Version 생성 조건

사용자는 Draft 편집 후 명시적으로 Version을 생성한다.

Version 생성 시 포함될 수 있는 정보:

- Markdown snapshot
- 변경 요약
- 변경 유형
- 생성자
- 생성 시각
- 관련 Figma
- 관련 Slot
- 관련 Prototype Preview

### 7.5 상태

MVP에서는 단순한 상태를 사용한다.

```text
Draft
Published
Archived
```

- Draft: 편집 중
- Published: 공식 기준으로 발행됨
- Archived: 더 이상 사용하지 않는 과거 버전

### 7.6 AI 및 Export 기준

AI 목업 업데이트와 Developer Export는 Draft나 Revision이 아니라 Published Version 기준으로만 실행한다.

---

## 8. Figma 연결 정책

### 8.1 기본 방향

본 제품은 모든 디자인 산출물을 기획서 및 prototype과 함께 확인할 수 있는 아카이브를 목표로 한다.

따라서 Figma frame은 다음 단위까지 연결할 수 있다.

- Feature Group / Epic
- Feature Spec
- Component Spec
- Tab Spec
- State Spec
- Scenario
- Slot Component
- Slot Variation
- Slot Instance

### 8.2 Figma 연결 필요 수준

모든 Spec에 Figma 연결을 일괄 강제하지 않는다.

각 Spec 또는 화면의 중요도에 따라 Figma 연결 필요 수준을 설정한다.

```text
required
recommended
optional
not_needed
```

#### required

핵심 화면이나 핵심 기능처럼 디자인 기준이 반드시 필요한 경우.

#### recommended

디자인 연결이 있으면 좋지만, Publish를 막지는 않는 경우.

#### optional

참고용 연결이 가능한 경우.

#### not_needed

디자인 의미가 거의 없거나 문서 성격상 Figma가 필요 없는 경우.

### 8.3 Figma Coverage

내부 도구는 Feature, Spec, Slot, Scenario 단위의 Figma Coverage를 보여준다.

예:

```text
가격 필터 Feature Spec
Figma Coverage: 4 / 5 connected

✓ 기본 상태
✓ 선택 상태
✓ validation error
✓ 모바일 상태
𐄂 empty state
```

### 8.4 Compare View

내부 도구는 Figma frame과 Working Mock Preview를 나란히 비교할 수 있는 Compare View를 제공한다.

MVP에서는 단순한 좌우 iframe 비교로 시작한다.

```text
좌측: Figma iframe
우측: Prototype Preview iframe
```

후속 고도화에서는 screenshot diff, viewport별 비교, Figma metadata 자동 수집 등을 검토한다.

### 8.5 AI 작업에서의 Figma 사용

AI mock update 시 전체 Figma 파일을 context로 제공하지 않는다.

AI에게는 해당 Spec, Slot, Scenario와 연결된 Figma frame만 우선 context로 제공한다.

---

## 9. Prototype Repo 역할과 범위

### 9.1 기본 정의

Prototype repo는 실제 제품 코드와 분리된 working wireframe app이다.

Prototype의 목적은 실제 구현이 아니라, 기획서와 Figma에 정의된 요구사항을 동작 가능한 형태로 검증하는 것이다.

### 9.2 포함 범위

Prototype은 mock data 기반으로 다음을 표현한다.

- 주요 화면 흐름
- 컴포넌트 인터랙션
- 입력값 처리
- validation
- 상태 변화
- empty / loading / error 상태
- Slot별 scenario

### 9.3 제외 범위

Prototype은 다음을 하지 않는다.

- 실제 API 연동
- 실제 로그인/결제/권한 처리
- 실제 운영 DB 연결
- 실제 추천/검색/랭킹 알고리즘 구현
- 운영 수준의 복잡한 비즈니스 로직
- 실제 제품 코드와 직접 import 또는 결합

### 9.4 Prototype Quality Level

Prototype 품질 수준은 다음 3단계로 정의한다.

#### Level 1. Static

- 화면 구조와 기본 UI만 표현
- 클릭, 입력, 상태 변화 없음

#### Level 2. Interactive

- 주요 클릭, 탭 전환, 입력, 선택, 모달, 토스트, 간단한 상태 변화 지원
- 기획자, 디자이너, 개발자가 주요 동작을 확인할 수 있는 수준

#### Level 3. Scenario-based

- 정상 상태, empty state, loading state, error state, 권한 없음, validation 실패 등 주요 시나리오 확인 가능
- 핵심 기능 또는 복잡한 사용자 흐름에 적용

### 9.5 목표 수준

MVP 기준 기본 목업 품질 목표는 Level 2 Interactive다.

핵심 기능이나 검증 중요도가 높은 기능은 Level 3 Scenario-based까지 지원한다.

---

## 10. Slot 기반 Prototype 모델

### 10.1 기본 개념

본 제품의 prototype은 Slot 기반 구조로 관리한다.

서비스는 여러 화면에서 재사용 가능한 컴포넌트 목업 단위를 가지며, 화면마다 variation이 생기는 구조다.

### 10.2 구조

```text
Surface
  └─ Tab / Section
      └─ Region
          └─ Slot Instance
              └─ Slot Variation
                  └─ Slot Component
```

### 10.3 Surface

Surface는 사용자가 보는 큰 화면 또는 route다.

예:

- 검색 결과 화면
- 홈 화면
- 상품 상세 화면
- 온보딩 화면

예시 ID:

```text
surface.search_result
surface.home
surface.product_detail
```

### 10.4 Tab / Section

Tab 또는 Section은 Surface 내부의 주요 구간이다.

예:

- 검색 결과 > 전체 탭
- 검색 결과 > 이미지 탭
- 홈 > 추천 영역
- 상품 상세 > 구매 옵션 영역

### 10.5 Region

Region은 Slot들이 삽입되는 화면 내 영역이다.

예:

- 필터 영역
- 결과 리스트 영역
- 추천 카드 영역
- 하단 CTA 영역

### 10.6 Slot Component

Slot Component는 여러 화면에서 재사용 가능한 목업 컴포넌트다.

예:

- PriceFilterSlot
- BrandFilterSlot
- RecommendCardSlot
- ProductListSlot
- EmptyResultSlot

Slot Component는 대표 Feature Spec 또는 Component Spec 하나를 가진다.

역할:

- 공통 UI 구조
- 공통 interaction
- 공통 props contract
- 공통 scenario 정의
- 여러 화면에서 재사용되는 기본 목업 단위

### 10.7 Slot Variation

Slot Variation은 특정 화면, 탭, 상태, 시나리오에 맞춘 변형이다.

예:

```text
PriceFilterSlot.search_all_tab
PriceFilterSlot.search_shopping_tab
PriceFilterSlot.mobile_bottom_sheet
```

Slot Variation은 다음을 관리한다.

- 화면별 copy
- 화면별 layout option
- 화면별 mock data
- 화면별 Figma frame
- 화면별 scenario
- 화면별 노출 조건

AI가 화면별 목업을 수정할 때 기본 작업 단위는 Slot Variation이다.

### 10.8 Slot Instance

Slot Instance는 특정 Surface / Tab / Region / Position에 삽입된 실제 슬롯 위치다.

사용자에게는 다음과 같이 표시된다.

```text
검색 결과 > 전체 탭 > 필터 영역 > 2번째 슬롯
```

시스템 내부에서는 안정적인 ID와 display_order로 관리한다.

예:

```yaml
slot_instance_id: slot_instance.search_result.all.filter.price_filter
slot_component_id: slot_component.price_filter
slot_variation_id: slot_variation.price_filter.search_all_tab
surface_id: surface.search_result
tab_id: tab.search_result.all
region_id: region.search_result.all.filter
display_order: 20
```

### 10.9 위치 토큰 정책

단순히 “몇 번째 슬롯”만으로 관리하지 않는다. 순서가 바뀌면 의미가 흔들릴 수 있기 때문이다.

따라서 다음 원칙을 따른다.

```text
slot_instance_id = 안정적인 의미 기반 ID
display_order = 화면 내 표시 순서
```

사용자 UI에서는 사람이 이해하기 쉬운 위치를 보여주고, 시스템 내부에서는 ID와 order를 분리한다.

### 10.10 AI 수정 원칙

AI가 수정 가능한 기본 범위:

- 대상 Slot Variation 파일
- 해당 Variation mock data
- 해당 Variation scenario

AI가 기본적으로 수정할 수 없는 범위:

- Surface layout
- Tab / Region 구조
- 다른 Slot Variation
- Slot Component 공통 구조
- 공통 컴포넌트
- 디자인 토큰

Slot Component 자체를 수정하는 경우 여러 Instance에 영향이 갈 수 있으므로 Prototype Owner 권한 또는 강화된 확인이 필요하다.

---

## 11. Slot Registry 정책

### 11.1 기본 정의

Slot Registry는 어떤 화면에 어떤 탭과 영역이 있고, 각 영역에 어떤 Slot Instance가 어떤 순서로 들어가며, 각 Slot이 어떤 Spec, Figma, Prototype 파일과 연결되는지를 관리하는 지도다.

### 11.2 이중 구조

Slot Registry는 내부 도구 DB와 prototype repo registry file의 이중 구조로 관리한다.

```text
내부 도구 DB = 운영용 원본 메타데이터
prototype repo registry file = preview build와 commit versioning용
```

### 11.3 내부 도구 DB의 역할

내부 도구 DB는 다음을 관리한다.

- Surface / Tab / Region / Slot 관계
- Slot Component / Variation / Instance 관계
- Spec / Figma / Prototype 연결
- Sync Status
- Publish 상태
- 권한
- 댓글
- 확인 요청
- Export 이력

### 11.4 prototype repo registry file의 역할

prototype repo registry file은 다음을 위해 사용된다.

- Preview build
- commit 기반 versioning
- branch별 prototype 렌더링
- SlotRenderer가 화면을 구성하기 위한 실행 데이터

### 11.5 동기화 흐름

```text
내부 도구에서 Slot 구조 수정
→ DB 업데이트
→ AI 작업 또는 preview build 시점에 prototype branch로 registry file 동기화
→ preview build
→ preview URL 내부 도구에 저장
```

### 11.6 Registry 예시

```yaml
surface_id: surface.search_result
route: /search
tabs:
  - tab_id: tab.search_result.all
    label: 전체
    regions:
      - region_id: region.search_result.all.filter
        label: 필터 영역
        slots:
          - slot_instance_id: slot_instance.search_result.all.filter.price_filter
            display_order: 20
            slot_component_id: slot_component.price_filter
            slot_variation_id: slot_variation.price_filter.search_all_tab
            spec_version_id: component.search.price_filter.v3
            figma_frame_id: figma.price_filter.default
            sync_status: Not Checked
```

---

## 12. AI 목업 생성 / 수정 플로우

### 12.1 기본 원칙

AI 목업 생성/수정은 사용자가 명시적으로 요청했을 때만 실행한다.

AI는 자동으로 prototype을 수정하지 않는다.

AI 작업은 항상 Published Spec Version 기준으로 실행한다.

AI 결과물은 곧바로 공식 prototype에 반영되지 않는다. Preview 상태로 생성되며, Task Owner가 확인 후 Publish한다.

### 12.2 AI 작업의 기본 단위

AI 목업 작업의 기본 단위는 Slot Variation이다.

MVP에서 지원하는 AI 작업 유형:

1. Create Slot Variation
2. Update Slot Variation
3. Add Slot Scenario
4. Insert Slot Instance

후속 고도화에서 고려할 작업:

- Multi-slot task decomposition
- Surface/Layout 변경 task
- 공통 Slot Component refactor task
- 리뷰 댓글 기반 자동 수정

### 12.3 MVP AI workflow

```text
Spec Version 선택
→ Figma frame / Scenario 선택
→ Slot Component / Variation / Instance 선택
→ 사용자가 AI 목업 요청 입력
→ AI Task Plan 생성
→ Task Owner가 Plan 확인 / 수정
→ AI Patch 생성
→ Preview Ready
→ 담당자 Publish
→ Official Prototype 반영
```

### 12.4 AI Task Plan

AI Task Plan은 실제 prototype repo 수정 전에 생성되는 작업 설계서다.

목적:

- AI가 무엇을 하려는지 사용자가 확인한다.
- 잘못된 Slot, Figma, Spec을 기준으로 작업하는 것을 방지한다.
- 수정 가능 범위와 수정 금지 범위를 명확히 한다.
- 생성될 Preview route와 검증 기준을 확인한다.

### 12.5 AI Task Plan 포함 항목

MVP의 AI Task Plan은 다음 항목을 포함한다.

#### 1. 작업 유형

- Create Slot Variation
- Update Slot Variation
- Add Slot Scenario
- Insert Slot Instance

#### 2. 기준 정보

- Spec Version
- Figma frame
- Prototype branch
- Slot Component
- Slot Variation
- Slot Instance

#### 3. 작업 요약

- 사용자가 요청한 변경사항
- AI가 이해한 수정 목표

#### 4. 수정 가능 범위

- editable paths
- target slot files
- target mock data
- target scenario files

#### 5. 수정 금지 범위

- Surface layout
- Tab / Region 구조
- 다른 Slot Variation
- 공통 컴포넌트
- 디자인 토큰

#### 6. Preview 대상

- context preview route
- sandbox preview route
- scenario route

#### 7. 검증 기준

- Slot scope check
- changed file scope check
- build check
- preview generation check

### 12.6 AI Task Plan 예시

```text
AI Task Plan

작업 유형
Update Slot Variation

기준 Spec
가격 필터 Component Spec v4

참고 Figma
가격 필터 기본 상태
가격 입력 오류 상태

대상 Slot
Slot Component: PriceFilterSlot
Slot Variation: price_filter.search_all_tab
Slot Instance: 검색 결과 > 전체 탭 > 필터 영역 > 2번째 슬롯

AI가 이해한 작업
- 가격 직접 입력 validation을 추가한다.
- 최소 가격이 최대 가격보다 크면 error state를 표시한다.
- validation 실패 시 적용 버튼을 비활성화한다.
- validation_error scenario를 추가한다.

수정 가능 파일
- slots/price-filter/search-all/**
- mock-data/price-filter/search-all/**
- scenarios/price-filter/search-all/**

수정 금지 파일
- surfaces/**
- tabs/**
- regions/**
- components/common/**
- design-tokens/**

생성할 Preview
- /search?tab=all&slot=price_filter
- /_sandbox/PriceFilter?variation=search_all_tab
- /_sandbox/PriceFilter?scenario=validation_error

검증
- Slot scope check
- Build check
- Preview generation check
```

### 12.7 AI Patch 생성

Task Owner가 AI Task Plan을 확인하거나 수정한 뒤 실행하면, 시스템은 prototype repo에 격리된 branch 또는 worktree를 생성한다.

AI는 해당 branch/worktree에서 patch를 생성한다.

AI Patch는 다음 정보를 포함한다.

- 변경 파일 목록
- 변경 요약
- 생성된 Preview URL
- 검증 결과
- 기준 Spec Version
- 기준 Figma Frame
- 대상 Slot Variation

### 12.8 Preview와 Publish

AI Patch 생성 후 내부 도구는 Preview를 제공한다.

Task Owner는 Figma와 Working Mock을 Compare View에서 확인한 뒤 Publish할 수 있다.

Publish 전 필수 확인 정보:

- 변경된 Slot
- 변경된 Variation
- 수정된 파일
- 연결된 Spec Version
- 연결된 Figma frame
- Preview URL
- Rollback 대상 commit

---

## 13. Publish / Rollback 정책

### 13.1 기본 철학

본 제품은 기본적으로 리뷰 승인 기반이 아니라 담당자 Publish 기반으로 운영한다.

승인으로 막는 제품이 아니라, 변경을 안전하게 격리하고 추적 가능하게 만드는 제품이다.

### 13.2 Spec Publish

Task Owner는 Spec Draft를 작성하고 Version으로 Publish할 수 있다.

Spec Publish는 별도 타인 승인을 필요로 하지 않는다.

### 13.3 Figma Publish

Task Owner는 Figma frame을 연결하고 Publish할 수 있다.

Figma required level이 required인데 frame이 연결되지 않은 경우, 시스템은 경고를 표시할 수 있지만 MVP에서는 Publish를 막지 않는다.

### 13.4 Slot Variation Publish

AI가 생성하거나 수정한 목업이 Slot Variation 단위라면 Task Owner가 Preview 확인 후 Publish할 수 있다.

Slot Variation Publish는 기본적으로 타인 리뷰를 필수로 하지 않는다.

### 13.5 강화된 권한이 필요한 변경

다음 변경은 Slot 격리 범위를 벗어나므로 Prototype Owner 권한 또는 별도 확인이 필요하다.

- Slot Component 공통 구조 수정
- Surface layout 수정
- Tab 구조 수정
- Region 구조 수정
- Slot Renderer 수정
- 공통 컴포넌트 수정
- 디자인 토큰 수정
- Prototype shell 수정

### 13.6 Published History

모든 Publish는 다음 정보를 기록한다.

- Published by
- Published at
- 대상 산출물
- 연결된 Spec Version
- 연결된 Figma frame
- 연결된 Slot
- Prototype branch
- Prototype commit
- 변경 요약

### 13.7 Rollback

모든 Published 산출물은 history와 rollback을 지원한다.

MVP에서 지원할 Rollback:

- Slot Variation 단위 rollback
- Prototype commit 단위 rollback

후속 고도화:

- 특정 registry entry rollback
- Slot code와 registry rollback 분리
- rollback preview

---

## 14. Sync Status 정책

### 14.1 기본 원칙

Sync Status는 자동 판정이 아니라, 담당자의 수동 확인을 기반으로 관리한다.

시스템은 자동으로 “맞다/틀리다”를 판단하지 않는다.

대신 판단에 필요한 다음 정보를 제공한다.

- Spec Version
- Figma Frame
- Prototype Commit
- Slot 관계
- 마지막 확인자
- 마지막 확인일
- 관련 댓글
- 최근 변경 정보

### 14.2 Sync Status 상태값

MVP에서 사용하는 상태값은 다음과 같다.

| 상태 | 의미 |
|---|---|
| Not Checked | 아직 사람이 확인하지 않음 |
| Checking Requested | 담당자에게 싱크 확인 요청됨 |
| Synced | 사람이 확인했고 기획서-디자인-목업이 맞음 |
| Needs Update | 목업 또는 디자인 업데이트가 필요함 |
| Mismatch Found | 기획서/디자인/목업 간 불일치가 발견됨 |
| No Impact | 변경은 있었지만 목업 반영 영향 없음으로 확인 |

### 14.3 Sync 확인 단위

Sync Status는 다음 단위에서 관리한다.

1. Slot Variation
2. Slot Instance
3. Surface / Mock View
4. Spec Version

### 14.4 Sync 확인 요청

사용자는 특정 Spec, Slot, Surface 단위로 Sync 확인 요청을 보낼 수 있다.

MVP에서는 알림 연동 없이 다음을 지원한다.

- Checking Requested 상태 지정
- 담당자 선택
- 요청 메모 작성
- 댓글 기록

후속 고도화에서는 Slack, email, inbox 알림을 지원한다.

### 14.5 Sync Status UI 예시

```text
PriceFilterSlot.search_all_tab

현재 연결 기준
- Spec: 가격 필터 v4
- Figma: 가격 필터 frame
- Prototype: commit abc123

Sync Status: Checking Requested

요청자: 로엔
담당자: 디자이너 A
요청 사유:
Spec v4 기준으로 validation error 상태가 목업과 디자인에 반영됐는지 확인 필요

액션
[Synced로 표시]
[Needs Update로 표시]
[AI 목업 수정 요청]
[댓글 추가]
```

---

## 15. 댓글 / 확인 요청 정책

### 15.1 기본 방향

댓글과 확인 요청은 필수 승인 게이트가 아니라 선택적 협업 장치다.

### 15.2 MVP 댓글 범위

MVP에서는 단순 댓글을 지원한다.

댓글이 붙을 수 있는 대상:

- Spec Version
- Slot Variation
- Sync 확인 요청

댓글에 포함할 정보:

- 작성자
- 작성 시각
- 댓글 내용

### 15.3 후속 고도화

후속 버전에서는 다음을 검토한다.

- mention
- thread
- resolved 상태
- Slack / email 알림
- 확인 요청 inbox
- 댓글 기반 AI 수정 요청

---

## 16. Developer Export 정책

### 16.1 기본 방향

Developer Export는 개발자가 구현에 필요한 context를 개인 개발 환경에서 활용할 수 있도록 제공하는 패키지다.

Export는 현재 상태를 단순히 압축하는 것이 아니라, 어떤 기준 버전 조합으로 생성됐는지 명확히 기록해야 한다.

### 16.2 Export 단위

Developer Export는 두 가지 단위를 지원한다.

#### 16.2.1 Feature Export

실제 개발 착수 단위로 사용한다.

포함 내용:

- Feature Spec
- 하위 Component / Tab / State Spec
- Figma links
- Figma Coverage
- Prototype preview links
- Slot map
- mock data
- scenarios
- AI 개발 지시문
- export manifest

#### 16.2.2 Slot Export

특정 Slot Component / Variation 구현 또는 검토를 위한 작은 단위 패키지다.

포함 내용:

- 관련 Spec
- Figma link
- Prototype preview link
- Slot contract
- Slot variation 정보
- mock data
- scenarios
- AI 개발 지시문
- export manifest

### 16.3 Export 상태

Export는 두 종류로 구분한다.

#### Draft Export

- sync 확인이 완료되지 않아도 생성 가능
- 사전 검토, 기술 가능성 확인, 개발 실험용
- package 안에 Draft Export임을 명확히 표시

#### Official Export

- 담당자가 명시적으로 공식 전달용으로 생성
- 실제 개발 착수 기준으로 사용 가능
- manifest에 기준 버전과 생성 정보를 기록

### 16.4 Feature Export 구조 예시

```text
feature-export/
  README.md

  specs/
    feature.md
    components/
      price-filter.md
      brand-filter.md
    states/
      validation-error.md
      empty-result.md

  design/
    figma-links.md
    figma-coverage.json

  prototype/
    preview-links.md
    slot-map.json
    mock-data/
    scenarios/
    screenshots/

  ai/
    CLAUDE.md
    AGENTS.md
    codex.md

  metadata/
    export-manifest.json
    sync-status.json
```

### 16.5 Slot Export 구조 예시

```text
slot-export/
  README.md

  spec.md
  figma-link.md
  prototype-preview.md

  slot/
    slot-contract.json
    slot-variation.json
    mock-data.json
    scenarios.json

  ai/
    CLAUDE.md
    codex.md

  metadata/
    export-manifest.json
    sync-status.json
```

### 16.6 Export Manifest 예시

```json
{
  "export_type": "official",
  "export_unit": "feature",
  "feature_id": "feature.search.filter",
  "feature_title": "검색 필터 개선",
  "spec_versions": [
    {
      "spec_id": "feature.search.price_filter",
      "version": "v4"
    }
  ],
  "figma_frames": [
    {
      "frame_id": "figma.price_filter.default",
      "label": "가격 필터 기본 상태"
    }
  ],
  "prototype": {
    "repo": "prototype-repo",
    "commit": "abc123",
    "preview_url": "https://prototype.internal/search"
  },
  "sync_status": "Synced",
  "created_by": "roen",
  "created_at": "2026-05-14T00:00:00+09:00"
}
```

### 16.7 AI 개발 지시문

Export에는 Claude Code, Codex 등 개발자 개인 AI coding assistant에서 사용할 수 있는 지시문을 포함한다.

파일 예:

- CLAUDE.md
- AGENTS.md
- codex.md

지시문에는 다음이 포함된다.

- 기준 Spec Version
- 참고 Figma
- 참고 Prototype
- 구현 범위
- 기대 동작
- 수정 금지 범위
- 관련 mock data
- scenario
- 참고 파일 목록

---

## 17. MVP 범위

### 17.1 MVP 목표

MVP는 최대한 많은 핵심 개념을 포함하되, 각 기능은 수동·단순 버전으로 구현한다.

MVP의 목표는 다음 end-to-end workflow를 검증하는 것이다.

```text
Spec 작성
→ Figma 연결
→ Slot 기반 AI 목업 생성/수정
→ AI Task Plan 확인
→ Prototype Preview 확인
→ 담당자 Publish
→ Sync Status 수동 관리
→ Rollback
→ Developer Export
```

### 17.2 MVP에 포함할 기능

1. Project / Folder / Spec 관리
2. MD editor
3. Revision / Version 관리
4. Figma frame 수동 연결
5. Figma Coverage
6. prototype preview iframe
7. Compare View
8. Slot Component / Variation / Instance 모델
9. Surface / Tab / Region 관리
10. Slot Registry DB 관리
11. registry file prototype repo 동기화
12. AI Task Plan
13. AI Slot Variation 생성/수정
14. Add Slot Scenario
15. Slot Instance 삽입
16. Preview Ready 상태
17. 담당자 Publish
18. Published history
19. Rollback
20. Sync Status 수동 관리
21. 간단 댓글 / 확인 요청
22. Feature Export / Slot Export
23. Draft Export / Official Export
24. CLAUDE.md / codex.md 자동 생성
25. Project Owner / Prototype Owner / Task Owner / Viewer 권한 모델

### 17.3 MVP에서 단순화할 것

| 영역 | MVP 방식 | 후속 고도화 |
|---|---|---|
| Figma | URL 수동 입력 | Figma API metadata 수집 |
| Sync | 사람이 수동 지정 | 변경 감지 보조 기능 |
| Compare | iframe 좌우 비교 | screenshot diff |
| 댓글 | 단순 댓글 | thread, mention, resolved |
| 알림 | 상태/담당자 기록 | Slack/email/inbox 알림 |
| AI | Task Plan + Slot Patch | 영향도 분석, multi-slot 분해 |
| 권한 | 프로젝트 단위 | 폴더/Spec/Slot 단위 세분화 |
| Export | zip 다운로드 | GitHub PR, 개발 repo 연동 |

### 17.4 후순위 기능

MVP 이후로 미룰 기능:

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

---

## 18. 핵심 사용자 시나리오

### 18.1 가격 필터 개선 시나리오

#### 배경

기획자 로엔은 “검색 결과 가격 필터 개선” 과제를 진행한다.

#### Step 1. Spec 작성

로엔은 Component Spec을 Markdown으로 작성한다.

문서 내용:

- 가격 범위 선택
- 직접 입력
- 최소/최대 가격 validation
- validation 실패 시 error message
- 적용 버튼 disabled 조건

#### Step 2. Spec Version Publish

로엔은 Draft를 `가격 필터 Component Spec v1`으로 Publish한다.

#### Step 3. Figma 연결

디자이너 또는 Task Owner는 다음 Figma frame을 연결한다.

- 가격 필터 기본 상태
- 가격 입력 오류 상태

Figma required level은 required로 설정한다.

#### Step 4. Slot 모델 연결

로엔은 다음 Slot 구조를 설정한다.

```text
Slot Component: PriceFilterSlot
Slot Variation: price_filter.search_all_tab
Slot Instance: 검색 결과 > 전체 탭 > 필터 영역 > 2번째 슬롯
```

#### Step 5. AI 목업 요청

로엔은 AI 목업 생성을 요청한다.

입력 예:

```text
가격 필터에서 최소 가격이 최대 가격보다 클 때 validation error를 보여주고, 적용 버튼을 비활성화하는 interactive mock을 만들어줘.
```

#### Step 6. AI Task Plan 생성

시스템은 AI Task Plan을 생성한다.

Plan에는 다음이 포함된다.

- 작업 유형: Update Slot Variation + Add Slot Scenario
- 기준 Spec: 가격 필터 Component Spec v1
- 참고 Figma: 기본 상태, 오류 상태
- 대상 Slot: PriceFilterSlot.search_all_tab
- 수정 가능 파일
- 수정 금지 파일
- Preview route
- 검증 기준

#### Step 7. AI Patch 생성

로엔은 Plan을 확인한 뒤 AI Patch 생성을 실행한다.

시스템은 prototype repo의 격리 branch에서 Slot Variation을 수정한다.

#### Step 8. Preview 확인

내부 도구는 다음을 보여준다.

- 기획서
- Figma frame
- Working Mock Preview
- 변경 파일 목록
- Preview URL

로엔은 Compare View에서 Figma와 Mock을 나란히 확인한다.

#### Step 9. Publish

문제가 없으면 로엔은 Slot Variation을 Publish한다.

Published 정보에는 다음이 기록된다.

- Spec Version
- Figma frame
- Prototype Commit
- Slot Variation
- Publish한 사용자
- Publish 시각

#### Step 10. Sync Status 지정

로엔은 Sync Status를 Synced로 수동 지정한다.

#### Step 11. Developer Export

개발자는 Slot Export 또는 Feature Export를 다운로드한다.

Export에는 다음이 포함된다.

- Spec markdown
- Figma links
- Prototype preview links
- Slot contract
- mock data
- scenarios
- CLAUDE.md
- codex.md
- export-manifest.json

---

## 19. 미정 사항 / 다음 논의 필요 항목

다음 항목은 아직 상세 설계가 필요하다.

### 19.1 MVP 화면 IA

정해야 할 것:

- Project Home
- Spec Workspace
- Spec Detail
- Slot Detail
- Mock Preview / Compare View
- AI Task Plan Modal
- Publish History / Rollback
- Developer Export
- Settings / Members

### 19.2 핵심 데이터 모델

정해야 할 것:

- Project
- Folder
- Spec
- SpecVersion
- Revision
- FigmaFrame
- Surface
- Tab
- Region
- SlotComponent
- SlotVariation
- SlotInstance
- PrototypeRun
- PreviewDeployment
- SyncRecord
- ExportPackage
- Comment
- UserRole

### 19.3 prototype repo 상세 구조

정해야 할 것:

- surfaces 폴더 구조
- slots 폴더 구조
- scenarios 구조
- mock-data 구조
- registry file 포맷
- validation script 구조
- AI instructions 위치

### 19.4 AI 실행 방식

정해야 할 것:

- 내부 API 기반 Agent Runner로 실행할지
- 외부 Claude Code / Codex package export 중심으로 시작할지
- 두 방식을 병행할지
- MVP에서는 어떤 방식까지 지원할지

### 19.5 Preview infra 구성

정해야 할 것:

- branch별 preview 배포 방식
- preview URL 생성 방식
- iframe embedding 방식
- 인증/권한 방식
- preview 만료/보관 정책

### 19.6 댓글 / 알림의 MVP 깊이

정해야 할 것:

- MVP에서 댓글 대상 범위
- 확인 요청 담당자 지정 방식
- 알림은 MVP에서 제외할지
- Slack/email 알림 시점

### 19.7 Export 템플릿 상세

정해야 할 것:

- Feature Export README 구조
- Slot Export README 구조
- CLAUDE.md 템플릿
- codex.md 템플릿
- export manifest schema

---

## 20. 현재까지 확정된 의사결정 요약

| 번호 | 결정 항목 | 확정 내용 |
|---|---|---|
| 1 | Source of Truth | MD 기획서는 요구사항 기준, Figma는 디자인 기준, Prototype은 동작 검증용 산출물 |
| 2 | Prototype repo 역할 | 실제 제품 코드와 분리된 working wireframe app |
| 3 | 기획서 계층 | Feature Group / Epic → Feature Spec → Component / Tab / State Spec |
| 4 | 프로젝트/폴더 관리 | 폴더는 자유롭게, 문서 타입과 관계 정보는 표준화 |
| 5 | 버전 관리 | Revision은 자동 저장 이력, Version은 공식 기준 스냅샷 |
| 6 | Figma 연결 | Feature / Component / Tab / State / Scenario 단위 연결 가능, required level 관리 |
| 7 | AI 목업 플로우 | 사용자가 명시적으로 요청, Slot 기반 생성/수정 |
| 8 | Slot 모델 | Slot Component / Variation / Instance 구조 |
| 9 | Slot Registry | 내부 DB + prototype repo registry file 이중 구조 |
| 10 | Sync Status | 자동 판정이 아니라 수동 확인 기반 |
| 11 | 리뷰/승인 | 승인 게이트보다 담당자 Publish, 댓글/확인 요청은 선택적 협업 장치 |
| 12 | Developer Export | Feature Export / Slot Export, Draft / Official Export 지원 |
| 13 | 권한 | Project Owner > Prototype Owner > Task Owner > Viewer 위계 구조 |
| 14 | MVP 범위 | 핵심 end-to-end workflow를 넓게 포함하되 수동·단순 버전으로 구현, AI Task Plan 포함 |

---

## 21. PRD 요약

본 제품은 기획자, 디자이너, 개발자가 제품 개발 산출물을 하나의 기준으로 연결하고 관리하기 위한 내부 도구다.

제품의 핵심은 다음이다.

1. MD 기획서를 요구사항의 기준으로 둔다.
2. Figma를 디자인 기준으로 연결한다.
3. Prototype은 실제 제품 코드와 분리된 working wireframe으로 운영한다.
4. Prototype은 Slot 기반 구조를 가지며, AI 목업 작업은 Slot Variation 단위로 격리한다.
5. AI 작업 전 AI Task Plan을 생성해 사용자가 수정 범위와 기준 정보를 확인한다.
6. Spec, Figma, Mock은 승인 게이트보다 담당자 Publish와 Rollback을 중심으로 운영한다.
7. Sync 여부는 사람이 수동으로 확인한다.
8. 개발자는 Feature 또는 Slot 단위 export package를 받아 구현에 활용한다.

MVP는 이 전체 흐름이 end-to-end로 작동하는지를 검증하는 것을 목표로 한다.

