# Cloud Architecture: Formia (Figma-like Hybrid Model)

> 이 문서는 Formia의 클라우드 기반 아키텍처 설계를 다룹니다.
> 로컬 파일 작업과 웹 기반 협업/배포를 모두 지원하는 하이브리드 모델입니다.

## 1. 아키텍처 개요

### 1.1 왜 순수 로컬 앱은 불가능한가?

Formia는 **폼을 배포하고 응답을 수집하는 서비스**입니다. draw.io처럼 순수 로컬 앱으로 만들 수 없는 이유:

| 기능               | 로컬 전용 | 서버 필요 |
| ------------------ | :-------: | :-------: |
| 폼 편집/저장       |    ✅     |    ✅     |
| 폼 배포 (URL 생성) |    ❌     |    ✅     |
| 응답 수집          |    ❌     |    ✅     |
| 응답 분석/통계     |    ❌     |    ✅     |
| 실시간 협업        |    ❌     |    ✅     |
| 사용자 인증        |    ❌     |    ✅     |

### 1.2 Figma-like Hybrid Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Formia Architecture                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐         │
│   │  Web Client   │     │ Desktop Client│     │ Published Form│         │
│   │  (Next.js)    │     │   (Tauri)     │     │   (Static)    │         │
│   └───────┬───────┘     └───────┬───────┘     └───────┬───────┘         │
│           │                     │                     │                  │
│   ┌───────▼─────────────────────▼───────┐             │                  │
│   │   🎨 Form Editor (오프라인 독립)     │             │                  │
│   │   - Canvas, AI Agent, Zustand Store │             │                  │
│   │   - DB/인증/네트워크 의존 없음       │             │                  │
│   └──────────────┬──────────────────────┘             │                  │
│                  │  File I/O Port                     │                  │
│                  │  (save/load만 노출)                │                  │
│       ┌──────────┼──────────┐                         │                  │
│       │          │          │                         │                  │
│   ┌───▼───┐ ┌───▼───┐ ┌───▼───┐                     │                  │
│   │Local  │ │Cloud  │ │Hybrid │                      │                  │
│   │FS     │ │API    │ │(Sync) │                      │                  │
│   │Adapter│ │Adapter│ │Adapter│                      │                  │
│   └───────┘ └───┬───┘ └───────┘                      │                  │
│                 │                                     │                  │
│   ┌─────────────▼─────────────────────────────────────▼────────────┐     │
│   │              ☁️ Service Layer (온라인 전용)                     │     │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │     │
│   │  │    Auth     │  │    Forms    │  │  Responses  │            │     │
│   │  │  (OAuth)    │  │    CRUD     │  │   Storage   │            │     │
│   │  └─────────────┘  └─────────────┘  └─────────────┘            │     │
│   └───────────────────────────┬───────────────────────────────────┘     │
│                               │                                          │
│                    ┌──────────▼──────────┐                              │
│                    │     Database        │                              │
│                    │  SQLite (Dev)       │                              │
│                    │  PostgreSQL (Prod)  │                              │
│                    └─────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 클라이언트 전략

### 2.1 두 가지 클라이언트 모드

#### Mode A: Web Client (주력)

- **URL**: `app.formia.io`
- **인증**: 필수 (OAuth)
- **저장**: 클라우드 자동 저장
- **협업**: 실시간 (WebSocket/CRDT)
- **배포**: 지원

#### Mode B: Desktop Client (Tauri, 보조)

- **사용 시나리오**:
  - 오프라인 작업
  - `.formia` 파일 로컬 편집
  - 웹으로 export하여 배포
- **인증**: 선택적 (로그인 시 클라우드 동기화)
- **저장**: 로컬 파일 (`.formia`)
- **배포**: 로그인 후 가능

### 2.2 공유 코드베이스

```
src/
├── core/              # [Editor Tier] 플랫폼 독립적 로직
│   ├── form-factor/   #   Form Factor 스키마 및 조작 (DB 무관)
│   ├── store/         #   Zustand 상태 관리 (메모리 내)
│   └── ai/            #   AI Agent 통신
│
├── ui/                # [Editor Tier] React 컴포넌트 (Web/Desktop 공유)
│   ├── editor/
│   ├── preview/
│   └── blocks/
│
├── adapters/          # [경계] Editor ↔ Service 연결 (교체 가능)
│   ├── web/           #   Cloud API Adapter
│   │   ├── api.ts     #     REST API 호출
│   │   └── realtime.ts
│   │
│   └── tauri/         #   Local File Adapter
│       ├── fs.ts      #     .formia 파일 읽기/쓰기
│       ├── ipc.ts
│       └── sync.ts    #     온라인 시 클라우드 동기화
│
├── server/            # [Service Tier] 백엔드 로직 (Editor가 import하지 않음)
│   ├── auth/          #   OAuth, JWT
│   ├── services/      #   Forms CRUD, Deployment, Responses
│   └── middleware/    #   Auth middleware, Rate limiting
│
├── prisma/            # [Service Tier] DB 스키마 & 마이그레이션
│
└── app/               # 진입점
    ├── (editor)/      #   에디터 페이지
    ├── api/           #   Service Tier API Routes
    └── desktop/       #   Tauri 래퍼
```

> ⚠️ **Import 규칙**: `core/`, `ui/`, `store/` → `server/`, `prisma/`를 import 금지.
> 에디터 코드는 `adapters/`의 `FormRepository` 인터페이스만 사용.

---

## 3. 파일 저장 전략

### 3.1 저장 계층 구조

```typescript
// Repository Interface (Port)
interface FormRepository {
  save(form: FormFactor): Promise<void>;
  load(id: string): Promise<FormFactor>;
  list(): Promise<FormMetadata[]>;
  delete(id: string): Promise<void>;
}

// Adapter 구현
class LocalFSRepository implements FormRepository { ... }    // Tauri
class CloudAPIRepository implements FormRepository { ... }   // Web
class HybridRepository implements FormRepository { ... }     // 동기화
```

### 3.2 `.formia` 파일 포맷

```json
{
  "version": "2.0.0",
  "id": "uuid-v4",
  "cloudId": "optional-cloud-reference",
  "metadata": {
    "title": "My Survey",
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "author": {
      "id": "user-id",
      "name": "User Name"
    }
  },
  "theme": { ... },
  "pages": [ ... ],
  "settings": { ... },
  "_history": {
    "checkpoints": [ ... ],
    "lastSyncedAt": "ISO-8601"
  }
}
```

### 3.3 저장 시나리오

| 시나리오               | 동작                                                  |
| ---------------------- | ----------------------------------------------------- |
| **Web 작업**           | 자동 저장 (debounced, 2초) → Cloud DB                 |
| **Desktop (온라인)**   | 로컬 저장 + 백그라운드 클라우드 동기화                |
| **Desktop (오프라인)** | 로컬만 저장, 온라인 복귀 시 동기화                    |
| **파일 Import**        | `.formia` 파일 → 에디터 로드 → 선택적 클라우드 업로드 |
| **파일 Export**        | 현재 폼 → `.formia` 파일 다운로드                     |

---

## 4. 인증 시스템

### 4.1 OAuth 2.0 + JWT

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│  User   │────▶│  OAuth      │────▶│  Formia     │
│         │     │  Provider   │     │  Backend    │
│         │◀────│  (Google,   │◀────│             │
│         │     │   GitHub)   │     │             │
└─────────┘     └─────────────┘     └─────────────┘
     │                                     │
     │         Access Token (JWT)          │
     └─────────────────────────────────────┘
```

### 4.2 인증 플로우

#### Web Client

```typescript
// 1. OAuth 시작
const loginWithGoogle = () => {
  window.location.href = "/api/auth/google";
};

// 2. Callback 처리
// /api/auth/callback/google
// → JWT 발급 → HttpOnly Cookie 설정

// 3. API 요청 (자동 인증)
const forms = await api.get("/forms"); // Cookie 자동 포함
```

#### Desktop Client (Tauri)

```typescript
// 1. 시스템 브라우저로 OAuth
const authUrl = await invoke("start_oauth", { provider: "google" });
open(authUrl); // 시스템 브라우저 열기

// 2. Deep Link Callback
// formia://auth/callback?token=...

// 3. 토큰 저장 (Secure Storage)
await invoke("save_token", { token });
```

### 4.3 인증 요구사항 매트릭스

| 기능               | 익명 | 로그인 필수 |
| ------------------ | :--: | :---------: |
| 폼 편집 (로컬)     |  ✅  |      -      |
| 폼 편집 (클라우드) |  -   |     ✅      |
| 폼 배포            |  -   |     ✅      |
| 배포된 폼 응답     |  ✅  |      -      |
| 응답 조회/분석     |  -   |     ✅      |
| 팀 협업            |  -   |     ✅      |

---

## 5. 폼 배포 아키텍처

### 5.1 배포 플로우

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Editor     │     │   Backend    │     │   CDN/Edge   │
│   (User)     │     │   API        │     │   (Vercel)   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  POST /forms/:id/publish                │
       │────────────────────▶                    │
       │                    │                    │
       │                    │  Generate Static   │
       │                    │  HTML + Assets     │
       │                    │───────────────────▶│
       │                    │                    │
       │  { publishedUrl }  │                    │
       │◀────────────────────                    │
       │                    │                    │
```

### 5.2 Published Form 구조

```
forms.formia.io/
├── {formId}/
│   ├── index.html        # 최적화된 정적 폼
│   ├── config.json       # 폼 설정 (서버 렌더링용)
│   └── assets/
│       ├── styles.css
│       └── runtime.js    # 응답 제출 로직
```

### 5.3 응답 수집 API

```
POST /api/responses
Content-Type: application/json

{
  "formId": "abc-123",
  "responses": {
    "block-1": "John Doe",
    "block-2": ["Option A", "Option C"],
    "block-3": 4
  },
  "metadata": {
    "userAgent": "...",
    "referrer": "...",
    "submittedAt": "ISO-8601"
  }
}
```

> **Note**: 응답 API는 **인증 불필요** (Public). Rate limiting + CAPTCHA로 스팸 방지.

### 5.4 배포 상태 관리

```typescript
interface FormDeployment {
  formId: string;
  status: "draft" | "published" | "archived";
  publishedUrl: string | null;
  publishedAt: Date | null;
  version: number; // 배포된 버전
  settings: {
    acceptResponses: boolean;
    responseLimit: number | null;
    expiresAt: Date | null;
    password: string | null; // 선택적 비밀번호 보호
  };
  stats: {
    views: number;
    responses: number;
    completionRate: number;
  };
}
```

---

## 6. 데이터베이스 스키마

> **ORM**: Prisma
> **개발**: SQLite / **프로덕션**: PostgreSQL
> 상세 스키마 및 Form Factor 분리 원칙은 [Infrastructure](./infrastructure.md) Section 5 참조.

### 6.1 핵심 테이블

```typescript
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  provider  String?  // google, github
  avatar    String?
  forms     Form[]
  createdAt DateTime @default(now())
}

model Form {
  id        String   @id @default(cuid())
  title     String
  factor    Json     // 🔑 Form Factor 전체 (불투명 JSON)
  version   Int      @default(1)

  owner     User     @relation(fields: [ownerId], references: [id])
  ownerId   String

  deployment Deployment?
  responses  Response[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Deployment {
  id           String    @id @default(cuid())
  status       String    @default("draft")
  publishedUrl String?
  publishedAt  DateTime?
  settings     Json?

  form   Form   @relation(fields: [formId], references: [id])
  formId String @unique
}

model Response {
  id          String   @id @default(cuid())
  data        Json
  metadata    Json?
  submittedAt DateTime @default(now())

  form   Form   @relation(fields: [formId], references: [id])
  formId String

  @@index([formId, submittedAt])
}
```

> ⚠️ **핵심 원칙**: Form Factor (pages, blocks, theme)는 `factor Json` 필드에 통째로 저장.
> 블록/페이지마다 별도 테이블을 만들면 안 됩니다.

---

## 7. 현재 구조에서 필요한 변경 사항

### 7.1 즉시 필요한 변경

| 영역       | 현재        | 변경 필요               |
| ---------- | ----------- | ----------------------- |
| **저장**   | 로컬 파일만 | + Cloud API 어댑터 추가 |
| **인증**   | 없음 (BYOK) | OAuth 인증 시스템 구축  |
| **백엔드** | 없음        | REST API 서버 구축      |
| **DB**     | 없음        | MongoDB 설정            |
| **배포**   | 없음        | 폼 배포/응답 수집 API   |

### 7.2 단계별 마이그레이션 계획

#### Phase 1: 백엔드 기반 구축

1. **Next.js API Routes**로 백엔드 시작 (별도 서버 없이 빠르게)
2. Prisma + SQLite 설정
3. 기본 CRUD API (`/api/forms`, `/api/responses`)
4. OAuth 인증 (Google 우선, NextAuth.js)

#### Phase 2: 웹 클라이언트 확장

1. 기존 Next.js 앱에 인증 UI 추가
2. Cloud Repository 어댑터 구현
3. 웹 전용 진입점 (`app.formia.io`)

#### Phase 3: 배포 시스템

1. 폼 배포 API (`POST /forms/:id/publish`)
2. 정적 폼 생성 및 CDN 배포
3. 응답 수집 API (Public)
4. 응답 대시보드

#### Phase 4: Desktop 통합

1. Tauri 앱에 선택적 로그인 추가
2. 오프라인/온라인 동기화 로직
3. `.formia` 파일 ↔ 클라우드 동기화

---

## 8. 기술 스택 제안

| 계층         | Phase 1-2          | Phase 3+                 |
| ------------ | ------------------ | ------------------------ |
| **Frontend** | Next.js 14+        | Next.js (Vercel)         |
| **Desktop**  | Tauri 2.0          | Tauri 2.0                |
| **Backend**  | Next.js API Routes | NestJS (분리 서버)       |
| **ORM**      | Prisma             | Prisma                   |
| **Database** | SQLite             | PostgreSQL (RDS)         |
| **Auth**     | NextAuth.js        | NextAuth.js              |
| **Realtime** | (Phase 4)          | Socket.io / Liveblocks   |
| **CDN**      | -                  | Cloudflare / Vercel Edge |

---

## 9. 보안 고려사항

### 9.1 인증 보안

- JWT: HttpOnly Cookie (Web), Secure Storage (Desktop)
- Refresh Token Rotation
- CSRF 보호

### 9.2 데이터 보안

- 응답 데이터 암호화 (at rest)
- IP 주소 해싱 (익명화)
- Rate Limiting (응답 API)
- Optional: CAPTCHA (봇 방지)

### 9.3 API 보안

- API Key 관리 (BYOK는 클라이언트 사이드 유지)
- 권한 검증 (폼 소유자/협업자만 수정 가능)
- Input Validation (Zod 스키마)

---

## 10. 결론

Formia는 **Figma-like Hybrid Model**을 채택합니다:

1. **Web 우선**: 대부분의 사용자는 웹에서 로그인하여 작업
2. **Desktop 보조**: 오프라인 작업, 파일 기반 워크플로우 지원
3. **배포 필수**: 폼 배포 및 응답 수집은 백엔드 서버 필수
4. **점진적 마이그레이션**: 현재 Tauri 앱을 유지하면서 웹/클라우드 기능 확장

다음 단계: [TODO] Phase 1 백엔드 구축 시작
