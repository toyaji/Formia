# Architecture Design: Formia

## 1. 핵심 레이어 분리 원칙

Formia의 아키텍처는 **두 개의 독립적인 레이어**로 구성됩니다:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Formia Architecture Layers                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐     │
│   │           🎨 Editor Layer (코어는 오프라인 독립)               │     │
│   │                                                               │     │
│   │   ┌──────────┐   ┌──────────┐   ┌──────────┐                │     │
│   │   │ Canvas   │   │ AI Agent │   │ Block    │                │     │
│   │   │ Editor   │   │ Panel    │   │ Renderer │                │     │
│   │   └────┬─────┘   └────┬─────┘   └────┬─────┘                │     │
│   │        │              │              │                       │     │
│   │        └──────┬───────┘──────────────┘                       │     │
│   │               │                                               │     │
│   │      ┌────────▼────────┐                                      │     │
│   │      │  Form Factor    │  ← JSON (메모리 내 상태)             │     │
│   │      │  Store (Zustand)│  ← 오프라인에서도 동작               │     │
│   │      └────────┬────────┘                                      │     │
│   │               │                                               │     │
│   │      ┌────────▼────────┐                                      │     │
│   │      │  History/Undo   │  ← Command Pattern                  │     │
│   │      │  (In-Memory)    │  ← DB 불필요                       │     │
│   │      └─────────────────┘                                      │     │
│   │                                                               │     │
│   │   ⚡ 코어 편집 (캔버스, 블록, Undo/Redo)은 오프라인 독립      │     │
│   └───────────────────┬───────────────────┬───────────────────┘     │
│                       │                   │                          │
│              ┌────────▼───────┐  ┌────────▼────────┐                │
│              │ File I/O Port  │  │   AI Port       │                │
│              │ save() / load()│  │ generatePatch() │                │
│              └────────┬───────┘  └────────┬────────┘                │
│                       │                   │                          │
│    ┌──────────────────┼────────┐  ┌─────────────────────────────────┐     │
│    │           │              │  │                                 │     │
│  ┌─▼──────┐ ┌─▼──────┐ ┌─────▼┐ ┌─────────────────────────────────┐     │
│  │Local FS│ │Cloud   │ │Hybrid│ │Tauri / Web | Unified Proxy      │     │
│  │.formia │ │API     │ │Sync  │ │/api/ai/generate (서버가 DB에서 키를 꺼내 대신 호출) |
│  └────────┘ └───┬────┘ └──────┘ └─────────────────────────────────┘     │
│                  │                                                      │
│   ┌──────────────▼────────────────────────────────────▼──────┐     │
│   │           ☁️ Service Layer (온라인 전용)                   │     │
│   │                                                           │     │
│   │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │     │
│   │   │   Auth   │ │  Forms   │ │ Response │ │ AI Proxy │  │     │
│   │   │  OAuth   │ │  CRUD    │ │ Storage  │ │ Endpoint │  │     │
│   │   └──────────┘ └──────────┘ └──────────┘ └──────────┘  │     │
│   │                       │                                   │     │
│   │              ┌────────▼────────┐                          │     │
│   │              │    Database     │                          │     │
│   │              │  SQLite / PG    │                          │     │
│   │              └─────────────────┘                          │     │
│   │                                                           │     │
│   │   Form Factor는 DB에 불투명 JSON blob으로만 저장          │     │
│   │   AI Proxy는 사용자 키를 DB에서 꺼내 Gemini에 전달       │     │
│   └───────────────────────────────────────────────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.1 레이어 분리 규칙

| 규칙                 |                              Editor Layer                              |                     Service Layer                     |
| -------------------- | :--------------------------------------------------------------------: | :---------------------------------------------------: |
| **오프라인 동작**    |             ✅ 코어 편집은 반드시 가능. AI는 온라인 전용.              |                    ❌ 온라인 필요                     |
| **DB 의존**          |                              ❌ 절대 없음                              |                     ✅ Prisma/DB                      |
| **인증 의존**        |                               ❌ 불필요                                |                     ✅ OAuth 필수                     |
| **Form Factor 조작** |                              ✅ 직접 수정                              |               ❌ 불투명 JSON으로만 저장               |
| **상태 관리**        |                            Zustand (메모리)                            |                       DB + API                        |
| **핵심 관심사**      | 폼 편집, 블록 렌더링, Undo/Redo (코어)<br>AI 에이전트 (선택적, 온라인) | 사용자 관리, 폼 파일 관리, 배포, 응답 수집, AI 프록시 |

### 1.2 레이어 간 통신: 두 개의 Port

에디터와 외부 세계 사이에는 정확히 **두 개의 Port**만 존재합니다:

```
Editor Layer                                   Service Layer / 외부
     │                                              │
     │ ① File I/O Port                              │
     │   save(formFactor: JSON)                      │
     │ ────────────────────────────────────────────▶ │  저장소 (로컬 파일 or 클라우드 DB)
     │   load(): JSON                                │
     │ ◀──────────────────────────────────────────── │
     │                                              │
     │ ② AI Port                                     │
     │   generatePatch(prompt, schema): Patch[]      │
     │ ────────────────────────────────────────────▶ │  AI 서비스 (Gemini, OpenAI 등)
     │   patches + summary                           │
     │ ◀──────────────────────────────────────────── │
     │                                              │
```

**에디터는 두 인터페이스(`FormRepository`, `AIPort`)만 알 뿐, 구현체가 로컬/네트워크/프록시인지 전혀 모릅니다.**

> ⚡ 핵심: File I/O Port는 에디터의 **필수** 의존성이지만, AI Port는 **선택적** 의존성입니다.
> AI가 없어도 수동 편집(블록 추가/삭제, 인라인 편집, 드래그 등)은 완전히 동작합니다.

---

## 2. Editor Layer 상세

### 2.1 AI Port — 선택적 부가 기능

> ⚠️ **AI는 에디터의 코어가 아니라 선택적 플러그인입니다.**
>
> 에디터의 코어 기능(캔버스 편집, 블록 조작, Undo/Redo)은 AI 없이 완전히 동작합니다.
> AI는 사용자 편의를 위한 부가 기능이며, 네트워크 연결이 필요합니다.

#### AI Port 인터페이스

```typescript
// Editor가 아는 유일한 AI 인터페이스
interface AIPort {
  generatePatch(prompt: string, schema: FormFactor): Promise<Operation[]>;
  isAvailable(): boolean; // 키가 설정되어 있고 연결 가능한지
}
```

#### 환경별 AI Adapter

| Adapter        | 환경             | AI API 호출 방식                          | 키 위치          |
| -------------- | ---------------- | ----------------------------------------- | ---------------- |
| `WebAIAdapter` | Tauri / Web 공통 | `/api/ai/generate` → 서버 **프록시** 경유 | 서버 DB (암호화) |

```
Tauri (Desktop) / Web (Browser) 공통:

Editor → AIPort
           │
     WebAIAdapter
           │
   /api/ai/generate
  (서버가 DB에서 키를
   꺼내서 대신 호출)
           │
           ▼
     Gemini API
```

#### 왜 File I/O Port와 분리하는가?

|                   |           File I/O Port           |           AI Port            |
| ----------------- | :-------------------------------: | :--------------------------: |
| **필수 여부**     | ✅ 필수 (저장 없이 에디터 무의미) |  ❌ 선택적 (수동 편집 가능)  |
| **오프라인 동작** |        ✅ 가능 (로컬 파일)        | ❌ 불가능 (AI가 외부 서비스) |
| **성격**          |      에디터의 **존재 이유**       |    에디터의 **편의 기능**    |

> AI는 외부 서비스(Google, OpenAI)를 호출하므로 **어차피 네트워크 없이 동작할 수 없습니다**.
> 이것은 레이어 분리 원칙의 위반이 아니라, AI의 본질적 특성입니다.

> 상세 보안: [Security Architecture](./security.md) — BYOK 키 관리, 프록시 설계
> 상세 프로토콜: [AI Interaction Protocol](./ai_interaction_protocol.md)

#### The Agent-State Protocol

The AI agent doesn't just "talk"; it produces structured updates (JSON patches) to the form state.

- **Input**: User prompt + current Form Factor (JSON).
- **Output**: Proposed JSON patches + explanatory natural language.

### 2.2 Form Factor (에디터의 데이터 모델)

Form Factor는 `.formia` 파일의 JSON 구조이며, 에디터가 다루는 **유일한 데이터 모델**입니다. DB 스키마나 API 응답 구조와는 무관합니다.

- **Declarative**: 폼이 _무엇인지_ 기술하며, _어떻게_ 저장하는지는 모름.
- **Bi-directional Sync**:
  - **Agent → Factor**: AI가 자연어를 해석하여 JSON Patch 생성.
  - **UI → Factor**: 사용자의 직접 조작 (드래그, 인라인 편집)이 Factor 업데이트.
- **Atomic Updates**: 변경은 세분화 (하나의 필드 추가, 하나의 색상 변경).
- **Self-contained**: Form Factor JSON만 있으면 폼을 완전히 렌더링 가능. 외부 의존 없음.

> 상세 스키마: [Form Factor Schema](./form_factor_schema.md)

### 2.3 Frontend Architecture

- **State Management**: Zustand — Form Factor를 메모리에 보관하는 Single Source of Truth.
- **Rendering Engine**: JSON 스키마를 파싱하여 컴포넌트를 동적으로 렌더링.
- **Canvas Interaction**: 드래그 앤 드롭, 인라인 편집 → 모두 Zustand Store에 반영.

### 2.4 History & Version Control (에디터 내부)

Undo/Redo와 변경 이력은 **에디터 내부에서 메모리로 관리**됩니다. DB와 무관합니다.

#### Command Pattern (In-Memory)

- 모든 Form Factor 수정은 **Command** 객체로 캡슐화.
- **Undo Stack**: 적용된 커맨드의 역연산 저장.
- **Redo Stack**: Undo된 커맨드 저장.
- 세밀한 즉각적 Undo/Redo 지원.

#### Change Tracking

- **Snapshotting**: 주요 변경 (AI 상호작용 커밋) 시 Form Factor 전체 스냅샷 생성.
- **JSON Diffs (RFC 6902)**: 각 단계에서 적용된 패치를 저장. 저장 효율적이고 변경 내역을 시각화 가능.

#### Versioning

- **Checkpoints**: 사용자가 "Checkpoints" (버전)을 수동 저장 가능.
- **History Metadata**: 각 변경에 포함되는 정보:
  - `author`: "human" 또는 "ai"
  - `timestamp`: 변경 시점
  - `description`: "이메일 필드 추가" (AI 생성 요약)
- **`.formia` 파일 내 저장**: `_history` 필드에 체크포인트 기록 (에디터 자체 관리).

---

## 3. Service Layer 개요

Service Layer는 **온라인 서비스 기능**을 담당합니다. 에디터와 직접 통신하지 않고, File I/O Port (Repository 어댑터)를 통해서만 Form Factor를 주고받습니다.

### 3.1 Service Layer 담당 영역

| 영역             | 설명                                     |
| ---------------- | ---------------------------------------- |
| **사용자 인증**  | OAuth (Google, GitHub), JWT 세션 관리    |
| **폼 파일 관리** | 사용자별 폼 목록, CRUD, 클라우드 저장    |
| **폼 배포**      | 공개 URL 생성, 정적 HTML/CDN 배포        |
| **응답 수집**    | 배포된 폼에서의 응답 저장/조회           |
| **동기화**       | Desktop 앱의 로컬 파일 ↔ 클라우드 동기화 |

### 3.2 Service Layer의 Form Factor 취급

**Service Layer는 Form Factor의 내부 구조를 해석하지 않습니다.**

```
에디터 → save({ pages: {...}, theme: {...}, ... })
                    │
          ┌─────────▼──────────┐
          │  Service Layer     │
          │                    │
          │  Form 테이블에     │
          │  factor: Json 으로 │  ← 불투명 blob. 내부를 열어보지 않음.
          │  그대로 저장        │
          └────────────────────┘
```

> 상세: [Cloud Architecture](./cloud_architecture.md), [Infrastructure](./infrastructure.md)

---

## 4. Deployment Strategy: Figma-like Hybrid Model

Formia는 **Web 우선 + Desktop 보조** 하이브리드 모델을 채택합니다.

### 4.1 Two Client Modes

| 모드                      | 플랫폼  |     인증     |     Editor Layer     |     Service Layer     |
| ------------------------- | ------- | :----------: | :------------------: | :-------------------: |
| **Web Client (주력)**     | Next.js | 필수 (OAuth) | ✅ 브라우저에서 동작 | ✅ 클라우드 저장/배포 |
| **Desktop Client (보조)** | Tauri   |    선택적    |   ✅ 오프라인 동작   |   로그인 시 동기화    |

### 4.2 핵심: 에디터는 양쪽 모두에서 동일하게 동작

- **Web**: 에디터가 브라우저에서 구동. File I/O는 Cloud API Adapter를 사용.
- **Desktop**: 에디터가 Tauri에서 구동. File I/O는 Local FS Adapter를 사용.
- **Desktop + 로그인**: Hybrid Adapter가 로컬 저장 + 백그라운드 동기화.
- 어떤 환경에서든 **에디터 코드는 동일**. Adapter만 교체.

### 4.3 Technical Stack

- **Web Frontend**: Next.js 14+ (App Router)
- **Desktop**: Tauri 2.0 (Rust backend)
- **Backend**: Next.js API Routes (Phase 1-2) → NestJS (Phase 3+)
- **ORM**: Prisma
- **Database**: SQLite (개발) → PostgreSQL (프로덕션)
- **Auth**: NextAuth.js (OAuth 2.0)
- **Editor State**: Zustand (Form Factor — 메모리 내)
- **AI Integration**: Multi-provider SDKs (Gemini, OpenAI, Anthropic) — BYOK 모델
- **Data Format**: `.formia` (JSON)

> 상세: [Infrastructure](./infrastructure.md), [Cloud Architecture](./cloud_architecture.md)

## 5. Testing & Quality Assurance

For a detailed breakdown, see [Testing Strategy](./testing_strategy.md).

---

## 관련 문서

- [Security Architecture](./security.md) - BYOK API 키 보안, 암호화, 위협 모델
- [Cloud Architecture](./cloud_architecture.md) - 클라우드/인증/배포 설계 (Service Layer 상세)
- [Infrastructure](./infrastructure.md) - 인프라/DB/서버 배포 전략 (Service Layer 인프라)
- [Form Factor Schema](./form_factor_schema.md) - Form Factor JSON 스키마 (Editor Layer 데이터 모델)
- [Code Design Patterns](./code_design_patterns.md) - 코드 패턴 및 아키텍처 레이어
- [AI Interaction Protocol](./ai_interaction_protocol.md) - AI Agent 통신 및 BYOK 키 관리
