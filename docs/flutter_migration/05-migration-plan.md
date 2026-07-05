# 05 — 단계별 전환 계획

기존 Next.js/React Formia → Flutter+Jaspr+Supabase 완전 전환. 각 Phase는 **독립적으로 검증 가능한 산출물**과 완료 기준(DoD)을 갖는다. 코드는 06 문서의 분업 프로토콜에 따라 Sonnet이 구현한다.

> 전략: **스트랭글러(Strangler) 방식이 아니라 병렬 신규 구축**. 레거시(`src/`, `prisma/`, Next.js)는 새 스택이 기능 동등에 도달할 때까지 참조용으로만 유지하고, Phase 7에서 제거한다. 기존 코드를 조금씩 고치지 않는다(결함 있는 God-Store를 이식하면 결함이 따라온다).

---

## Phase 0 — 스캐폴딩 + **리스크 수직 스파이크** (리뷰 반영)
**목표**: 모노레포 골격 + **가장 위험한 두 가지 기술 전제를 착수 전에 검증**. 리뷰가 지적한 "Jaspr는 마지막(Phase 6)에야 검증됨 / AI 스트리밍 툴콜 미검증" 리스크를 앞으로 당긴다.
- Melos 워크스페이스 생성(00 §ADR-6). `packages/form_factor`, `packages/formia_data`, `apps/editor`(Flutter), `apps/public_form`(Jaspr) 스켈레톤.
- 린트(`very_good_analysis`), 포맷, `melos run analyze/test`, CI(GitHub Actions).
- **스파이크 A — Jaspr 공개 렌더**: 하드코딩된 간단 폼 하나를 Jaspr SSR로 렌더 + 응답 제출 1건 + **Lighthouse(SEO/성능/접근성) 측정**. ADR-1(Flutter+Jaspr 분리)의 전제 검증.
- **스파이크 B — AI 스트리밍 툴콜**: dartantic_ai로 **실제 Gemini native function-calling + 스트리밍** 1회 왕복 성공(툴 1개가 폼 요약 반환). 07 §2의 핵심 리스크 검증.
- **DoD**: `melos bootstrap && melos run analyze` 통과. **스파이크 A/B 모두 실제 동작 확인**(둘 중 하나라도 실패 시 → 해당 ADR 재검토 후 진행). 각 앱이 빈 화면으로 실행됨.

## Phase 1 — 도메인: `form_factor` (v3) ⭐가장 중요
**목표**: 순수 Dart 도메인 모델 완성. UI/백엔드보다 **먼저**.
- 모델(FormFactor/Page/Block sealed/Logic) + freezed/json 직렬화(01 문서).
- 페이지 불변식 + `FormFactorValidator`(+ **그래프 도달성/종료성** 01 §3.1).
- `FormCommand` 계열 + `AiTurnCommand`(원자적) + `HistoryStack`(02 §3).
- `LogicEvaluator`(분기/표시).
- **v2→v3 `FormFactorMigrator`** — **무손실**(01 §4.1): 미매핑 필드 격리/경고, 실데이터 라운드트립.
- i18n: 시스템 메시지는 **메시지 키+파라미터**로 반환(문구는 UI 소유, 01 §7).
- **DoD**: 단위 테스트 통과(마이그레이션 **무손실**·불변식·**그래프 정합**·명령 undo/redo·**AiTurnCommand 단일 undo**·로직 평가). UI/네트워크 의존 0. (RFC6902 경로 없음 — 01 §5)

## Phase 2 — Supabase 백엔드 프로비저닝
**목표**: DB·인증·RLS·Edge Function 동작.
- 스키마/RLS/RPC 마이그레이션(03 문서). 로컬 `supabase start`로 개발.
- Google OAuth 설정.
- `llm-proxy` Edge Function(**provider-aware** 키주입·검증 게이트, 07 문서) + 로그인(Vault)/서버기본키 경로 + 모델 allowlist·쿼터. `submit-response` Edge(레이트리밋·크기·봇차단).
- **DoD**: SQL 테스트로 RLS 검증(소유자만 read/write, anon 응답은 `submit-response` 경유만). 프록시가 provider native 스트림 중계 + 키 비노출 + 쿼터/allowlist 동작 확인. 하드코딩 시크릿 폴백 없음 확인.

## Phase 3 — 데이터 레이어: `formia_data` (Ports + 구현)
**목표**: 앱이 백엔드와 대화하는 계약과 구현.
- Port 인터페이스(`FormRepository`/`AgentPort`/`ResponseRepository`) + DTO 매핑.
- `SupabaseFormRepository`, `ClientDartanticAgent`, `SupabaseResponseRepository`.
- 게스트 `LocalDraftRepository`(웹 IndexedDB), 데스크톱 `DesktopFileRepository`(.formia), `HybridRepository`.
- **DoD**: 로컬 Supabase 대상 통합 테스트(생성/저장/로드/목록/삭제, 응답 제출, AI 호출). Port는 form_factor만 의존.

## Phase 4 — 에디터 앱 핵심 (Flutter)
**목표**: 로그인→대시보드→빌더로 폼을 만들고 저장하는 최소 루프.
- `authController`, 라우팅(go_router), 대시보드(목록/생성/삭제/가져오기/내보내기).
- 빌더 캔버스: 페이지 네비, 블록 추가/편집/삭제/재정렬(DnD), 인라인 편집 → `FormDocumentController.execute(command)`.
- `persistenceController`(디바운스 저장, saveStatus), 게스트 복원 프롬프트.
- undo/redo, 뷰포트 토글, 라이브 프리뷰(`BlockView(mode: preview)`).
- **i18n 셋업**: Flutter `intl`/ARB, 기본 로케일 `ko`. 도메인 메시지 키 → 로케일 문구 렌더(01 §7).
- **DoD**: 로그인 사용자가 폼 생성·편집·새로고침 후 지속·undo/redo 동작. 게스트 로컬 저장+복원 프롬프트 동작. God-Store 없음(provider 분리 확인).

## Phase 5 — 에이전틱 AI 폼 빌더 (Flutter, → 07 문서)
**목표**: 단발 생성기가 아니라 **대화형·툴콜링·스트리밍 에이전트**.
- `packages/formia_data`: `AgentPort` + `ClientDartanticAgent`(dartantic_ai) + **툴↔FormCommand 브리지**(툴 카탈로그 07 §4).
- `agentController`: `AgentEvent` 스트림 소비(텍스트/툴콜/툴결과), 스트리밍 채팅 UI, 인라인 툴 결과 카드, 명료화 질문.
- 원자적 턴: 한 턴의 툴콜들을 `AiTurnCommand`(단일 undo)로, 턴 진행 중 캔버스 잠금(07 §5.1).
- 적용 모드: **Propose(기본)** — 배치 제안→`aiReviewController` diff 리뷰→수락 시 커밋. Live(즉시 반영)는 후속.
- BYOK 키 설정 UI(로그인=Vault 저장→`llm-proxy`, 게스트=provider 직결).
- **DoD**: 자연어 다중 턴 대화로 폼 생성(툴 연쇄→`AiTurnCommand` 단일 undo). 명료화 질문·턴 잠금 동작. 로그인 키가 클라이언트에 노출되지 않음. 채팅 휘발성 정책 동작.

## Phase 6 — 공개 폼 렌더러 (Jaspr) · 배포 · 응답 Export/분석
**목표**: 배포·공개 응답 수집·**열람/내보내기/분석** end-to-end.
- 배포(publish) 기능(에디터) + `deployments` upsert.
- Jaspr 공개 앱: SSR 렌더, 분기/검증, `submit-response` 제출, 파일 업로드, 종료 페이지(04 문서).
- **응답 대시보드 + CSV/XLSX Export + 기본 분석**(완료율·분포·이탈, → 03 §6). 폼 제품의 핵심이므로 이 Phase에 포함.
- 무료 티어 호스팅 배포.
- **DoD**: 에디터에서 배포→공개 URL 접속→응답 제출→소유자 대시보드에서 응답 확인/CSV 내보내기/기본 집계 확인. Lighthouse로 공개 폼 SEO/성능/접근성 기준 확인.

## Phase 7 — 레거시 데이터 이관 · 컷오버 · 정리
**목표**: 전환 완료.
- v2→v3 일회성 이관 스크립트로 기존 폼 데이터 적재(03 §6).
- 데스크톱 빌드(macOS/Windows) 산출·서명.
- 기능 동등성 체크리스트 통과 후 **레거시 제거**: `src/`, `prisma/`, `next.config.mjs`, `src-tauri/`, Next 관련 의존/스크립트. 레거시 `docs/*`(구 설계) 폐기, 본 폴더를 정식 `docs/`로 승격.
- README/온보딩 갱신.
- **DoD**: 레거시 코드 삭제 후에도 전 기능 동작. 문서=코드 일치 점검.

---

## 레거시 → 신규 매핑 (참조표)

| 레거시 | 신규 | 비고 |
| --- | --- | --- |
| `src/lib/core/schema.ts` (zod) | `packages/form_factor` 모델 v3 | 스키마 재설계(01) |
| `src/lib/core/commands.ts` (죽은 코드) | `FormCommand` 계열 | 진짜 구현 |
| `src/store/useFormStore.ts` (God-Store) | 다수 Riverpod provider | 관심사 분리(02 §2) |
| `src/lib/infrastructure/*Repository.ts` | `formia_data` 구현체 | Port 유지, 백엔드만 교체 |
| `src/lib/ai/*`, `/api/ai/generate` | `AgentPort`(dartantic) + `llm-proxy` | 단발 → 에이전틱, 툴=Command |
| `prisma/schema.prisma` + `/api/*` | Supabase 스키마 + RLS + RPC | 인가를 DB로 |
| `src/components/builder/BlockRenderer.tsx` | `BlockView(mode: edit)` | 뷰어와 통합 |
| `src/components/viewer/FormViewer.tsx` | `BlockView(mode: preview)` + Jaspr 공개 렌더 | 중복 제거 |
| `src/app/p/[id]`, `/api/p/[shortId]` | `apps/public_form` + `get_public_form` RPC | 경량 HTML |
| `src-tauri/` | Flutter desktop 타깃 | Rust 계층 제거 |

## 리스크 & 완화
- **AI 스트리밍 툴콜(최대 리스크)**: Gemini native 사용(OpenAI-호환 스트리밍 버그 회피, 07 §2), **Phase 0 스파이크 B로 착수 전 검증**. 실패 시 서버 루프/Vercel AI SDK로 폴백(AgentPort).
- **Jaspr 성숙도**: ADR-1의 전제. **Phase 0 스파이크 A로 SSR+Lighthouse 선검증**. 실패 시 대안(서버 템플릿 렌더) 재검토.
- **역량 vs 야심 불균형(리뷰 지적)**: 소유자가 React 미숙 + Dart/Flutter/Jaspr 신규. 완화: (1) Phase 0 스파이크로 최대 리스크 선검증, (2) **스코프 우선 축소** — AI는 Propose 모드만 먼저, 서버 루프 machinery·추적 연동은 후속, (3) 06의 좁은 작업 단위 + 명확 DoD로 Sonnet 통제. 판단이 필요한 실패(RLS 과차단, 하이드레이션 깨짐 등)는 Opus 리뷰 게이트로 흡수.
- **Flutter Web 한글 렌더·번들 크기**: 에디터는 앱이라 허용범위(스플래시/지연 로드). 공개 폼은 Jaspr라 무관. **에디터 자체 접근성/SEO는 CanvasKit 한계를 감수**(로그인 앱이므로 방어 가능한 트레이드오프).
- **데스크톱 OAuth 리다이렉트**: PKCE + 로컬 리다이렉트/딥링크 사전 검증(Phase 3).
- **v2→v3 마이그레이션 손실**: **무손실 보장**(01 §4.1) — 실데이터 라운드트립 + 미매핑 필드 격리.
- **관측성**: 에이전트/RLS 실패를 운영에서 추적(Sentry 등 구조화 로그, 단 **키·요청바디 미로깅** 준수).
- **Supabase 종속·무료티어 한계**: 03 §5 명시. 응답량 증가 시 유료 임계 사전 파악.
