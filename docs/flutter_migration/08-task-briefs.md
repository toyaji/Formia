# 08 — Sonnet 착수용 Task Brief (Phase 0 · 1)

06 문서의 분업 프로토콜 형식으로, 툴체인 준비 후 **바로 실행 가능한** 작업 지시서. Sonnet 구현 에이전트는 이 파일 + 근거 문서 섹션만 읽고 착수한다.

## 선행: 툴체인 (설치 완료 — 2026-07-04 확인)

| 도구 | 상태 | 비고 |
| --- | --- | --- |
| Flutter 3.44.1 / Dart 3.12.1 | ✅ | `/Users/paul/projects/flutter/bin` (login 셸 PATH). fvm 4.1.0도 있음 |
| Melos 8.1.0 | ✅ | `dart pub global activate melos` 완료. `~/.pub-cache/bin` |
| Supabase CLI | ✅ | `brew install supabase/tap/supabase` 완료 (Phase 2+) |
| jaspr_cli | ⛳ Phase 0에서 | `dart pub global activate jaspr_cli` |

> ⚠️ 비대화형 셸에서는 `export PATH="/Users/paul/projects/flutter/bin:$HOME/.pub-cache/bin:$PATH"` 를 먼저 실행할 것(그렇지 않으면 `flutter`/`dart`/`melos`가 안 잡힘).

---

## Task 0.1 — 모노레포 스캐폴딩 (Melos 8 + pub workspaces)
- **목표**: `melos bootstrap && melos run analyze` 가 통과하는 빈 모노레포.
- **근거 문서**: `00-decisions.md#ADR-6`·`#ADR-8`(구조·하우스 스타일), `README.md`(원칙).
- **범위**: 루트 `pubspec.yaml`(`workspace:` 목록, Dart 3.12 pub workspaces), `melos.yaml`, `analysis_options.yaml`(**`flutter_lints`** — very_good 아님).
  - `packages/formia_core`(Dart lib: `Result<T>` sealed = zelly `result.dart` 이식), `packages/form_factor`(pure Dart), `packages/formia_data`(Dart lib), `apps/editor`(`flutter create --platforms=web,macos`), `apps/public_form`(`jaspr create`).
  - 각 pubspec `resolution: workspace`. GitHub Actions: `melos run analyze` + `melos run test`.
- **하지 말 것**: 도메인 로직·UI 구현(스켈레톤만). Supabase 연결. freezed·riverpod_generator 추가 금지(ADR-8).
- **DoD**: `melos bootstrap` 성공, `melos run analyze` 경고 0, 각 앱 빈 화면 실행(`flutter run -d chrome`, `jaspr serve`).
- **의존 규칙**: `form_factor`는 `formia_core`(Result)만 의존 가능, Flutter/DB/네트워크 금지. UI가 `supabase` 직접 import 금지.

## Task 0.2 — 스파이크 A: Jaspr 공개 렌더 (리스크 선검증)
- **목표**: ADR-1 전제 검증 — Jaspr가 SEO/접근성 있는 폼 HTML을 SSR 할 수 있는가.
- **근거 문서**: `04-public-renderer.md`, `00-decisions.md#ADR-1`.
- **범위**: 하드코딩된 폼(텍스트 1 + 선택 1 블록)을 Jaspr SSR로 렌더, 제출 버튼 1개. **Lighthouse 측정**(SEO/성능/접근성 점수 기록).
- **하지 말 것**: form_factor 연동(하드코딩 OK), 실제 DB 저장.
- **DoD**: SSR HTML에 폼 텍스트가 DOM으로 존재(뷰소스 확인), Lighthouse 접근성·SEO ≥ 90. 결과를 이 문서 하단 "스파이크 결과"에 기록.

## Task 0.3 — 스파이크 B: AI 스트리밍 툴콜 (최대 리스크 선검증)
- **목표**: 07 §2 핵심 검증 — dartantic_ai로 Gemini **native** function-calling + 스트리밍 1회 왕복.
- **근거 문서**: `07-ai-agent.md#2`, `#4`.
- **범위**: dartantic_ai로 툴 1개(`get_form_summary` 흉내: 고정 문자열 반환) 등록, "폼 요약해줘" 프롬프트 → 스트리밍으로 툴콜→툴결과→텍스트 응답 수신. 키는 로컬 env로 임시(프록시는 스파이크에서 생략).
- **하지 말 것**: 프록시·BYOK·form_factor 연동(다음 Phase).
- **DoD**: 콘솔에 스트리밍 델타 + 툴콜 실행 + 최종 텍스트가 순서대로 출력. **OpenAI-호환이 아닌 Gemini native 경로**로 성공. 실패 시 → 07 폴백(서버 루프/Vercel AI SDK) 재검토 후 보고.

> ⚠️ **게이트**: 0.2·0.3 중 하나라도 실패하면 Phase 1로 진행하지 말고 Opus(설계)에 보고 → ADR 재검토.

---

## Task 1.1 — 도메인 모델 & 직렬화
- **목표**: `form_factor` v3 불변 모델 + JSON 직렬화.
- **근거 문서**: `01-form-factor-v3.md#1`~`#2`, `#4`.
- **범위**: `FormFactor/FormMetadata/FormTheme/FormPage/FormBlock` + `sealed BlockContent`(8타입) + `ChoiceOption`. freezed+json_serializable. `PageRole` enum. 페이지 불변식은 팩토리/`copyWith`에서 강제.
- **DoD**: 모델 round-trip(`fromJson(toJson()) == 원본`) 테스트, 불변식 위반 시 예외 테스트. `melos run analyze` 0.

## Task 1.2 — 검증기 & 로직 평가기
- **목표**: `FormFactorValidator` + `LogicEvaluator`.
- **근거 문서**: `01-form-factor-v3.md#3`, `#3.1`, `#6`.
- **범위**: 불변식·id 유일성·dangling reference·**그래프 도달성/종료성/점프 규칙**. `LogicEvaluator.evaluate(factor, answers)`.
- **DoD**: 도달불가 페이지·막다른 분기·역방향 점프 검출 테스트. 분기 네비게이션 평가 테스트.

## Task 1.3 — 명령 & 이력
- **목표**: `FormCommand` 계열 + `AiTurnCommand`(원자적) + `HistoryStack`.
- **근거 문서**: `02-app-architecture.md#3`, `07-ai-agent.md#5.1`.
- **범위**: Add/Remove/Update/Move Block, ReorderPage, UpdateTheme, `AiTurnCommand(steps)`. 각 `apply`→검증. 이력 메타(author/timestamp/description). undo/redo.
- **DoD**: 각 명령 apply/undo 테스트, `AiTurnCommand` 1회 undo가 전체 롤백, 체인 중 실패 시 전체 롤백 테스트.

## Task 1.4 — v2→v3 마이그레이터 (무손실)
- **목표**: 레거시 factor 무손실 변환.
- **근거 문서**: `01-form-factor-v3.md#4`, `#4.1`. 레거시 스키마: `src/lib/core/schema.ts`, 샘플 데이터: `dev.db`의 `Form.factor`.
- **범위**: v2 `pages.{start,questions[],endings[]}`→v3 리스트, v2 `content`→타입별 `BlockContent`, `options:string[]`→`ChoiceOption`. **미매핑 필드는 버리지 말고 `_migrationWarnings` 수집 또는 실패**.
- **DoD**: 실제 `dev.db` factor로 라운드트립, **명시적 매핑 없이 사라진 필드 0** 증명. i18n: 검증 메시지는 키+파라미터 반환(01 §7).

---

## 실행 로그

- **작업 브랜치**: `refactor/flutter-migration` (단계별 커밋, push는 아직 안 함 → CI 미트리거).
- **Phase 2 전체: ✅ 완료·검증·커밋·푸시(2026-07-05)**.
  - DB: `init_schema`(스키마·RLS·GRANT·`get_public_form` RPC) + `rate_limits`(hit_rate_limit RPC). RLS는 `owns_form()`/`owns_session()` security-definer 헬퍼로 cross-table 참조 제거, service_role GRANT 포함. `rls_test.sql` 통과.
  - Edge Functions: `submit-response`(크기상한·per-IP 레이트리밋·published 검증·service_role insert) + `llm-proxy`(모델 allowlist·per-caller 쿼터·Gemini native 포워딩·키 서버전용). 로컬 검증: 제출 200+row, 미발행 404, 레이트리밋 429, llm-proxy 200(candidates)·미허용모델 403.
  - 브랜치 `refactor/flutter-migration` 커밋 8개 push 완료.
- **Phase 3: ✅ 대부분 완료·검증(2026-07-05)**.
  - Port 인터페이스(FormRepository/ResponseRepository/AgentPort, Result 반환) + `SupabaseFormRepository`(로컬 통합 테스트 통과)·`SupabaseResponseRepository`(submit-response 경유)·`ClientDartanticAgent`(dartantic, 툴↔AgentEvent 스트림).
  - **AI 발견**: dartantic Google 구현이 절대 URL이라 커스텀 baseUrl 프록시 라우팅 불가(→ 07 §2 노트). **게스트/클라이언트-키**는 직결로 검증됨(테스트 통과). **로그인/Vault 키**는 서버측 AgentPort 루프로 이관(Phase 후속).
  - 남은 것: 게스트 `LocalDraftRepository`(hive)·데스크톱 `DesktopFileRepository`(dart:io)·`HybridRepository`는 플랫폼 특화라 Phase 4(에디터)에서 구현.
  - **다음: Phase 4(에디터 앱 핵심 — 인증·대시보드·빌더·영속성).**

- **0.1 스캐폴딩: ✅ 완료(2026-07-05)**. Melos 8 + pub workspaces. `packages/formia_core`(Result), `form_factor`, `formia_data` + `apps/editor`(flutter web+macos), `apps/public_form`(jaspr). `melos run analyze` 이슈 0, 테스트 통과, `flutter build web`·`jaspr build` 성공. 커밋 안 함(로컬).
  - 주의(Melos 8): `melos.yaml` 없음 → 설정은 root `pubspec.yaml`의 `melos:` 키. `test`(dart)/`test:flutter`(flutter) 분리. `melos run <s>`는 `--no-select` 필요(비대화형). CI는 ubuntu-latest.
  - `formia_ui_kit`는 지연(UI Phase에서). 루트 단일 `pubspec.lock`.
- **0.2 Jaspr 스파이크: ✅ PASS(2026-07-05)**. `apps/public_form`에 `FormRenderer`(공유 `sealed BlockContent` switch → 시맨틱 HTML) + 샘플 폼. `jaspr serve` SSR HTML을 curl 검증: **JS 실행 없이** `<form>`·`<label for>`·`<input autocomplete required>`·`<fieldset><legend>`·radio 옵션·submit이 실제 DOM에 존재(SEO·접근성·자동완성 OK) → ADR-1 전제 실증. Flutter 에디터와 **동일한 sealed 모델**을 Jaspr가 렌더함(중복 제거 구조 검증).
  - Lighthouse CLI 미설치라 점수측정은 보류(수동). 단 시맨틱 DOM·a11y 속성은 raw HTML로 직접 확인함.
- **0.3 AI native 툴콜 스파이크: ✅ PASS(2026-07-05)**. dartantic_ai 2.2.2 `Agent('google:gemini-2.5-flash', tools:[Tool(...)])` + `sendStream` → **스트리밍 9이벤트 + get_form_summary 툴 호출 + 한국어 최종요약** 성공. **Gemini native function-calling 경로**(OpenAI-호환 아님) → 07 §2 리뷰 Blocker 해소.
  - ⚠️ 모델: `gemini-2.0-flash`/`gemini-2.0-flash-lite`는 이 키에서 무료 quota 0. **`gemini-2.5-flash`(및 `gemini-flash-latest`)만 동작** → 기본 모델·allowlist는 `gemini-2.5-flash` 사용. (dartantic google provider는 `GEMINI_API_KEY` env 읽음.)
  - 스파이크 코드는 scratchpad(레포 미포함). dartantic_ai가 Flutter 없이도 순수 Dart로 동작 확인.
- **Phase 1 전체: ✅ 완료·검증(2026-07-05)**. 서브에이전트 3연속 인프라 실패(stall×2 + connection-closed) → **Opus가 직접 구현**. 수동 JSON(코드젠 없음). `melos run analyze` 전패키지 0, `form_factor` **테스트 43개 전부 통과**.
  - 1.1 모델+직렬화+불변식: model/{choice_option,block_content,block,page,logic,theme,form_factor}.dart. round-trip(전체+8블록+로직) + 불변식 8종.
  - 1.2 검증기+그래프+로직평가: validation/{validation_error,validator}.dart(도달성·종료성·backward jump 경고·dangling ref), logic/logic_evaluator.dart(조건 연산자·show/hide·jump). 테스트 10.
  - 1.3 명령+이력: command/{commands,history}.dart. Add/Remove/Update/Move Block·ReorderPage·UpdateTheme/Metadata·**AiTurnCommand(원자적)**·DocHistory undo/redo. 테스트 5(단일 undo·mid-chain 롤백·locked 보호 포함).
  - 1.4 무손실 마이그레이터: migration/migrator.dart. v2→v3, options→ChoiceOption, 미매핑 필드→`MigrationWarning` 격리(무손실), 실 v2 defaultForm 라운드트립. 테스트 4.
  - 견고화: `FormFactor.fromJson`이 `Map<dynamic,dynamic>`(hive 로컬 draft 경로) 정규화.
  - ⚠️ 이 세션 백그라운드 서브에이전트는 정확히 600s 스트리밍 워치독으로 반복 중단(인프라). 직접 구현으로 진행 중.
- **Phase 4: ✅ 완료·검증(2026-07-05)**. 로그인→대시보드→빌더 최소 루프(02 문서대로 provider 분리, God-Store 없음). 커밋 안 함(로컬).
  - `apps/editor` 의존성: `flutter_riverpod`·`go_router`·`supabase_flutter`·`hive`/`hive_flutter`·`uuid`·`google_fonts`(+ `flutter_localizations`/`intl` l10n).
  - Providers: `authControllerProvider`(Supabase 세션, plain Notifier) · `formRepositoryProvider`(로그인→`SupabaseFormRepository`, 게스트→신규 `LocalDraftRepository`) · `formDocumentControllerProvider`(family, `DocHistory` 래핑 execute/undo/redo) · `persistenceControllerProvider`(family, 900ms 디바운스 저장 + saveStatus) · `editorSelectionProvider`(activePageId/activeBlockId/viewport/previewMode, 이력에 안 들어감) · `formsListControllerProvider`(AsyncNotifier, 대시보드 CRUD).
  - `LocalDraftRepository`(`apps/editor/lib/repository/`): Hive(웹 IndexedDB) 기반 게스트 `FormRepository` 구현. 데스크톱 `DesktopFileRepository`/`HybridRepository`는 아직 미구현(Phase 3에서 넘어온 잔여 항목, 데스크톱 타깃 착수 시 추가 필요).
  - UI: `ui/auth`(로그인, 게스트 진입) · `ui/dashboard`(목록/생성/삭제 + 게스트 복원 프롬프트) · `ui/builder`(페이지 네비·`BlockView(mode:edit|preview)` 8블록 타입·ReorderableListView DnD·undo/redo·뷰포트 토글·라이브 프리뷰) · `ui/shared/restore_draft_prompt.dart`.
  - i18n: `l10n.yaml` + `lib/l10n/app_{ko,en}.arb`(UI 문구, 기본 로케일 ko) + `domain_messages.dart`(도메인 `code`+`params` → 한국어 매핑, UI 소유 원칙 01 §7).
  - AddPageCommand 등 페이지 CRUD는 범위 밖(05 문서에 "페이지 네비"만 명시, 페이지 추가/삭제는 없음) — `blank_form.dart`가 시작/질문 1/종료 3페이지로 새 폼을 생성.
  - **디자인**: 처음엔 기본 Material 테마로 구현했으나 사용자 피드백으로 레거시 React 앱(`src/styles/tokens.css`, `Dashboard.module.css`, `login.module.css`)의 색상·타이포·형태 토큰을 확인 후 `theme.dart`에 Flutter-네이티브 방식(ColorScheme/컴포넌트 테마)으로 이식(CSS 그대로 베끼지 않음). Primary `#3B82F6`, 배경 `#F6F9FF`, 텍스트 `#1E293B`/`#64748B`, 보더 `#E2E8F0`, 버튼 radius 8/카드 12, `google_fonts` Noto Sans KR(Pretendard 대체), 그라디언트 "Formia" 워드마크(`FormiaWordmark`).
  - 검증: `melos run analyze` 전패키지 0 이슈, `melos run test`/`test:flutter` 통과. `flutter run -d chrome`로 실제 골든 패스 수동 확인 — 게스트 대시보드→새 폼 생성→빌더(페이지 네비·블록 추가·인라인 편집 카드 렌더)→새로고침 시 복원 프롬프트 표시→"이어서 편집"으로 동일 폼 재진입(Hive 영속 확인). 자동화 한계: CanvasKit 텍스트필드에 대한 DOM 레벨 키 입력 시뮬레이션은 preview 툴 환경에서 안정적으로 재현되지 않아(hidden input 값은 갱신되나 캔버스 리페인트 미확인) 실제 타이핑 결과는 수동 확인 권장. undo/redo·페이지 불변식은 `form_factor` 유닛 테스트(43개)로 별도 검증됨.
- **Phase 5: ✅ 완료·검증(2026-07-05)**. 에이전틱 AI 폼 빌더(Propose 모드), 07 문서대로. 커밋 요청 시 함께 커밋.
  - `form_factor`: `AddPageCommand`/`RemovePageCommand` 신규 추가(Phase 4 로그의 "페이지 CRUD는 범위 밖" 메모를 갱신 — 07 §4 툴 카탈로그가 add_page/remove_page를 요구하므로 추가). `AddPageCommand`는 종료 페이지 바로 앞에 삽입, `RemovePageCommand`는 잠긴 페이지 보호 + `FormFactor` 불변식(마지막 종료 페이지 등)에 위임. 테스트 4개 추가(전체 47개 통과).
  - `formia_data`: `lib/src/agent/tool_catalog.dart` — 툴↔`FormCommand` 순수 브리지. `ToolSpec`(이름/설명/JSON 스키마) 8종(add_page/remove_page/reorder_page/add_block/update_block/remove_block/move_block/set_metadata) + `get_form_summary`(읽기 전용, `summarizeForm()`). `buildCommandFromTool()`은 커맨드만 만들고 적용은 안 함(적용은 앱 레이어의 draft doc이 담당). 테스트 8개(멀티 툴 턴→`AiTurnCommand` 단일 undo 포함).
  - `apps/editor`: `byokKeyProvider`(게스트 Gemini 키, Hive `ai_keys_v1`, 프록시 미경유 — 07 §2/§6) · `agentControllerProvider`(family) — 턴마다 로컬 draft `FormFactor`를 유지하며 각 툴콜을 즉시 draft에 적용(모델이 `get_form_summary`로 턴 중간 상태를 재관찰 가능), 턴 종료 시 누적된 step들을 **하나의 `AiTurnCommand`로 묶어 `pendingTurn`에 보관**(Propose 모드) — 사용자가 수락해야 `FormDocumentController.execute()`로 실제 문서에 반영, 거절 시 폐기. `AgentState.isLocked`(턴 진행 중이거나 리뷰 대기 중)일 때 빌더 캔버스를 `IgnorePointer`+반투명 처리로 잠금(07 §5.1의 "동시 손편집 방지"를 버전 필드 대신 캔버스 잠금으로 단순 구현 — YAGNI, 단일 사용자 클라이언트 시나리오에서 충분).
  - UI: `ui/ai_panel/ai_chat_panel.dart` — 스트리밍 말풍선, 인라인 툴콜 카드(대기/성공/실패), 수락/거절 리뷰 바(스텝 요약 목록), BYOK 키 설정 다이얼로그. 빌더 AppBar에 토글 아이콘으로 접고 펼치는 우측 패널로 연결.
  - **로그인/Vault 키 경로는 미구현**(07 §2 노트대로 서버측 AgentPort 루프가 필요 — YAGNI로 후속 처리, 지금은 게스트 BYOK만 동작). `add_logic_rule`/`remove_logic_rule` 툴도 스코프 밖(분기 로직 규칙 편집 UI 자체가 아직 없음 — 후속).
  - 검증: `melos run analyze` 전패키지 0 이슈, `melos run test` 전체 통과(form_factor 47 + formia_data 8, Gemini 키 없어 실제 스트리밍 테스트는 스킵). `flutter run -d chrome` 수동 확인 — AI 패널 토글·빈 상태 문구·키 설정 다이얼로그 열기/닫기 렌더 확인. **실제 LLM 왕복(스트리밍 텍스트/툴콜/제안 리뷰)은 Gemini API 키가 필요해 이 세션에서 라이브 검증 못 함** — Phase 0.3 스파이크에서 이미 dartantic native 툴콜 자체는 검증됨. 실사용 전 실제 키로 1회 대화 시나리오 수동 확인 권장.
- **Phase 6: ✅ 완료·검증(2026-07-06)**. 공개 폼 렌더러(Jaspr)·배포·응답 열람/CSV/기본 분석. 커밋 요청 시 함께 커밋.
  - `formia_data`: `DeploymentRepository`(+ `SupabaseDeploymentRepository`) — 배포/배포취소, 재배포 시 기존 short_id 재사용. `PublicFormRepository`(+ `SupabasePublicFormRepository`) — anon `get_public_form` RPC. `ResponseRepository.list()` 추가(owner-only, RLS `responses_owner_read`에 위임) + `ResponseRecord`. `DeploymentInfo.isPublished` 게터. 통합 테스트 `deployment_and_public_form_test.dart` — **로컬 Supabase + `supabase functions serve`로 실제 publish→anon RPC fetch→anon submit(edge function)→owner list→unpublish 전체 왕복을 검증**(스킵 아님, 실제 실행·통과).
  - `apps/editor`: `deploymentRepositoryProvider`(게스트=null, 로그인만 배포 가능) · `responseRepositoryProvider`/`responsesControllerProvider`. 대시보드 행에 배포/배포취소·게시됨 배지·링크복사·응답보기 액션 추가. `ui/responses/response_list_page.dart`(`/editor/:formId/responses`) — 응답 테이블, 객관식/평점 문항 분포(막대), CSV 내보내기(`csv_export.dart`, 웹은 실제 파일 다운로드, 데스크톱은 클립보드 폴백 — Phase 3 잔여 `DesktopFileRepository` 부재와 동일 사유).
  - **분석 범위 축소(정직한 스코프)**: 03 §6의 "완료율"·"이탈 지점"은 세션/부분제출 추적이 스키마에 없어 계산 불가 — 이번 구현은 총 응답 수 + 문항별 분포만 제공. 완료율/드롭오프는 세션 트래킹 스키마 추가가 선행되어야 하는 후속 작업으로 명시.
  - `apps/public_form`: `jaspr_router` 추가, `/p/:shortId` 실제 라우팅. `PublicFormPage`(`PreloadStateMixin`으로 서버 사이드 프리로드 + 클라이언트 하이드레이션 시 재조회) 가 anon RPC로 factor를 가져와 실제 인터랙티브 HTML 폼 렌더(라디오/텍스트/텍스트에어리어/날짜, `onInput`/`onChange`로 답변 수집) 후 `submit-response` 경유 제출, 종료 페이지 렌더. Phase 0.2 스파이크의 정적 `FormRenderer`/샘플 `Home`은 실제 페이지로 대체되어 삭제(중복 로직 방지).
  - **스코프 축소(정직하게 기록)**: 04 문서의 다중 페이지 네비게이션 + `LogicEvaluator` 기반 분기는 이번 패스에 없음 — **모든 질문 블록을 한 페이지에 렌더**하는 단일 페이지 폼으로 구현(핵심 골든 패스 우선, 분기/다단계는 후속). 파일 업로드 블록은 컨트롤만 렌더하고 값은 캡처하지 않음(Storage 서명 업로드 미구현, 후속).
  - **검증(실제 로컬 스택 대상, 목업 아님)**: `melos run analyze` 전패키지 0 이슈. `melos run test` 전체 통과(form_factor 47, formia_data 11 — 새 통합 테스트 포함). **수동 브라우저 검증**: (1) 스크립트로 실제 폼 생성·배포(`publish()`) → shortId 발급 확인 (2) `jaspr serve`로 `/p/<shortId>` 요청 → curl로 SSR raw HTML에 실제 Supabase 데이터(제목/3블록) 존재 확인(JS 없이) (3) 브라우저에서 폼 작성 후 제출 버튼 클릭 → 종료 페이지 렌더 확인 (4) 별도 스크립트로 owner 세션 `ResponseRepository.list()` 호출 → 방금 제출한 응답 데이터 `{name, score, channel}` 실제 확인. 4단계 전부 실기 검증 완료.
  - **다음: Phase 7(레거시 이관·컷오버·정리) — 또는 이번 세션에서 스코프 축소된 항목(다중페이지 분기, 완료율/드롭오프 분석, 파일 업로드, 로그인 AI 키 경로, 데스크톱 리포지토리) 보강.**

- **Phase 7: 부분 진행(2026-07-06)**. 사용자 방침 확인: (1) 데스크톱 서명/공증은 Apple/Azure 계정 접근 권한이 없어 사용자가 직접 설정 — 가이드 작성으로 대응. (2) **레거시 코드 삭제는 보류** — 디자인이 레거시와 "누가 봐도 비슷한" 수준으로 확인된 뒤 사용자 최종 검사 후 진행(대조 대상이 필요하므로). 이번 세션엔 삭제를 진행하지 않음.
  - **레거시 데이터 이관**: `supabase/scripts/import_legacy.dart`(신규 workspace 멤버, 자체 pubspec) — sqlite3 CLI로 `dev.db` 읽음(네이티브 FFI 의존성 추가 안 함) → `FormFactorMigrator`로 v2→v3 변환 → Supabase REST(service_role)로 `forms`/`deployments`/`responses` 적재. 레거시 `User.email` ↔ Supabase auth 사용자를 admin API로 매칭(미매칭 시 스킵+리포트, 03 §7 "OAuth 재로그인" 전제와 일치). **실제 발견**: `dev.db`의 폼 3개 중 2개가 종료 페이지가 아예 없는 상태로 저장돼 있었음(레거시가 v3 불변식을 강제한 적이 없어서) — `FormFactor.fromJson`이 `pages.atLeastOneEnding` 위반으로 예외를 던짐을 확인하고, 기본 종료 페이지를 자동 보강(무손실 원칙은 유지 — 필드 손실이 아니라 구조 보정, 리포트에 기록)한 뒤 재검증하도록 스크립트를 짬. `--dry-run` 지원. 로컬 Supabase에 테스트 auth 사용자를 만들어 **실제 3개 폼 + 배포 1개(short_id 보존) 전부 이관 성공, 재실행 시 중복 스킵(멱등성) 확인**까지 실기 검증(스킵 아님).
  - **데스크톱 빌드**: `flutter build macos --release` 로컬 검증(`editor.app`, ad-hoc 서명 universal binary). `flutter create --platforms=windows .`로 `apps/editor/windows/` 스캐폴딩 추가(로컬은 macOS라 빌드 불가 — GitHub Actions `windows-latest`가 유일한 검증 경로). `.github/workflows/desktop_release.yml` 신규(수동 dispatch + `v*.*.*` 태그 push, macOS+Windows 빌드, 시크릿 있으면 자동 서명/공증까지, `actionlint` 통과 확인). **실제 버그 발견 및 수정**: macOS `Runner/Release.entitlements`·`DebugProfile.entitlements`에 `com.apple.security.network.client`가 누락돼 있었음 — App Sandbox가 아웃바운드 네트워크를 차단해 Supabase/Gemini 호출이 막혀 있었을 가능성이 높음(이 환경엔 디스플레이가 없어 GUI로 최종 확인은 못 함, 사용자가 로컬에서 로그인/대시보드 로딩으로 확인 권장). 서명/공증 절차는 `09-desktop-release.md`에 가이드 작성(Apple Developer ID+notarytool, Windows는 Azure Trusted Signing 권장) — 계정·인증서는 사용자가 직접 진행.
  - **기능 동등성 체크리스트**: `10-feature-parity-checklist.md` — 레거시 `src/`(라우트·컴포넌트·`src-tauri/`)를 직접 읽고 신규와 항목별 대조. **레거시 삭제 전 반드시 메워야 할 진짜 회귀 2건 발견**: (1) 대시보드 `.formia` 가져오기/내보내기가 레거시엔 있는데 신규엔 없음. (2) 공개 폼이 레거시는 다중 페이지 순차 네비게이션인데 신규는 한 페이지 몰아서 렌더(Phase6에서 이미 알려진 축소). 반대로 **레거시엔 애초에 없던 것으로 정정된 항목**: 데스크톱 `.formia` 파일 리포지토리(레거시 Tauri 셸은 커스텀 Rust 커맨드가 전혀 없는 순수 웹뷰 래퍼였음, 직접 확인), 응답 열람 UI/CSV 내보내기(레거시엔 제출 API만 있고 열람 화면 자체가 없었음), 제출 레이트리밋(레거시엔 없었음). 조건부 분기는 양쪽 다 사용자가 쓸 수 있는 UI가 없음(신규는 엔진만 존재).
  - **다음**: 위 회귀 2건(가져오기/내보내기, 다중페이지 공개 폼) 보강 → 사용자가 디자인 동등성 육안 확인 → 최종 승인 후 레거시(`src/`, `prisma/`, `src-tauri/`, `next.config.mjs` 등) 삭제.
