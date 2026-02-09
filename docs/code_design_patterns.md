# Code Design Patterns & Layers: Formia

To ensure high readability and maintainability, Formia follows a strict **Layered Architecture** with a clear boundary between **Editor** and **Service** concerns.

## 1. Two-Tier Architecture

```
┌─────────────────────────────────────────────────┐
│    Editor Tier (오프라인 독립 동작)               │
│                                                  │
│    UI Layer → Domain Layer → File I/O Port       │
│                                                  │
│    DB 없음. 인증 없음. 네트워크 불필요.           │
└───────────────────────┬─────────────────────────┘
                        │  save/load (FormFactor JSON)
                        │
              ┌─────────▼──────────┐
              │  Adapter (교체 가능) │
              │  Local | Cloud | Hybrid │
              └─────────┬──────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│    Service Tier (온라인 전용)                     │
│                                                  │
│    API Routes → Service Logic → Prisma → DB      │
│                                                  │
│    사용자/배포/응답 관리. Editor를 모름.           │
└─────────────────────────────────────────────────┘
```

## 2. Editor Tier Layers

### 2.1 UI Layer (React/Next.js)

- **Components**: Atomic UI parts (Buttons, Inputs, Cards).
- **Features**: Higher-level modules (BuilderCanvas, Sidebar, Header).
- **Hooks**: UI-specific logic (e.g., `useDragAndDrop`, `useInlineEdit`).

### 2.2 Domain Layer (Core Business Logic)

에디터의 핵심 로직. DB나 네트워크와 **완전히 무관**.

- **Form Factor Store**: Zustand로 관리하는 Single Source of Truth (메모리 내).
- **Schema Engine**: Form Factor JSON의 유효성 검사 및 조작 로직.
- **Commands**: Undo/Redo를 위한 캡슐화된 액션 (메모리 내).
- **AI Interaction**: LLM 어댑터와의 통신, JSON Patch 생성/적용.

### 2.3 File I/O Port (경계 인터페이스)

에디터가 외부 세계와 통신하는 **유일한 접점**. 에디터는 이 인터페이스의 `save()`/`load()`만 호출하며, 구현체가 로컬 파일인지 REST API인지 모름.

```typescript
// 에디터가 아는 유일한 인터페이스
interface FormRepository {
  save(content: FormFactor): Promise<void>;
  load(id: string): Promise<FormFactor>;
  list(): Promise<FormInfo[]>;
  delete(id: string): Promise<void>;
}
```

### 2.4 Adapters (File I/O 구현체)

| Adapter               | 환경             | 동작                                   |
| --------------------- | ---------------- | -------------------------------------- |
| `LocalFileRepository` | Desktop (Tauri)  | `.formia` 파일 읽기/쓰기               |
| `CloudAPIRepository`  | Web              | REST API 호출 (`/api/forms`)           |
| `HybridRepository`    | Desktop + 로그인 | 로컬 저장 + 백그라운드 클라우드 동기화 |

## 3. Service Tier Layers (에디터와 분리됨)

> 이 레이어는 에디터 코드에서 직접 참조되지 않습니다.
> API Routes를 통해서만 접근 가능합니다.

### 3.1 API Layer

- Next.js API Routes (Phase 1-2) → NestJS (Phase 3+)
- RESTful endpoints: `/api/forms`, `/api/responses`, `/api/auth`

### 3.2 Service Logic

- **Auth Service**: OAuth 2.0 (NextAuth.js), JWT 세션 관리.
- **Form Service**: 폼 CRUD, 버전 관리. Form Factor를 **불투명 JSON**으로만 취급.
- **Deployment Service**: 폼 배포 (정적 HTML 생성, CDN 업로드).
- **Response Service**: 응답 수집/저장/조회.

### 3.3 Persistence

- **ORM**: Prisma
- **DB**: SQLite (개발) → PostgreSQL (프로덕션)
- **핵심**: DB 스키마는 서비스 메타데이터(사용자, 배포, 응답)만 정의. Form Factor 내부 구조는 DB 스키마에 반영하지 않음.

> 상세: [Infrastructure](./infrastructure.md) Section 5

---

## 4. Shared Design Patterns

### 4.1 Command Pattern (History Management — Editor Tier)

Every change to the Form Factor must be a `Command` object.

```typescript
interface Command {
  execute(): void;
  undo(): void;
  metadata: { author: "human" | "ai"; description: string };
}
```

### 4.2 Adapter Pattern (Multi-LLM Support — Editor Tier)

Standardize different LLM responses into a unified Formia format.

```typescript
interface AIProvider {
  generatePatch(
    prompt: string,
    currentSchema: FormFactor,
  ): Promise<JsonPatch[]>;
}
```

### 4.3 Strategy Pattern (Block Rendering — Editor Tier)

Different block types (text, choice, rating) are rendered using a strategy-based dynamic renderer.

### 4.4 Observer Pattern (State Sync — Editor Tier)

Ensures that when the Form Factor changes (from Agent or UI), all relevant components re-render immediately.

### 4.5 Repository Pattern (Editor ↔ Service 경계)

Editor의 Domain Layer가 저장 방식에 의존하지 않도록 하는 핵심 패턴 (Section 2.3 참조).

## 5. Communication Rules

- **One-Way Data Flow**: Data flows from the Form Factor Store to the UI.
- **Explicit Patches**: The UI and Agent never "mutate" state directly; they emit Patches/Commands that the Store applies.
- **Dependency Inversion**: High-level modules (Builder) should not depend on low-level SDKs directly; use interfaces (`AIProvider`, `FormRepository`).
- **Layer Boundary**: Editor Tier 코드는 절대 Prisma, DB, API Route handler를 직접 import하지 않음.

## 6. Folder Structure Convention

```
src/
  ├── app/               # Next.js App Router
  │    ├── (editor)/     # 에디터 페이지 (Editor Tier 진입점)
  │    └── api/          # Service Tier API Routes
  │
  ├── components/        # [Editor] Atomic UI Components
  ├── features/          # [Editor] Feature modules (builder, ai-panel)
  │
  ├── lib/
  │    ├── core/         # [Editor] Domain Layer (Form Factor, Commands)
  │    ├── ai/           # [Editor] LLM Adapters
  │    ├── adapters/     # [경계] Repository adapters (Local, Cloud, Hybrid)
  │    └── utils/        # Shared helpers
  │
  ├── store/             # [Editor] Zustand Store
  │
  ├── server/            # [Service] Backend logic (auth, forms, responses)
  │    ├── services/     # Service Layer business logic
  │    └── middleware/    # Auth middleware, rate limiting
  │
  └── prisma/            # [Service] Prisma schema & migrations
```

> **규칙**: `components/`, `features/`, `lib/core/`, `store/` 디렉토리의 코드는 `server/`, `prisma/`를 import할 수 없습니다.
