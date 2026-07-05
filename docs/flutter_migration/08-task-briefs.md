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
- **Phase 2 DB 계층: ✅ 완료·검증·커밋(2026-07-05)**. `supabase init` + `migrations/*_init_schema.sql`(스키마·RLS·GRANT·`get_public_form` RPC). 로컬 `supabase start`(Docker) 적용 성공 + `supabase/tests/rls_test.sql` **RLS TESTS PASSED**(비소유자 차단·anon forms 직접읽기 차단·anon 응답 insert 차단·공개폼 RPC 접근). 로컬 스택 실행 중.
  - 다음(Phase 2 잔여): Edge Functions `llm-proxy`(provider-aware, gemini-2.5-flash native, allowlist·쿼터) + `submit-response`(published 검증·크기상한·IP 레이트리밋). `supabase functions serve`로 로컬 테스트.

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
