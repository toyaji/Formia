# Formia — Flutter 전환 설계 문서

> 이 폴더는 기존 Next.js/React 기반 Formia를 **Flutter(에디터 앱) + Jaspr(공개 폼) + Supabase(백엔드)** 로 완전히 재설계·이관하기 위한 설계 문서 세트입니다.
> 기존 `docs/` 폴더의 문서들은 **레거시**이며, 전환이 완료되면 폐기됩니다. 새 코드 작업은 반드시 이 폴더 문서를 근거로 진행합니다.

## 확정된 아키텍처 결정 (2026-07-04)

| 항목 | 결정 | 근거 |
| --- | --- | --- |
| 에디터/대시보드 | **Flutter (Web + Desktop)** | 앱형 UX·DnD 캔버스에 최적, 한 코드베이스로 웹·데스크톱(추후 모바일) |
| 공개 폼(`/p/<id>`) | **Jaspr SSR/SSG (경량 HTML)** | SEO·초기 로딩·접근성·자동완성 유지. Flutter 캔버스의 약점 회피 |
| 도메인 모델 | **순수 Dart 패키지 `form_factor`** | 에디터와 공개 렌더러가 **동일한 Form Factor 코드 공유** |
| 백엔드 | **Supabase** (Postgres + Auth + Storage + Edge Functions + RLS) | 운영 최소화, zero-cost 배포, Dart SDK 우수 |
| 상태관리 | **Riverpod 2 (plain)** | zelly_flutter 하우스 스타일 정렬, DI/Port 주입, God-Store 해체 |
| 모노레포 | **Melos 8 + pub workspaces** | Dart 3.12 native 워크스페이스 |
| 직렬화/에러 | **sealed + json_serializable / `Result<T>`** | freezed 아님, zelly Compass 패턴 |
| AI 에이전트 | **dartantic_ai(클라이언트 루프) + Supabase Edge 키 프록시** | 대화형·툴콜링·스트리밍. 툴=FormCommand. 키는 서버에만 |

> **하우스 스타일 정렬(2026-07-04)**: 사용자의 활발한 Flutter 프로젝트 `/Users/paul/projects/zelly_flutter`의 컨벤션에 맞춤 — plain Riverpod + go_router + Dio + `Result<T>` sealed + json_serializable(freezed 미사용) + hive/shared_preferences/flutter_secure_storage + Sentry + flutter_lints(+커스텀 lint). 상세 [00-decisions.md#ADR-8](00-decisions.md).

## 문서 목록

| 문서 | 내용 |
| --- | --- |
| [00-decisions.md](00-decisions.md) | 아키텍처 결정 기록(ADR): 프레임워크·백엔드·상태관리·모노레포 구조와 그 근거 |
| [01-form-factor-v3.md](01-form-factor-v3.md) | 공유 도메인 모델 Form Factor **v3** 스키마 — 기존 결함(주소 불일치, 분기 부재 등) 수정 |
| [02-app-architecture.md](02-app-architecture.md) | Flutter 앱 클린 아키텍처 — 레이어, Riverpod provider 지도, **진짜 Command 패턴** undo/redo, Port/Repository |
| [03-backend-supabase.md](03-backend-supabase.md) | Supabase 스키마·RLS·인증·AI 프록시 Edge Function·BYOK 보안 강화·배포/응답 수집 |
| [04-public-renderer.md](04-public-renderer.md) | Jaspr 공개 폼 렌더러 — 공유 패키지 소비, 응답 제출, zero-cost 배포 |
| [05-migration-plan.md](05-migration-plan.md) | 단계별(Phase 0~7) 전환 계획, 레거시→신규 매핑, 각 단계 완료 기준(DoD) |
| [06-agent-workflow.md](06-agent-workflow.md) | **Opus(설계) / Sonnet(구현) 분업 프로토콜** — 작업 지시 템플릿·가드레일 |
| [07-ai-agent.md](07-ai-agent.md) | **에이전틱 AI 폼 빌더** — 대화형·툴콜링·스트리밍 에이전트(dartantic_ai + 서버 키 프록시), 툴=FormCommand |
| [08-task-briefs.md](08-task-briefs.md) | **Sonnet 착수용 Task Brief**(Phase 0·1) + 툴체인 설치 커맨드 — turnkey 실행 지시서 |

## 읽는 순서

- **처음 이해**: 00 → 01 → 02 → 03 순서.
- **구현 시작**: 05(계획) → 06(분업) → 해당 Phase가 참조하는 문서.
- **Sonnet 구현 에이전트**: 항상 06을 먼저 읽고, 배정된 Phase 문서 + 해당 도메인 문서만 선택적으로 읽음.

## 설계 리뷰 반영 (2026-07-04, 독립 블라인드 리뷰)

상위 모델 독립 리뷰를 거쳐 다음을 반영했다(문서 전반):
- **AI(Blocker)**: Gemini OpenAI-호환 스트리밍+툴콜 버그 회피 → `llm-proxy`를 **provider-aware**(native function-calling)로. Phase 0에 **AI 스트리밍 스파이크** 선검증.
- **보안**: 프록시는 "얇으니 안전"이 아니라 **적대적 클라이언트 가정**(모델 allowlist·쿼터·비용상한). **게스트 키는 클라이언트 직결**(서버 미경유). `get_public_form`에 `search_path` 고정 + published 투영. 응답 제출은 `submit-response` Edge(레이트리밋·크기·봇차단).
- **정합성**: RFC6902 경로 **폐기**, AI 쓰기 = FormCommand 툴 단일화. AI 한 턴 = **원자적 `AiTurnCommand`(단일 undo)** + 턴 중 편집 잠금. **Propose 모드 기본**.
- **도메인**: 로직 그래프 **도달성/종료성** 검증, v2→v3 **무손실 마이그레이션**, **i18n**(도메인 메시지 키).
- **계획/스코프**: Phase 0에 **Jaspr·AI 수직 스파이크**(최대 리스크 선검증), **응답 Export/분석** 추가, HybridRepository **충돌 해소 정책**, 무료티어·관측성 명시.

## 핵심 원칙 (기존 결함 대비)

1. **God-Store 금지** — 관심사별 provider 분리. 하나의 provider가 편집+영속성+채팅+대시보드를 겸하지 않는다.
2. **문서=코드 일치** — 문서에 적힌 패턴(Command, Port)은 반드시 코드에 실재해야 한다. 죽은 문서/죽은 코드 금지.
3. **도메인은 순수** — `form_factor` 패키지는 Flutter/Jaspr/네트워크/DB를 import하지 않는다.
4. **Port 경계 유지** — 에디터는 `FormRepository`, `AgentPort`, `ResponseRepository` 인터페이스만 안다. 구현체는 DI로 주입.
5. **타입 안전** — `dynamic`/`any` 남용 금지. 모델은 전부 타입·불변(immutable).
