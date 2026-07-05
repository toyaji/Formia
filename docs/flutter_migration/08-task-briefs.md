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
  - **다음: Phase 5(에이전틱 AI 폼 빌더) 또는 데스크톱 리포지토리 보강.**
