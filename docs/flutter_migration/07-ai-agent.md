# 07 — 에이전틱 AI 폼 빌더 (대화형 에이전트)

기존 AI는 **한 번의 명령 → 한 번의 JSON Patch** 였다(`/api/ai/generate`, `generateObject` 단발). v3에서는 **다중 턴 대화 + 툴콜링 + 스트리밍**으로 동작하는 진짜 에이전트로 업그레이드한다. 사용자는 에이전트와 대화하며 주제를 잡고, 에이전트가 스스로 도구를 연쇄 호출해 폼을 만들어간다.

## 0. 목표 (기존 대비)

| 기존 | v3 (에이전틱) |
| --- | --- |
| 단발 프롬프트 → 패치 1묶음 | 다중 턴 대화, 맥락 유지 |
| 에이전트가 되묻지 못함 | **명료화 질문**(clarifying question) 가능 |
| 구조화 출력 1회 | **툴 연쇄 호출**(multi-step tool loop) |
| 응답 후 종료 | 스트리밍 + 인라인 생성 UI(추가된 블록 카드 등) |
| 서버가 스키마 zod 중복 정의 | **툴 = FormCommand**, 공유 `form_factor` 재사용(중복 제거) |

## 1. 프레임워크 조사 결과 (2026)

| 후보 | 언어/런타임 | 적합성 | 판단 |
| --- | --- | --- | --- |
| **Google ADK** | Python/TS/Go/Java, Cloud Run/GKE 필요 | 강력한 멀티에이전트지만 **별도 백엔드 서비스 + 외부 상태저장소 필수**, Google Cloud 지향, Python 우선 → Dart 스택과 이질적 | ❌ 과함. 인디 규모·Dart 중심에 부적합 |
| **Vercel AI SDK 6** | TS/Deno, Supabase Edge 검증됨 | 에이전틱 루프(`stopWhen`/`stepCountIs`), 스트리밍, 멀티프로바이더. 이미 레거시에 존재. 단 툴 스키마를 **TS에서 재정의**해야 함(Dart 모델과 중복) | △ 서버 루프 대안 |
| **dartantic_ai** | **순수 Dart, 클라이언트+서버, 풀 웹 지원** | 멀티스텝 툴콜링, `Agent.runStream` 스트리밍, 커스텀 base URL/프록시, OpenAI/Google/Anthropic 지원. **`form_factor`를 직접 import → 툴=FormCommand, 스키마 중복 0** | ✅ 채택 |
| langchain_dart | Dart | dartantic의 하부. 저수준 필요 시 활용 | 보조 |

> 출처: [dartantic_ai](https://pub.dev/packages/dartantic_ai), [Dartantic Docs](https://docs.dartantic.ai/), [Vercel AI SDK 6](https://vercel.com/blog/ai-sdk-6), [Google ADK](https://adk.dev/), [ADK 아키텍처](https://thenewstack.io/what-is-googles-agent-development-kit-an-architectural-tour/)

## 2. 아키텍처 결정 — 클라이언트 오케스트레이션 + 서버 키 프록시

**핵심 통찰**: 에이전트 루프(오케스트레이션·툴 실행)를 **Flutter 클라이언트(Dart)** 에서 돌리고, LLM 호출만 **키 주입 프록시(Supabase Edge Function)** 로 우회시킨다.

```
[Flutter 에디터]                          [Supabase Edge: llm-proxy (provider-aware)]     [LLM Provider]
  dartantic Agent (루프)
   ├─ 시스템프롬프트 + 대화 + 툴정의
   ├─ 모델 호출 ──(키 없음)──▶ ① 모델 allowlist·컨텍스트/툴 상한·쿼터 검증
   │                          ② 키 주입(로그인=Vault) + provider별 native 포맷 변환
   │                     ◀── 스트림/툴콜 요청 ◀── ③ provider native function-calling 호출
   ├─ 툴 실행 = FormCommand  (form_factor 공유, 로컬 반영)
   ├─ 툴 결과(새 폼 요약) 를 모델에 되먹임
   └─ 텍스트 응답(명료화 질문/요약) → 채팅 UI 스트리밍
```

**왜 이 구조인가**
- **툴 = FormCommand**: 에이전트 도구가 사람이 쓰는 것과 동일한 명령 시스템을 구동 → `form_factor` 재사용, 스키마 중복 제거(기존 결함 해소), undo 통합. **AI 쓰기 경로는 이 툴이 유일**(RFC6902 JSON Patch 경로 폐기 — 01 §5 참조).
- **보안**: API 키는 **오직 서버**에만 존재(로그인 사용자). **게스트 BYOK 키는 프록시를 거치지 않고 클라이언트가 provider로 직결**(→ §6) — 게스트 키가 우리 인프라를 통과하지 않게 함.
- **최소 인프라**: 별도 상시 에이전트 서버 불필요. ADK류 회피.
- **UX**: 클라이언트 루프라 툴 결과를 캔버스에 즉시 반영·스트리밍(인라인 생성 UI).

> **⚠️ provider-aware 프록시 (dumb passthrough 아님)**: 초기 설계는 "OpenAI 호환 패스스루"였으나, **Gemini의 OpenAI 호환 엔드포인트는 스트리밍+툴콜 동시 사용 시 알려진 버그**가 있다([근거](https://discuss.ai.google.dev/t/gemini-openai-compatibility-issue-with-tool-call-streaming/59886)). 따라서 프록시는 provider별 **native function-calling API**(Gemini native, OpenAI, Anthropic)로 변환·호출한다. dartantic는 provider별 native 구현을 제공하므로, 프록시는 dartantic가 만든 요청을 받아 키를 주입하고 해당 provider native 엔드포인트로 포워딩한다. "얇으니 안전"이 아니라 **적대적 클라이언트를 가정하고 검증하는** 게이트웨이다(§6).

## 3. AgentPort 추상화 (루프 위치 교체 가능)

루프를 클라이언트에 두되, 인터페이스로 감싸 **추후 서버(Dart Frog/Cloud Run)로 승격** 가능하게 한다. 지속형 장시간 에이전트(AI SDK 6 Workflows류)나 서버측 메모리가 필요해지면 구현만 교체.

```dart
// packages/formia_data
abstract interface class AgentPort {
  Stream<AgentEvent> run(AgentTurn turn);   // 스트리밍: 텍스트/툴콜/툴결과/완료
  bool get isAvailable;
}
// 구현: ClientDartanticAgent (기본), 추후 ServerAgentPort(원격 루프)
```

`AgentEvent` = `TextDelta | ToolCallStarted | ToolCallResult | ClarifyingQuestion | TurnComplete`. UI(`agentController`)는 이 이벤트 스트림만 소비 → 루프가 클라이언트든 서버든 UI 불변.

## 4. 툴 카탈로그 (에이전트가 쓰는 도구)

툴 인자는 `form_factor` 모델로 검증된다. 각 쓰기 툴은 대응 `FormCommand`를 이력에 넣는다(author=ai).

**쓰기 툴 (mutation)**
- `add_page(role, title?)` / `remove_page(pageId)` / `reorder_page(pageId, toIndex)`
- `add_block(pageId, type, content)` / `update_block(blockId, content)` / `remove_block(blockId)` / `move_block(blockId, toPageId, toIndex)`
- `set_theme(tokens|mode)`
- `add_logic_rule(when, then)` / `remove_logic_rule(ruleId)`  ← 분기까지 대화로 구성
- `set_metadata(title|description)` / `set_settings(...)`

**읽기 툴 (관찰)**
- `get_form_summary()` — 현재 폼 구조 요약(페이지/블록/로직) 반환. 루프 중 상태 재확인용.

> 각 툴 스키마는 `form_factor`의 타입에서 파생. 잠긴 페이지/블록(start·primary-ending) 보호는 `FormCommand`/검증기가 강제하므로 에이전트가 파괴적 동작을 못 한다.

## 5. 대화·적용 모델 & 턴 의미론(turn semantics)

- **다중 턴**: 대화 히스토리 + 현재 FormFactor 요약을 매 턴 컨텍스트로 제공. 에이전트는 텍스트(명료화 질문/설명) 또는 툴콜을 반환.
- **명료화 질문**: 요구가 모호하면(예: "설문 만들어줘") 에이전트가 목적·대상·문항 수 등을 되물어 주제를 잡는다(2026 대화형 UX 트렌드).

### 5.1 원자적 턴 + 동시성 (correctness — 리뷰 반영)
멀티 툴 루프 도중 사용자가 동시에 손편집/undo 하면 상태가 꼬인다. 다음을 강제한다:
- **에이전트 턴 진행 중 캔버스 손편집 잠금**(read-only 오버레이 + "에이전트 작업 중" 표시). 취소 버튼으로 턴 중단 가능.
- **낙관적 동시성**: 각 툴콜은 시작 시점의 문서 `version`을 확인. 손편집으로 version이 바뀌었으면 툴 실행 실패 → 에이전트에 재관찰(`get_form_summary`) 유도.
- **한 턴 = 하나의 undo 단위**: 한 번의 에이전트 응답에서 실행된 N개 툴콜은 **`AiTurnCommand` 하나**로 이력에 쌓인다. 사용자 undo 1회가 그 턴 전체를 되돌린다(15개 흩어진 변경을 각각 되돌리는 나쁜 UX 방지).
- **체인 중 실패**: 툴 하나가 검증에 실패하면 그 턴은 **전부 롤백**(부분 완성 폼 방지) 후 에이전트에 오류를 되먹여 재시도하게 한다.

### 5.2 적용 모드
- **Propose 모드(기본)**: 턴의 변경을 **적용 전 diff로 리뷰**(수락/거절), 수락 시 `AiTurnCommand`로 커밋. 기존 `aiReviewController`와 통합(→ 02 §3). 폼 빌더에서 안전한 기본값.
- **Live 모드(옵션, 후속)**: 툴콜을 즉시 반영(여전히 §5.1 원자적 턴·잠금 규칙 적용). Propose가 안정화된 뒤 도입.
- **휘발성/영속성**: 채팅은 기본 휘발성(로그인 시 Supabase `chat_sessions`에 선택 저장). FormFactor 변경만 영속.

## 6. 보안·비용 가드 (llm-proxy Edge Function) — 적대적 클라이언트 가정

클라이언트가 모델·툴·전체 히스토리를 보내므로, 검증 없는 패스스루는 **서버 키를 무료 범용 LLM 게이트웨이로 악용**당하는 예산 유출 벡터다. 프록시는 **요청마다 다음을 강제**한다:
- **모델 allowlist**: 허용된 모델 ID만(임의 모델·비용 큰 모델 차단).
- **컨텍스트/툴 상한**: 최대 메시지 크기·토큰 추정·툴 개수 상한 초과 시 거절.
- **사용자별 쿼터**: 요청 전 카운터 테이블로 일일 호출/토큰 한도 확인, 초과 시 429. 서버 기본키에는 **월 비용 상한** 하드캡.
- **키 처리**: 로그인=Vault 복호화(서버 내부). **게스트=프록시 미경유**(클라이언트가 자기 키로 provider 직결 → 게스트 키가 우리 서버·로그를 통과하지 않음). 서버 기본키는 env. **하드코딩 폴백 시크릿 없음.**
- **로깅**: 요청 **바디를 로그에 남기지 않음**(구조화 로그 allowlist만). 키·프롬프트 유출 지점(특히 에러 경로) 원천 차단.
- **스트리밍(SSE)**: provider native 스트림을 중계하되 위 검증을 통과한 요청만.

## 7. 의존성 리스크 관리 (dartantic_ai)
- dartantic_ai는 실체 있고 웹 지원이 확인됐으나 **버전이 어리고(0.x~2.x) 소수 유지보수** 의존성이다. **버전 핀 고정** + 얇은 래퍼(`ClientDartanticAgent`)로 감싸 교체 지점을 좁힌다.
- **폴백 플랜**: `AgentPort` 뒤 구현을 **서버 루프(Dart Frog/Cloud Run) 또는 Vercel AI SDK 6 서버 에이전트**로 교체 가능하게 유지(§3). 단, 서버 루프 machinery는 **지금 만들지 않는다**(YAGNI). 시임만 남긴다.
- **Phase 0 스파이크로 사전 검증**(→ 05 Phase 0): 실제 Gemini native 툴콜 + 스트리밍을 dartantic로 1회 왕복 성공시키는 것을 착수 전제로 둔다.

## 8. 구현 매핑 (Phase 5)

- `packages/formia_data`: `AgentPort` + `ClientDartanticAgent`(dartantic_ai) + 툴↔FormCommand 브리지 + `AiTurnCommand`(원자적 턴).
- `supabase/functions/llm-proxy`: **provider-aware** 키주입·검증 게이트웨이(기존 `ai-generate`를 대체·개명). Gemini/OpenAI/Anthropic native.
- `apps/editor/features/ai_panel`: `agentController`(AgentEvent 스트림 소비), 스트리밍 채팅 UI, 인라인 툴 결과 카드, 턴 진행 중 캔버스 잠금, Propose 리뷰(Live는 후속), BYOK 키 설정.
- 테스트: 가짜 `AgentPort`로 툴 연쇄→`AiTurnCommand`→단일 undo 검증. 프록시 모델 allowlist·쿼터·키 비노출 검증.

> 이 설계는 "Dart 중심 스택 + Supabase 최소 인프라 + BYOK 보안"을 지키면서, 단발 생성기를 **대화형·툴콜링·스트리밍 에이전트**로 끌어올린다. 루프는 필요 시 서버로 승격 가능(AgentPort).
