# 02 — Flutter 에디터 앱 아키텍처

`apps/editor` (Flutter web + desktop). 기존 **God-Store(697줄)** 를 해체하고, 관심사별 provider + Port 주입 구조로 재설계한다.

## 1. 레이어

```
┌──────────────────────────────────────────────────────────────┐
│ Presentation  (Flutter Widgets)                              │
│   - dashboard/  builder/  ai_panel/  viewer/  layout/         │
│   - 위젯은 provider를 watch/read 만. 비즈니스 로직 없음.       │
├──────────────────────────────────────────────────────────────┤
│ Application  (Riverpod Providers / Controllers)              │
│   - 상태 단위별 Notifier. 명령 실행, 파생 상태 계산.          │
├──────────────────────────────────────────────────────────────┤
│ Domain       (packages/form_factor)                          │
│   - FormFactor, FormCommand, LogicEvaluator, Validator (순수) │
├──────────────────────────────────────────────────────────────┤
│ Data / Ports (packages/formia_data)                          │
│   - FormRepository / AgentPort / ResponseRepository (인터페이스) │
│   - SupabaseFormRepository / DesktopFileRepository / ...      │
└──────────────────────────────────────────────────────────────┘
```

**규칙**: Presentation은 Domain을 직접 변형하지 않는다. 반드시 Application(Controller)의 명령 메서드를 호출한다. Application만 Port를 통해 Data에 접근한다.

## 2. Provider 지도 (God-Store 해체)

기존 단일 스토어의 책임을 아래로 쪼갠다. 각 provider는 **하나의 관심사**만 갖는다.

| Provider | 책임 | 기존 스토어의 어느 부분 |
| --- | --- | --- |
| `authControllerProvider` | Supabase 세션·로그인 상태 | `session`, 로그인 로직 |
| `formDocumentControllerProvider` | 현재 `FormFactor` + 편집 명령 + undo/redo 이력 | `formFactor`, `applyJsonPatch`, `history/future`, `undo/redo` |
| `editorSelectionProvider` | `activePageId`, `activeBlockId`, `viewport` | 선택/뷰포트 상태 |
| `persistenceControllerProvider` | 문서 변경 구독 → **디바운스 저장**, saveStatus, lastSyncedAt | `syncWithPersistence`, `window._formiaSaveTimeout`(제거) |
| `agentControllerProvider` | 대화형 에이전트 — `AgentEvent` 스트림 소비(텍스트/툴콜/툴결과), 메시지·세션 CRUD | `messages`, `addMessage`, `chatSessions` (단발 → 에이전틱으로 격상, → 07 문서) |
| `aiReviewControllerProvider` | 제안 패치 리뷰(수락/거절/블록·페이지 단위) | `pendingPatches`, `isReviewMode`, `accept*/reject*` |
| `formsListControllerProvider` | 대시보드 폼 목록 CRUD | `formsList`, `loadAllForms`, `deleteForm`, import/export |
| `aiKeyStatusProvider` | BYOK 키 상태 | `aiKeyStatus` |
| `formRepositoryProvider` | 현재 컨텍스트에 맞는 `FormRepository` 구현 주입 | `getRepository()` |
| `agentPortProvider` | `AgentPort` 구현 주입(`ClientDartanticAgent`) | `WebAIAdapter`(단발 → 에이전틱) |

**의존 방향**: `persistenceControllerProvider` 가 `formDocumentControllerProvider` 를 **watch** 하여 변경 시 저장을 예약한다(문서 컨트롤러가 저장을 모른다 → 편집과 영속성 분리). 기존처럼 편집 함수(`applyJsonPatch`) 안에서 직접 저장을 부르지 않는다.

## 3. 편집 명령 & 이력 (진짜 Command 패턴)

```dart
// packages/form_factor
sealed class FormCommand {
  FormFactor apply(FormFactor doc);      // 새 문서 반환(불변)
  CommandMeta get meta;                  // author, timestamp, description
}

class AddBlockCommand    extends FormCommand { final String pageId; final FormBlock block; ... }
class RemoveBlockCommand extends FormCommand { final String blockId; ... }
class UpdateBlockCommand extends FormCommand { final String blockId; final BlockContent content; ... }
class MoveBlockCommand   extends FormCommand { final String blockId; final int toIndex; final String toPageId; ... }
class ReorderPageCommand extends FormCommand { ... }
class UpdateThemeCommand extends FormCommand { ... }
class AiTurnCommand      extends FormCommand { final List<FormCommand> steps; ... } // AI 한 턴 = 원자적 묶음
```

> **AiTurnCommand**: 에이전트 한 턴에서 실행된 여러 툴콜(=여러 `FormCommand`)을 **하나의 원자적 이력 단위**로 감싼다. 사용자 undo 1회가 그 턴 전체를 되돌린다. 체인 중 한 스텝이 검증 실패하면 턴 전체 롤백(→ 07 §5.1). RFC6902 JSON Patch 경로는 폐기(→ 01 §5).

```dart
// apps/editor — Application
class FormDocumentController extends Notifier<FormDocState> {
  void execute(FormCommand cmd) {
    final before = state.doc;
    final after = FormFactorValidator.validated(cmd.apply(before));
    state = state.copyWith(
      doc: after,
      undoStack: [...state.undoStack, HistoryEntry(before, cmd.meta)].takeLast(100),
      redoStack: [],
    );
  }
  void undo() { /* undoStack pop → doc 교체, redoStack push */ }
  void redo() { /* 반대 */ }
}
```

- undo/redo는 **이전 문서 스냅샷 + 명령 메타**를 스택에 보관(전체 히스토리 배열을 매번 deep-clone 하던 기존 방식 대신, 불변 모델이므로 참조 보관으로 충분).
- 각 이력 항목은 `author(human|ai)`, `timestamp`, `description`을 가진다 → 변경 내역 UI/체크포인트의 토대(기존엔 없던 메타데이터).
- **AI 리뷰 플로우(Propose 기본)**: AI 턴의 툴콜들 → `aiReviewController`가 제안 스텝으로 보관 → 사용자가 수락하면 `AiTurnCommand`로 `FormDocumentController.execute` 호출(=원자적 이력 통합). 거절은 폐기. 턴 진행 중에는 캔버스 손편집을 잠근다(→ 07 §5.1). (기존의 별도 스냅샷/리뷰 상태 난립 정리.)

## 4. Port 인터페이스 (packages/formia_data)

모든 Repository/Port는 예외를 던지지 않고 **`Result<T>`(Ok/Error sealed)** 를 반환한다(하우스 스타일, ADR-8). `AgentPort`는 스트림이므로 이벤트 자체에 오류 케이스를 포함.

```dart
abstract interface class FormRepository {
  Future<Result<String>> create(FormFactor factor);
  Future<Result<void>>   save(String id, FormFactor factor);
  Future<Result<FormFactor>> load(String id);
  Future<Result<List<FormInfo>>> list();
  Future<Result<void>>   delete(String id);
}

abstract interface class AgentPort {          // 대화형 에이전트(스트리밍, → 07)
  Stream<AgentEvent> run(AgentTurn turn);     // TextDelta/ToolCall/ToolResult/AgentError/TurnComplete
  bool get isAvailable;
}

abstract interface class ResponseRepository {   // 공개 폼 응답
  Future<Result<void>> submit(String shortId, Map<String, Object?> answers, ResponseMeta meta);
}
```

**구현체 (DI로 교체)**:
| 인터페이스 | Web (로그인) | Web (게스트) | Desktop |
| --- | --- | --- | --- |
| `FormRepository` | `SupabaseFormRepository` | `LocalDraftRepository`(**hive**) | `DesktopFileRepository`(.formia) + 로그인 시 `HybridRepository` |
| `AgentPort` | `ClientDartanticAgent` → `llm-proxy`(Vault 키) | `ClientDartanticAgent` → provider **직결**(게스트 키) | 동일 |

- `formRepositoryProvider`는 `authControllerProvider` + 플랫폼을 보고 적절한 구현을 반환한다(기존 `getRepository(session)` 대체, 단 스토어 밖으로 이동).
- **HybridRepository**(문서엔 있었지만 미구현이던 것)를 데스크톱+로그인 시 실제 구현: 로컬 파일 즉시 저장 + 백그라운드 Supabase 동기화.

### 4.1 동기화 충돌 해소 (리뷰 반영 — "background sync"의 숨은 버그 방지)
로컬 `.formia`와 클라우드 사본이 갈라질 수 있다(오프라인 편집, 다중 기기). 무정책 LWW는 데이터 유실이다. 정책:
- 각 폼에 **`version` + `updatedAt`** 보유. 동기화 시 로컬/클라우드 버전 비교.
- **선형 관계**(한쪽이 다른 쪽의 조상)면 최신본으로 fast-forward.
- **분기(divergence)** 감지 시 **자동 덮어쓰기 금지** — 사용자에게 "로컬 vs 클라우드" 선택 프롬프트(양쪽 요약/시각 diff 제시).
- 최소 목표는 **LWW + 사용자 확인**. 장기적으로 `FormCommand` 기반 **커맨드 단위 동기화(CRDT-lite)** 로 발전(협업의 토대). 지금은 시임만 두고 과구현하지 않는다.

## 5. 지속성 & 세션 전략 (기존 하이브리드 정책 계승·정리)

- **로그인**: cloud-first. 에디터 진입 시 없으면 즉시 Supabase에 폼 생성, 변경은 디바운스(≈1s) 후 저장. `persistenceController`가 담당.
- **게스트**: privacy-first. 로컬(**hive**) 즉시 백업, **자동 복원 금지**. 새로고침 시 복원 프롬프트(`RestoreDraftPrompt`)로 명시 승인 시에만 로드, "새로 시작" 시 즉시 파기. (기존 `title === 'Formia 설문지'` 문자열 휴리스틱 대신, 로컬 draft 존재 여부 + 명시적 플래그로 판단.)
- **AI 채팅**: 휘발성. 세션 종료/새로고침 시 초기화(로그인 사용자는 Supabase 저장분을 선택적 로드).

## 6. 렌더링 (편집/프리뷰 단일화)

- 블록 렌더링은 `BlockView(block, mode)` 단일 위젯군. `mode ∈ {edit, preview}`.
  - `edit`: 인라인 편집·핸들·DnD 어포던스 오버레이.
  - `preview`: 실제 폼처럼 렌더(프리뷰 = 공개 폼과 시각적 동등).
- 기존 `BlockRenderer`(794줄, 빌더)와 `FormViewer`(385줄, 뷰어)의 **로직 중복 제거**: 한 블록 타입당 렌더 로직 1곳. `sealed BlockContent switch`로 강제.
- DnD: `flutter`의 `ReorderableList`/`Draggable` 기반(패키지 `@hello-pangea/dnd` 대체).

## 7. 폴더 구조 (apps/editor/lib) — zelly 레이어 관례 + 기능별 UI

zelly의 레이어 구조(`providers/` · `repository/` · `service/` · `ui/` · `router.dart` · `theme.dart`)를 따르되, 에디터가 크므로 `ui/`는 기능별로 나눈다.

```
lib/
├── main.dart
├── router.dart          # go_router
├── theme.dart           # 디자인 토큰/테마
├── providers/           # Riverpod provider 등록·조합(Application 레이어)
├── repository/          # (앱 로컬) formia_data Port 사용 래퍼 + model/
├── service/             # 앱 서비스(예: draft 복원, export)
└── ui/
    ├── dashboard/       # 폼 목록, 생성/삭제/가져오기/내보내기
    ├── builder/         # 캔버스, 블록 편집, DnD, 페이지 네비
    ├── ai_panel/        # 채팅, 제안 리뷰(diff)
    ├── viewer/          # 라이브 프리뷰(desktop/mobile 뷰포트)
    ├── auth/            # 로그인
    └── shared/          # 공통 위젯
```

> `ui/*` 하위 기능들은 서로 직접 import하지 않는다. 교차 상태는 provider로만 공유. 어떤 위젯도 `supabase` 패키지를 직접 import하지 않는다(→ `formia_data` 경유).
