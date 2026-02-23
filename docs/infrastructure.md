# Infrastructure Architecture: Formia

> 이 문서는 Formia의 인프라 구성 및 단계별 배포 전략을 다룹니다.

## 1. 인프라 진화 로드맵

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Infrastructure Evolution                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Stage 1: Local Dev          Stage 2: Dev/Staging       Stage 3: Prod  │
│   ─────────────────          ─────────────────────      ──────────────  │
│                                                                          │
│   ┌─────────────┐            ┌─────────────────┐       ┌────────────┐   │
│   │   Local     │            │    EC2 (t3.small)│       │  ECS/EKS   │   │
│   │   Machine   │            │                 │       │  Cluster   │   │
│   │             │            │  ┌───────────┐  │       └─────┬──────┘   │
│   │ ┌─────────┐ │            │  │  Docker   │  │             │          │
│   │ │ Next.js │ │            │  │  Compose  │  │       ┌─────▼──────┐   │
│   │ │ + API   │ │     →      │  │           │  │   →   │   RDS      │   │
│   │ └────┬────┘ │            │  │ Next+API  │  │       │ PostgreSQL │   │
│   │      │      │            │  │ + SQLite  │  │       └────────────┘   │
│   │ ┌────▼────┐ │            │  └───────────┘  │                        │
│   │ │ SQLite  │ │            └─────────────────┘       ┌────────────┐   │
│   │ │  .db    │ │                                      │ CloudFront │   │
│   │ └─────────┘ │                                      │  + S3      │   │
│   └─────────────┘                                      └────────────┘   │
│                                                                          │
│   비용: $0                   비용: ~$15-20/월           비용: ~$50+/월   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 단계별 상세 구성

### Stage 1: 로컬 개발 (현재)

**구성**: 모든 것이 로컬

```
localhost:3001  → Next.js (프론트 + API Routes)
                  └── SQLite (formia.db)
```

| 항목     | 구성               |
| -------- | ------------------ |
| Frontend | Next.js 14+        |
| Backend  | Next.js API Routes |
| Database | SQLite (로컬 파일) |
| 비용     | $0                 |

---

### Stage 2: Dev/Staging (EC2 단일 서버)

**권장 인스턴스**: `t3.small` (~$15/월) 또는 `t3.micro` (~$8/월)

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "80:3001"
    volumes:
      - ./data:/app/data # SQLite 영속화
      - ./.env.production:/app/.env
    environment:
      - DATABASE_URL=file:./data/formia.db
      - NODE_ENV=production
    restart: unless-stopped

  # 옵션: Nginx Reverse Proxy + SSL
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certbot:/etc/letsencrypt
    depends_on:
      - app
```

**예상 비용**:
| 항목 | 월 비용 |
|------|--------|
| EC2 t3.small | ~$15 |
| EBS 20GB | ~$2 |
| 도메인 | ~$1 (연간 $12) |
| **합계** | **~$18/월** |

---

### Stage 3: Production (확장 가능한 구조)

**권장 구성**:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Production Setup                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐                                              │
│   │  CloudFront  │  ← CDN, 정적 자산, SSL                        │
│   └──────┬───────┘                                              │
│          │                                                       │
│   ┌──────▼───────┐     ┌──────────────┐                         │
│   │   Vercel     │     │   EC2/ECS    │                         │
│   │  (Frontend)  │────▶│   (API)      │                         │
│   │   Next.js    │     │   NestJS     │                         │
│   └──────────────┘     └──────┬───────┘                         │
│                               │                                  │
│                        ┌──────▼───────┐                         │
│                        │     RDS      │                         │
│                        │  PostgreSQL  │                         │
│                        │  (db.t3.micro)│                        │
│                        └──────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**예상 비용**:
| 항목 | 월 비용 |
|------|--------|
| Vercel (Pro) | $20 |
| EC2 t3.small (API) | ~$15 |
| RDS db.t3.micro | ~$15 |
| CloudFront | ~$5 (트래픽 기반) |
| **합계** | **~$55/월** |

---

## 3. 백엔드 전환 전략: Next.js API Routes → NestJS

### 전환 계획

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Backend Evolution Strategy                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Phase 1-2 (MVP/Beta)              Phase 3+ (Production)               │
│   ────────────────────              ─────────────────────               │
│                                                                          │
│   ┌─────────────────┐               ┌─────────────────┐                 │
│   │    Next.js      │               │    Next.js      │                 │
│   │  ┌───────────┐  │               │   (Frontend)    │                 │
│   │  │ API Routes│  │       →       └────────┬────────┘                 │
│   │  │ /api/*    │  │                        │                          │
│   │  └───────────┘  │               ┌────────▼────────┐                 │
│   └─────────────────┘               │     NestJS      │                 │
│                                     │   (Backend)     │                 │
│                                     │  /api/v1/*      │                 │
│                                     └─────────────────┘                 │
│                                                                          │
│   장점: 빠른 개발                    장점: 확장성, 구조화                  │
│   단점: 복잡한 로직 관리 어려움        단점: 두 서버 관리                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 전환이 수월한 이유

1. **API 계약 유지**: `/api/*` 엔드포인트 구조 동일하게 유지
2. **Prisma 공유**: 동일한 Prisma 스키마 및 클라이언트 사용 가능
3. **점진적 마이그레이션**: 엔드포인트별로 하나씩 이전 가능

### 전환 시 고려사항

```typescript
// Next.js API Route 예시
// pages/api/forms/[id].ts
export default async function handler(req, res) {
  const form = await prisma.form.findUnique({ where: { id: req.query.id } });
  res.json(form);
}

// NestJS Controller 예시 (전환 후)
// src/forms/forms.controller.ts
@Controller("forms")
export class FormsController {
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.formsService.findOne(id);
  }
}
```

---

## 4. 데이터베이스 전략

### 4.1 ORM: Prisma

```typescript
// prisma/schema.prisma
datasource db {
  provider = "sqlite"  // 개발: sqlite, 프로덕션: postgresql
  url      = env("DATABASE_URL")
}
```

### 4.2 환경별 DATABASE_URL

```bash
# .env.local (개발)
DATABASE_URL="file:./data/formia.db"

# .env.staging (EC2)
DATABASE_URL="file:/app/data/formia.db"

# .env.production (RDS)
DATABASE_URL="postgresql://user:pass@formia-db.xxx.rds.amazonaws.com:5432/formia"
```

### 4.3 SQLite → PostgreSQL 마이그레이션

```bash
# 개발: SQLite
npx prisma migrate dev

# 프로덕션: PostgreSQL로 전환 시
# 1. schema.prisma에서 provider 변경
# 2. 마이그레이션 생성
npx prisma migrate deploy
```

---

## 5. ⚠️ 중요: Editor Layer와 Service Layer의 분리 원칙

### 왜 분리해야 하는가?

Formia의 Form Factor는 **에디터가 다루는 데이터 모델**입니다.
에디터는 오프라인에서도 동작해야 하므로, DB나 백엔드에 의존하면 안 됩니다.

만약 DB 스키마가 Form Factor의 세부 구조 (pages, blocks)에 결합되면:

- 에디터가 DB에 의존하게 됨 → 오프라인 동작 불가
- 블록 타입 추가/제거 시 DB 마이그레이션 필요 → 개발 속도 저하
- 에디터 코드와 백엔드 코드의 경계가 무너짐 → 유지보수 난이도 급증

### 해결책: **두 레이어의 관심사 완전 분리**

```
┌──────────────────────────────────────────────────┐
│  Editor Layer                                     │
│                                                    │
│  Form Factor = .formia JSON 파일의 구조            │
│  - pages, blocks, theme, settings                 │
│  - Zustand Store에 메모리로 관리                   │
│  - DB를 전혀 모름. import도 하지 않음.             │
│                                                    │
│  에디터가 "save"할 때 전달하는 것:                  │
│  → FormFactor JSON 객체 하나                       │
└──────────────────┬───────────────────────────────┘
                   │  save(formFactor)
                   │  ← File I/O Port
                   │
┌──────────────────▼───────────────────────────────┐
│  Service Layer                                    │
│                                                    │
│  DB가 저장하는 것:                                 │
│  - User (사용자, 인증)                             │
│  - Form (제목, factor: Json, 생성일)               │
│  - Deployment (배포 상태)                          │
│  - Response (응답 데이터)                          │
│                                                    │
│  Form Factor를 factor: Json 필드에 그대로 저장.    │
│  내부 구조를 해석하지 않음. 불투명 blob.            │
└──────────────────────────────────────────────────┘
```

```typescript
// ❌ 잘못된 설계: Form Factor 내부를 DB 테이블로 풀어놓음
//    → 에디터가 DB에 결합됨
model Page {
  id       String  @id
  formId   String
  title    String
  type     String
  blocks   Block[]
}

model Block {
  id       String  @id
  pageId   String
  type     String  // text, choice, rating...
  label    String?
  options  String[]  // choice 전용
  maxRating Int?     // rating 전용
  // ... 블록 타입마다 필드 추가 필요
}

// ✅ 올바른 설계: Service Layer는 Form Factor를 불투명 JSON으로만 저장
//    → 에디터와 DB 완전 분리
model Form {
  id        String   @id @default(cuid())
  ownerId   String
  title     String
  factor    Json     // 🔑 Form Factor 전체 (pages, blocks, theme 모두 포함)
  version   Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  owner      User        @relation(fields: [ownerId], references: [id])
  deployment Deployment?
  responses  Response[]
}
```

### 관심사 분리 테이블

| 관심사                          | 담당 레이어       | DB 테이블?           |
| ------------------------------- | ----------------- | -------------------- |
| 폼 구조 (pages, blocks)         | **Editor Layer**  | ❌ (JSON 내부)       |
| 테마, 스타일                    | **Editor Layer**  | ❌ (JSON 내부)       |
| 블록 설정 (options, validation) | **Editor Layer**  | ❌ (JSON 내부)       |
| 사용자, 인증                    | **Service Layer** | ✅ User 테이블       |
| 폼 메타데이터 (제목, 생성일)    | **Service Layer** | ✅ Form 테이블       |
| 배포 상태                       | **Service Layer** | ✅ Deployment 테이블 |
| 응답 데이터                     | **Service Layer** | ✅ Response 테이블   |

### Form Factor 변경 시

```
Form Factor 변경 (page, block 추가/수정)
    ↓
에디터 내에서 Zustand Store 업데이트
    ↓
save() 호출 → factor JSON 필드만 업데이트
    ↓
DB 스키마 변경 불필요 ✅
마이그레이션 불필요 ✅
```

### 추천 Prisma 스키마

```typescript
// prisma/schema.prisma

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
  status       String    @default("draft")  // draft, published, archived
  publishedUrl String?
  publishedAt  DateTime?
  settings     Json?     // acceptResponses, responseLimit, expiresAt 등

  form   Form   @relation(fields: [formId], references: [id])
  formId String @unique
}

model Response {
  id          String   @id @default(cuid())
  data        Json     // 응답 데이터 (block별 응답)
  metadata    Json?    // userAgent, referrer, duration 등
  submittedAt DateTime @default(now())

  form   Form   @relation(fields: [formId], references: [id])
  formId String

  @@index([formId, submittedAt])
}
```

### JSON 쿼리 시 주의사항

```typescript
// ❌ 피해야 할 패턴: DB에서 Form Factor 내부 구조 쿼리
// SQLite/PostgreSQL JSON 쿼리는 비효율적

// ✅ 권장 패턴: 애플리케이션 레이어에서 처리
const form = await prisma.form.findUnique({ where: { id } });
const factor = form.factor as FormFactor;
const pages = factor.pages.filter((p) => p.type === "default");
```

---

## 6. 대안 인프라: Fly.io + LiteFS

### 6.1 LiteFS란?

LiteFS는 **SQLite를 분산 복제하는 FUSE 기반 파일 시스템**입니다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     LiteFS Architecture                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      Fly.io Edge Network                         │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│           ┌────────────────────────┼────────────────────────┐           │
│           │                        │                        │           │
│   ┌───────▼───────┐       ┌───────▼───────┐       ┌───────▼───────┐    │
│   │   Region: IAD │       │   Region: NRT │       │   Region: SIN │    │
│   │   (Virginia)  │       │   (Tokyo)     │       │   (Singapore) │    │
│   │               │       │               │       │               │    │
│   │  ┌─────────┐  │       │  ┌─────────┐  │       │  ┌─────────┐  │    │
│   │  │   App   │  │       │  │   App   │  │       │  │   App   │  │    │
│   │  └────┬────┘  │       │  └────┬────┘  │       │  └────┬────┘  │    │
│   │       │       │       │       │       │       │       │       │    │
│   │  ┌────▼────┐  │       │  ┌────▼────┐  │       │  ┌────▼────┐  │    │
│   │  │ LiteFS  │  │◀─────▶│  │ LiteFS  │  │◀─────▶│  │ LiteFS  │  │    │
│   │  │ (FUSE)  │  │       │  │ (FUSE)  │  │       │  │ (FUSE)  │  │    │
│   │  └────┬────┘  │       │  └────┬────┘  │       │  └────┬────┘  │    │
│   │       │       │       │       │       │       │       │       │    │
│   │  ┌────▼────┐  │       │  ┌────▼────┐  │       │  ┌────▼────┐  │    │
│   │  │ SQLite  │  │       │  │ SQLite  │  │       │  │ SQLite  │  │    │
│   │  │ PRIMARY │  │──────▶│  │ REPLICA │  │──────▶│  │ REPLICA │  │    │
│   │  └─────────┘  │       │  └─────────┘  │       │  └─────────┘  │    │
│   └───────────────┘       └───────────────┘       └───────────────┘    │
│         │                                                               │
│         │ 쓰기 (Primary만)                                              │
│         │                                                               │
│         ▼                                                               │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │              WAL Streaming (실시간 복제)                        │    │
│   │         Primary → Replicas (수십 밀리초 내 동기화)               │    │
│   └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 동작 원리

1. **FUSE 마운트**: LiteFS는 SQLite 파일을 FUSE 파일 시스템으로 마운트
2. **Primary/Replica**: 한 노드가 Primary (쓰기 가능), 나머지는 Replica (읽기 전용)
3. **WAL 스트리밍**: Primary의 Write-Ahead Log(WAL)를 실시간으로 Replica에 전파
4. **자동 Failover**: Primary 장애 시 Replica가 자동으로 Primary 승격

### 6.3 읽기/쓰기 패턴

```typescript
// 읽기: 가장 가까운 엣지 노드에서 처리 (빠름)
const form = await prisma.form.findUnique({ where: { id } });
// → 현재 리전의 SQLite Replica에서 읽기

// 쓰기: Primary 노드로 라우팅
await prisma.form.update({ where: { id }, data: { title: "New" } });
// → LiteFS가 자동으로 Primary로 요청 전달
// → Primary에서 쓰기 후 Replica로 복제 (수십 ms)
```

### 6.4 Fly.io + LiteFS vs 기존 아키텍처

| 항목              | EC2 + RDS          | Fly.io + LiteFS       |
| ----------------- | ------------------ | --------------------- |
| **복잡도**        | 높음 (여러 서비스) | 낮음 (단일 앱)        |
| **읽기 레이턴시** | 중간 (단일 리전)   | 낮음 (엣지 배포)      |
| **쓰기 레이턴시** | 낮음               | 중간 (Primary 라우팅) |
| **비용**          | ~$55/월            | ~$10-20/월            |
| **운영 부담**     | 높음               | 낮음                  |
| **확장성**        | 높음               | 중간                  |

### 6.5 Fly.io 배포 예시

```toml
# fly.toml
app = "formia"
primary_region = "nrt"  # Tokyo (Primary)

[mounts]
  source = "litefs"
  destination = "/litefs"

[env]
  DATABASE_URL = "file:/litefs/formia.db"

[[services]]
  internal_port = 3001
  protocol = "tcp"

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

```yaml
# litefs.yml
fuse:
  dir: "/litefs"

data:
  dir: "/var/lib/litefs"

lease:
  type: "consul"
  advertise-url: "http://${FLY_ALLOC_ID}.vm.${FLY_APP_NAME}.internal:20202"
  consul:
    url: "${FLY_CONSUL_URL}"
    key: "litefs/${FLY_APP_NAME}"
```

### 6.6 언제 LiteFS를 선택할까?

| 시나리오                    | LiteFS 적합 | RDS 적합 |
| --------------------------- | :---------: | :------: |
| 초기 스타트업, 소규모       |     ✅      |    -     |
| 글로벌 읽기 트래픽          |     ✅      |    -     |
| 복잡한 쿼리, 높은 쓰기 부하 |      -      |    ✅    |
| 다중 앱 공유 DB             |      -      |    ✅    |
| 관리형 백업/복구 필요       |      -      |    ✅    |

---

## 7. 권장 인프라 로드맵 (최종)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase    │  인프라              │  백엔드         │  DB         │비용  │
├───────────┼─────────────────────┼────────────────┼─────────────┼──────┤
│  1. MVP   │  로컬 개발           │  Next.js API   │  SQLite     │  $0  │
│           │                     │  Routes        │             │      │
├───────────┼─────────────────────┼────────────────┼─────────────┼──────┤
│  2. Beta  │  EC2 단일 서버       │  Next.js API   │  SQLite     │ ~$18 │
│           │  Docker Compose      │  Routes        │  (영속화)   │      │
├───────────┼─────────────────────┼────────────────┼─────────────┼──────┤
│  3. Prod  │  Vercel + EC2        │  NestJS 분리   │  PostgreSQL │ ~$55 │
│           │  (분리 배포)         │                │  (RDS)      │      │
├───────────┼─────────────────────┼────────────────┼─────────────┼──────┤
│  4. Scale │  ECS/EKS + RDS       │  NestJS        │  PostgreSQL │$100+ │
│           │  Auto Scaling        │  (컨테이너)    │  Multi-AZ   │      │
└───────────┴─────────────────────┴────────────────┴─────────────┴──────┘

💡 대안 경로: Fly.io + LiteFS 선택 시 Phase 2-3에서 ~$10-20/월로 운영 가능
```

---

## 8. 기술 스택 정리

| 계층         | Phase 1-2          | Phase 3+           |
| ------------ | ------------------ | ------------------ |
| **Frontend** | Next.js 14+        | Next.js (Vercel)   |
| **Backend**  | Next.js API Routes | NestJS (분리 서버) |
| **ORM**      | Prisma             | Prisma             |
| **Database** | SQLite             | PostgreSQL (RDS)   |
| **Auth**     | NextAuth.js        | NextAuth.js        |
| **Hosting**  | 로컬 / EC2         | Vercel + EC2/ECS   |

---

## 9. 체크리스트

### Phase 1 시작 전 확인사항

- [ ] Prisma 스키마 설계 완료 (Form Factor는 JSON 필드로)
- [ ] Next.js API Routes 구조 설계
- [ ] OAuth 제공자 선택 (Google, GitHub 등)
- [ ] 로컬 SQLite 설정

### Phase 2 전환 전 확인사항

- [ ] Docker Compose 구성
- [ ] EC2 인스턴스 선택 및 보안 그룹 설정
- [ ] SSL 인증서 (Let's Encrypt)
- [ ] 환경 변수 관리 (.env.production)

### Phase 3 전환 전 확인사항

- [ ] NestJS 서버 분리 완료
- [ ] Prisma provider를 PostgreSQL로 변경
- [ ] RDS 인스턴스 생성
- [ ] 데이터 마이그레이션 스크립트

---

## 부록: 관련 문서

- [Cloud Architecture](./cloud_architecture.md) - 전체 클라우드 아키텍처 설계
- [Form Factor Schema](./form_factor_schema.md) - Form Factor JSON 스키마 정의
