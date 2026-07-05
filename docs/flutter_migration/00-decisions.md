# 00 — 아키텍처 결정 기록 (ADR)

각 결정은 배경/선택/근거/기각안 형식으로 기록합니다. 이후 문서는 이 결정을 전제로 합니다.

---

## ADR-1. 프론트엔드 렌더링: Flutter 앱 + Jaspr 공개 폼

**배경**: 이 제품은 성격이 다른 두 화면 군으로 나뉜다.
- (A) **에디터/대시보드** — 로그인 후 쓰는 앱형 UI. DnD 캔버스, 다중 패널, 라이브 프리뷰, AI 채팅. 상호작용 밀도가 높다.
- (B) **공개 폼** (`/p/<shortId>`) — 익명 응답자가 여는 콘텐츠형 페이지. SEO, 빠른 초기 로딩, 접근성, 브라우저 자동완성이 중요.

**선택**:
- (A)는 **Flutter Web + Desktop**. 
- (B)는 **Jaspr(SSR/SSG) 경량 HTML**.
- 두 앱은 **순수 Dart `form_factor` 패키지**를 공유하여 Form Factor 해석 로직 중복을 제거.

**근거**:
- Flutter Web은 CanvasKit 기반이라 공개 폼에 부적합(번들 2~3MB, DOM 텍스트 부재 → SEO 불가, 스크린리더/자동완성 취약, 초기 로딩 지연). 그러나 앱형 에디터에는 위젯 생태계·상태관리·DnD 지원이 탁월.
- Jaspr는 Dart→실제 DOM(HTML/CSS) + SSR/SSG를 제공 → 공개 폼에 이상적. 하지만 무거운 에디터를 CSS로 직접 짜야 해 (A)에는 부적합.
- 두 프레임워크 모두 Dart이므로 도메인 모델을 **언어 차원에서 공유** → 기존 "BlockRenderer(빌더) vs FormViewer(뷰어) 로직 중복" 결함을 구조적으로 방지.

**기각안**:
- *전부 Flutter Web*: 공개 폼 SEO/로딩/접근성 퇴보. 응답 수집률에 직접 악영향.
- *전부 Jaspr*: 데스크톱/모바일 포기, 무거운 에디터 UI를 수작업 CSS로 구현하는 비용 과다.

---

## ADR-2. 백엔드: Supabase

**선택**: Supabase (Postgres + Auth + Storage + Edge Functions + Row Level Security).

**매핑**:
| 기존 (Next.js) | 신규 (Supabase) |
| --- | --- |
| NextAuth OAuth | Supabase Auth (Google OAuth) |
| Prisma + SQLite/PG | Supabase Postgres |
| `/api/forms/*` REST | `forms` 테이블 + RLS (SDK 직접 접근) |
| `/api/ai/generate` 프록시 | `llm-proxy` Edge Function (provider-aware) |
| `/api/p/[shortId]` 공개 조회 | `deployments`/`forms` 공개 읽기 RLS + RPC |
| `/api/.../responses` | `responses` 테이블 + anon insert RLS |
| `UserSecret`(암호화 키) | `user_secrets` + **Supabase Vault** |

**근거**: 운영/서버 유지보수 최소화, 무료 티어로 zero-cost 배포 목표 충족, RLS로 인가를 DB 레벨에서 강제(기존의 흩어진 소유권 체크 결함 개선), Flutter/Dart SDK 성숙.

**기각안**:
- *Serverpod*: '완전한 Dart'엔 가장 부합하나 서버 운영·러닝커브 부담이 인디 규모에 과함.
- *기존 Next.js 백엔드 유지*: TS 백엔드가 남아 '완전 전환'이 아니고, 두 런타임(Dart 앱 + Node 서버) 유지 부담.
- *Firebase*: Firestore 문서모델이 Form Factor(불투명 JSON blob) 저장엔 무난하나, 응답 집계·RLS 정교함·SQL 쿼리 측면에서 Postgres(Supabase)가 우위.

---

## ADR-3. 목표 플랫폼: Web + Desktop (모바일은 추후)

**선택**: Flutter 단일 코드베이스로 **Web + Desktop(macOS/Windows)** 동시 타깃. 모바일은 코드 호환은 유지하되 UI 최적화는 후순위.

**근거**: 기존 Tauri 데스크톱 지향 계승. Flutter가 Tauri 대비 단일 언어·단일 UI로 웹·데스크톱을 모두 커버 → 별도 Rust 계층 불필요.

**영향**: 데스크톱은 로컬 파일(`.formia`) 저장 어댑터를 별도 구현(=기존 TauriFileRepository의 대체). Port 설계 덕에 웹(Supabase)과 데스크톱(파일)이 동일 인터페이스로 교체 가능.

---

## ADR-4. 상태관리: Riverpod 2 (plain, 코드젠 아님 — 하우스 스타일 정렬)

**선택**: `flutter_riverpod ^2.6` (**plain**, `riverpod_generator` 미사용). 사용자의 활발한 프로젝트 `zelly_flutter`의 하우스 스타일과 일치시킨다.

**근거**:
- 기존 최대 결함인 **God-Store**를 해체하려면 관심사별로 잘게 나뉜 상태 단위 + 명시적 의존성 주입이 필요. Riverpod은 provider 단위 분리와 DI(Port 주입)를 자연스럽게 제공.
- 테스트에서 provider override로 Repository/AgentPort를 가짜 구현으로 교체 가능 → 기존 "스토어가 repository를 직접 new" 결함 해소.
- **zelly_flutter가 plain Riverpod을 쓰므로 동일 컨벤션 유지**(코드젠 도입 시 사용자 학습·빌드 복잡도만 증가). `NotifierProvider`/`AsyncNotifierProvider` 수동 정의.
- `AsyncValue`로 로딩/에러 상태를 일급으로 다룸(기존 `saveStatus`/`isLoading*` 난립 정리).

**기각안**: *Bloc* — 보일러플레이트 과다. *Riverpod code-gen* — 하우스 스타일과 불일치.

---

## ADR-5. 편집 이력: 진짜 Command 패턴 (스냅샷 스택 폐기)

**배경**: 기존 문서는 Command 패턴(execute/undo, inverse patch, author/timestamp, checkpoint)을 명시했으나 실제 코드는 `FormFactor[]` 전체 deep-clone 스택이었고 `PatchCommand`는 미사용 죽은 코드였다.

**선택**: 로컬 편집은 **타입 명령(`FormCommand`)** 으로 표현. 각 명령은 `apply(doc) → doc'` 와 역연산을 위한 정보를 가지며, `HistoryStack`이 undo/redo와 메타데이터(author: human|ai, timestamp, description)를 관리.

- 로컬 사용자 편집: 타입 모델을 직접 변형하는 명령(불변 업데이트).
- **AI도 동일한 명령을 툴로 실행**: 한 턴의 여러 툴콜을 원자적 `AiTurnCommand`로 묶어 동일 이력 파이프라인에 통합(리뷰/수락/거절·단일 undo). **RFC6902 JSON Patch 경로는 폐기**(→ 01 §5, 07).

**근거**: 전체 스냅샷 deep-clone은 메모리·성능 낭비이며 "무엇이 바뀌었는지" 정보를 잃는다. 명령 기반은 세밀한 undo, 변경 요약, 체크포인트, 협업 확장(추후 CRDT)로 가는 토대.

---

## ADR-6. 모노레포 구조 (Melos)

```
formia/                           # Melos 8 + pub workspaces (Dart 3.12 native)
├── pubspec.yaml                  # workspace: 목록 + melos: 설정(키). ⚠️ Melos 8은 melos.yaml 제거됨
├── packages/
│   ├── form_factor/              # [순수 Dart] 도메인 모델·스키마·검증·마이그레이션·명령·로직 평가
│   │                             #   Flutter/Jaspr/네트워크/DB 의존 금지. Result<T> 반환.
│   ├── formia_data/              # [Dart] Port 인터페이스 + Supabase 구현 + DTO 매핑
│   │                             #   (FormRepository, AgentPort, ResponseRepository ...) → Result<T>
│   ├── formia_core/              # [Dart] 공유 Result<T> 등 유틸(zelly result.dart 상당)
│   └── formia_ui_kit/            # [Flutter] 공유 위젯·디자인 토큰(선택, 필요 시)
├── apps/
│   ├── editor/                   # [Flutter web+desktop] 빌더·대시보드·AI 패널
│   └── public_form/              # [Jaspr] 공개 폼 SSR + 응답 제출
├── supabase/
│   ├── migrations/               # SQL 마이그레이션
│   ├── functions/llm-proxy/      # provider-aware AI 키주입 게이트웨이 (Deno/TS)
│   ├── functions/submit-response/ # 공개 폼 응답 제출(레이트리밋·크기·봇차단)
│   └── config.toml
└── docs/flutter_migration/       # 본 설계 문서
```

**의존 규칙 (강제)**:
- `form_factor` → 아무것도 의존하지 않음(순수 Dart, `dart:core`·`meta`·`collection` 수준만).
- `formia_data` → `form_factor` 의존 가능. 앱(UI)을 의존하지 않음.
- `apps/editor` → `form_factor`, `formia_data`, `formia_ui_kit` 의존.
- `apps/public_form` → `form_factor`(+ 응답 제출용 최소 data) 의존. 에디터 코드 의존 금지.
- **UI 패키지가 `supabase` 클라이언트를 직접 import 금지** — 반드시 `formia_data`의 Port 경유.

이 규칙은 기존 "에디터가 repository/fetch를 직접 호출"하는 결함을 패키지 경계로 물리적으로 차단한다.

---

## ADR-7. AI: 대화형 에이전트 (클라이언트 오케스트레이션 + 서버 키 프록시)

**배경**: 기존 AI는 단발 프롬프트→패치 1회(`generateObject`). 요즘 트렌드(툴콜링·다중턴·스트리밍 에이전트)에 맞춰 "대화하며 함께 폼을 만드는" 에이전트로 격상.

**선택**: **`dartantic_ai`(순수 Dart)로 에이전트 루프를 Flutter 클라이언트에서 구동**, LLM 호출만 **Supabase Edge Function `llm-proxy`(provider-aware 키주입·검증 게이트)** 로 우회. **툴 = FormCommand**(공유 `form_factor` 재사용, RFC6902 폐기). 게스트 키는 provider 직결. 루프 위치는 `AgentPort`로 추상화해 추후 서버(Dart Frog/Cloud Run) 승격 가능.

**근거**: (1) 툴이 도메인 명령과 동일 → TS/zod 스키마 중복 제거·즉시 undo 통합, (2) 키는 서버에만 존재(보안), (3) 별도 에이전트 백엔드 불필요(최소 인프라), (4) 클라이언트 루프라 캔버스 즉시 반영·스트리밍 자연스러움.

**기각안**: *Google ADK* — 상시 백엔드 서비스+외부 상태저장소 필수, Python/Google Cloud 지향으로 Dart 스택에 이질·과함. *Vercel AI SDK(서버 루프)* — 검증됐으나 툴 스키마를 TS에서 재정의(중복). 필요 시 서버 승격 대안으로만 보류.

> 상세: [07-ai-agent.md](07-ai-agent.md)

---

## ADR-8. 하우스 스타일 정렬 (zelly_flutter 컨벤션 채택)

**배경**: 사용자의 활발한 Flutter 프로젝트 `/Users/paul/projects/zelly_flutter`(Flutter 3.44, Dart 3.12)가 **Flutter 공식 권장(Compass) 아키텍처**를 따른다. 신규 코드가 익숙한 패턴이 되도록 Formia도 동일 컨벤션을 채택한다.

| 관심사 | zelly 컨벤션 → Formia 채택 | 비고 |
| --- | --- | --- |
| 상태관리 | `flutter_riverpod ^2.6` **plain**(코드젠 X) | ADR-4 |
| 라우팅 | `go_router` | 동일 |
| 직렬화 | `json_serializable` + `build_runner` + **Dart3 sealed class** | **freezed 미사용** — sealed로 대체 |
| 에러 처리 | **`Result<T>`**(`sealed Result` = `Ok`/`Error`) | 모든 Repository/Port는 `Result<T>` 반환 |
| HTTP | `dio`(+cookie manager) | Supabase는 자체 SDK, 그 외 HTTP는 dio |
| 로컬 저장 | `hive` / `shared_preferences` / `flutter_secure_storage` | 게스트 draft·데스크톱·BYOK 키 |
| 관측성 | `sentry_flutter`(+dart_plugin) | 리뷰의 observability 요구 충족 |
| 린트 | `flutter_lints` + `custom_lint`(로컬 `packages/formia_lint` 선택) | very_good 아님 |
| 테스트 | `mocktail`, `fake_async`, `checks`, `golden_toolkit`, `patrol` | 하우스 테스트 스택 |
| 모노레포 | **Melos 8 + pub workspaces**(Dart 3.12 native) | zelly는 `packages/` path 의존 사용 |

**영향(문서 갱신)**: 01(freezed→json_serializable+sealed), 02(Port가 `Result<T>` 반환, 폴더 naming, 로컬 저장 구체화), 08(pubspec 의존 정렬).

**주의**: zelly는 백엔드가 MongoDB/커스텀 Dio(Supabase 아님)다. Formia는 ADR-2대로 **Supabase 유지**(사용자 확정) — 단 Flutter *클라이언트* 컨벤션(Result·Riverpod·구조)은 zelly와 통일한다.
