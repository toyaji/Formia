# 01 — Form Factor v3 (공유 도메인 모델)

`packages/form_factor` 에 구현되는 **순수 Dart** 도메인 모델. 에디터(Flutter)와 공개 렌더러(Jaspr)가 공유한다.

## 0. 이 문서가 고치는 기존 결함

| 기존 결함 | v3 해결 |
| --- | --- |
| `pages`가 `{start, questions[], endings[]}` 객체라 패치 경로가 제각각(`/blocks/-` vs `/pages/questions/0/blocks/...`) | `pages`를 **단일 순서 리스트**로 통일, `role`로 종류 구분. 경로 일관성 확보 |
| `patchUtils`가 실제 구조와 안 맞는 죽은 유틸 | 로컬 편집은 **타입 명령**으로. JSON Patch는 AI 제안 전용 |
| "Logic Builder" 기능은 있는데 스키마에 분기/조건 **모델 부재** | `logic` (규칙 기반 분기·표시 조건) 1급 모델 추가 |
| `content`가 optional 잡탕 객체(타입 안전성 낮음) | 블록 타입별 **sealed class**로 콘텐츠 표현 |
| `version`만 있고 마이그레이션 전략 없음 | `schemaVersion` + **명시적 마이그레이터**(v2→v3) |
| index 기반 참조(재정렬 취약) | 모든 참조는 **안정적 id(uuid)** 기반 |

## 1. 최상위 구조

```dart
class FormFactor {
  final String schemaVersion;      // "3.0.0"
  final FormMetadata metadata;     // title, description, createdAt, updatedAt
  final FormTheme theme;           // mode + tokens
  final List<FormPage> pages;      // 순서 있는 리스트 (아래 불변식 참조)
  final FormLogic logic;           // 분기/표시 규칙 (비어있을 수 있음)
  final FormSettings settings;     // submit 라벨, 성공 메시지 등
}
```

### 1.1 페이지 불변식 (Invariants)
`pages`는 리스트지만 다음을 **항상** 만족(생성자/검증기에서 강제):
1. `pages.first.role == start` — 정확히 1개, 항상 맨 앞, 삭제·이동·이름변경 불가.
2. 중간은 `role == question` 0..N개.
3. `pages.last.role == ending` — **주 종료 페이지**(primary) 1개는 필수·고정.
4. 추가 종료 페이지(early exit)는 primary 앞쪽 어디든 위치 가능하되 `role == ending`.

> 검증기는 이 불변식 위반 시 `FormFactorViolation`을 던진다. UI/AI는 위반을 만들 수 없다.

```dart
enum PageRole { start, question, ending }

class FormPage {
  final String id;                 // uuid, 안정적 참조 키
  final PageRole role;
  final String title;              // "시작 페이지" / "1페이지" / "종료 페이지" (규약)
  final String? description;       // 구조 식별용. 실제 내용은 blocks로.
  final List<FormBlock> blocks;
  final bool locked;               // start/primary-ending = true (삭제/이동/개명 불가)
}
```

## 2. 블록 모델 (타입별 sealed)

기존의 optional 잡탕 `content` 대신, 블록 타입별로 필드를 명확히 한다.

```dart
class FormBlock {
  final String id;                 // uuid
  final BlockContent content;      // sealed — 타입별 데이터
  final BlockValidation validation;// required, pattern, min/max ...
  final Map<String, Object?> style;// 자유 스타일 토큰 (선택)
  final bool removable;            // 코어 헤더 등은 false
}

sealed class BlockContent {}

class TextContent extends BlockContent {          // type: text
  final String label; final String? placeholder; final String? helpText;
}
class TextAreaContent extends BlockContent {       // type: textarea
  final String label; final String? placeholder; final String? helpText;
}
class ChoiceContent extends BlockContent {         // type: choice
  final String label; final List<ChoiceOption> options;
  final bool multiSelect; final bool allowOther; final String? helpText;
}
class RatingContent extends BlockContent {         // type: rating
  final String label; final int maxRating; final RatingStyle style; // star|number|emoji
}
class DateContent extends BlockContent {           // type: date
  final String label; final bool includeTime;
}
class FileContent extends BlockContent {           // type: file
  final String label; final List<String> acceptedTypes; final int maxSizeMb;
}
class InfoContent extends BlockContent {           // type: info — 마크다운 본문
  final String body;
}
class StatementContent extends BlockContent {      // type: statement — 중앙 정렬 헤딩/문구
  final String? label; final String? body;
}

class ChoiceOption { final String id; final String label; }  // 옵션도 id 보유(로직 참조용)
```

> **추가·삭제 규칙**: 새 블록 타입은 (1) `BlockContent` 하위 클래스, (2) 직렬화 매핑, (3) 렌더러(Flutter/Jaspr) 대응 위젯 3곳을 반드시 함께 갱신한다. 렌더러는 `switch(sealed)` 이므로 누락 시 컴파일 에러 → 기존 "한 블록 타입을 두 곳에서 따로 관리" 결함 방지.

## 3. Logic 모델 (신규 — 분기/표시 조건)

```dart
class FormLogic {
  final List<LogicRule> rules;
}

class LogicRule {
  final String id;
  final LogicCondition when;        // 조건 (블록 응답 기준)
  final List<LogicAction> then;     // 만족 시 액션들
}

sealed class LogicCondition {}
class BlockAnswerCondition extends LogicCondition {  // 특정 블록 응답 비교
  final String blockId;             // 안정적 id 참조
  final ConditionOperator op;       // equals, notEquals, contains, gt, lt, isEmpty ...
  final Object? value;
}
class AndCondition extends LogicCondition { final List<LogicCondition> all; }
class OrCondition  extends LogicCondition { final List<LogicCondition> any; }

sealed class LogicAction {}
class JumpToPageAction extends LogicAction { final String pageId; }   // 분기
class ShowBlockAction  extends LogicAction { final String blockId; }
class HideBlockAction  extends LogicAction { final String blockId; }
```

- **평가기** `LogicEvaluator.evaluate(FormFactor, Answers) → NavigationPlan / VisibilityMap` 를 `form_factor` 안에 순수 함수로 구현.
- 에디터의 프리뷰, 공개 폼(Jaspr) 런타임이 **동일 평가기**를 사용 → 분기 동작 일관성 보장.

### 3.1 그래프 정합성 (리뷰 반영 — 불변식과 로직의 충돌 방지)
페이지 불변식(§1.1)은 "마지막 = 종료 페이지"를 요구하지만 `JumpToPageAction`은 임의 페이지로 점프할 수 있다. 검증기/평가기는 다음을 강제한다:
- **도달성(reachability)**: 시작 페이지에서 자연 진행+모든 분기를 따라갈 때 **모든 페이지가 도달 가능**해야 한다. 도달 불가 페이지는 경고.
- **종료성(termination)**: **모든 경로가 어떤 ending 페이지에 도달**할 수 있어야 한다(막다른 분기 금지).
- **점프 규칙**: `JumpToPageAction` 대상은 뒤쪽(순방향) 페이지 또는 ending만 허용(기본). **역방향 점프(루프)는 금지**(무한 루프 방지). 필요 시 명시적 opt-in.
- 위 위반은 `FormFactorValidator`가 검출해 에디터에 경고를 노출(저장은 허용하되 배포 전 차단 가능).

## 4. 직렬화 & 마이그레이션

- 저장 포맷: **JSON**(`.formia` 파일 / Supabase `forms.factor`(jsonb)). `form_factor`는 **sealed 계층(BlockContent/LogicCondition/LogicAction)** 이 많아 **수동 `fromJson`/`toJson`(코드젠·build_runner 미사용)** 로 구현한다 — `type` 판별자 디스패치. codegen은 sealed 계층에서 마찰·hang 위험이 있어 배제(2026-07-05 착수 중 확인). 불변성은 `final` 필드 + 손수 `copyWith`. (DTO/네트워크 계층 등 flat 모델은 `json_serializable` 사용 가능 — ADR-8.)
- 최상위에 `schemaVersion` 필수. 로더는:
  ```dart
  FormFactor loadFactor(Map json) {
    final v = json['schemaVersion'] ?? json['version'] ?? '2.0.0';
    final migrated = FormFactorMigrator.migrate(json, from: v); // v2→v3 등
    return FormFactor.fromJson(migrated);
  }
  ```
- `FormFactorMigrator`: 버전별 순차 마이그레이션 함수 체인. **v2(기존)→v3** 변환기를 반드시 구현(기존 사용자 폼 데이터 보존).
  - v2 `pages.{start, questions[], endings[]}` → v3 `pages: [start, ...questions, ...endings]` (role 부여, locked 세팅).
  - v2 `content`(optional 객체) → v3 타입별 `BlockContent`(type 스위치로 매핑). v2 `options: string[]` → v3 `ChoiceOption(id, label)`(id 신규 생성).

### 4.1 무손실 보장 (리뷰 반영 — 데이터 유실 방지)
v2 `content`는 느슨한 잡탕이라 매핑 안 되는 필드가 **조용히 사라질 위험**이 있다. 마이그레이터는:
- **매핑되지 않은 필드를 수집·기록**하고, 미지 필드 발견 시 **조용히 버리지 않고** (a) `_migrationWarnings`에 격리 보존하거나 (b) 명시적으로 실패시킨다.
- **DoD는 "실행됨"이 아니라 "무손실"**: 실제 운영 factor(단순 `dev.db` 샘플이 아닌 실데이터 포함)로 라운드트립 테스트하여, **명시적 매핑 결정 없이 사라진 필드가 0**임을 증명한다.
- 옵션을 index/value로 참조하던 v2 로직이 있으면 신규 `ChoiceOption.id`로 재연결(참조 무결성 확인).

## 5. AI 상호작용 — 타입 명령(툴)만, RFC6902 폐기

> **결정(리뷰 반영)**: 레거시는 AI가 RFC6902 JSON Patch를 생성했으나, v3에서 **AI 쓰기 경로는 `FormCommand`(에이전트 툴)로 단일화**한다(→ 07 문서). JSON Patch 경로·`validateAiPatches`·경로 문자열 파싱은 **전면 폐기**한다.

- AI는 `add_block(pageId, type, content)` 같은 **툴콜**로 변경을 제안/실행하며, 각 툴은 대응 `FormCommand`로 매핑된다.
- 툴 인자는 `form_factor`의 타입으로 검증되고, `FormCommand.apply` 후 `FormFactorValidator`(§6)가 불변식·잠금·참조 정합을 강제한다. 위반 시 명령 실패(에이전트에 오류 되먹임).
- **장점**: 경로 문자열 불일치(레거시 결함)가 원천 소멸, 사람/AI가 동일 명령 시스템·동일 검증을 공유, 이력/undo 자동 통합.

## 6. 검증기

`FormFactorValidator`:
- 페이지 불변식(§1.1) 강제.
- 블록 id·페이지 id·옵션 id 유일성.
- 로직 규칙이 참조하는 `blockId`/`pageId`가 실재하는지(dangling reference 금지).
- **그래프 정합성(§3.1)**: 도달성·종료성·점프 규칙.
- required/pattern 등 검증 규칙의 정합성.

## 7. i18n 정책 (리뷰 반영 — 앱은 한국어)

도메인이 사용자 대면 문자열(검증 오류 메시지 등)을 어떻게 다루는지 **지금 결정**한다(나중 개조 비용 큼):
- **응답자 대면 콘텐츠**(블록 label/placeholder/options 등)는 폼 작성자가 입력한 값 → 그대로 데이터로 저장(번역 대상 아님).
- **시스템 생성 메시지**(검증 실패 "필수 항목입니다" 등)는 `form_factor`가 **메시지 키 + 파라미터**(`ValidationError(code, params)`)만 반환하고, **실제 문구는 UI 레이어(에디터/Jaspr)가 로케일별로 렌더**한다. 도메인은 언어 중립 유지.
- 앱 UI 문자열은 각 앱의 표준 i18n(Flutter `intl`/ARB, Jaspr 대응)으로 관리. 기본 로케일 `ko`.

> 이 패키지는 **UI·네트워크·DB를 모른다.** 순수 함수와 불변 모델만으로 "폼이 무엇인지"를 완결적으로 표현한다.
