# Security Architecture: Formia

> 이 문서는 사용자 API 키(BYOK) 관리, Analytics 키 보안, 크로스 플랫폼 키 동기화, 인증, 데이터 보호 등 Formia의 보안 설계를 다룹니다.

## 1. BYOK (Bring Your Own Key) — 핵심 보안 과제

### 1.1 왜 BYOK인가?

Formia는 **AI Agent 비용을 사용자가 자신의 API 키로 부담**하는 모델입니다.

```
일반 SaaS 모델:        Formia BYOK 모델:
사용자 → 서비스 → AI   사용자 → 서비스 → AI
         (비용 부담)          (사용자 키로 호출)
```

**장점:**

- 서비스 운영자의 AI 비용 제로 → 초기 서비스 좌초 방지
- 사용자가 자신의 할당량/모델 선택 가능
- 오픈소스 프로젝트로서 투명성 보장

**보안 의무:**

- 사용자의 API 키는 **금전적 가치가 있는 자산** (도용 시 사용자에게 과금)
- 키 유출 = 직접적 금전 피해 → **최고 수준의 보안** 필요

### 1.2 사용자 키 분류 체계

Formia가 다루는 사용자 키는 **보안 등급이 다릅니다**. 모든 키를 동일하게 취급하면 과보호 또는 과소보호가 됩니다.

```
┌──────────────────────────────────────────────────────────────────────┐
│  사용자 키 분류                                                      │
│                                                                      │
│  🔴 Secret Keys (서버 사이드, 절대 노출 금지)                        │
│  ├── AI API Keys: OpenAI, Anthropic, Gemini                         │
│  │   → 유출 시 직접 금전 피해. 최고 수준 보안 필요.                  │
│  │   → 서버 프록시를 통해서만 사용. 브라우저에 노출 안 됨.           │
│  │                                                                   │
│  🟡 Tracking IDs (클라이언트 사이드, 배포 폼에 삽입)                 │
│  ├── GA4 Measurement ID (G-XXXXXXXXXX)                               │
│  ├── Mixpanel Project Token                                          │
│  ├── Amplitude API Key                                               │
│  │   → 배포된 폼 HTML/JS에 삽입 → 본질적으로 공개.                   │
│  │   → 보호 대상은 키 자체가 아니라 "설정 권한".                     │
│  │                                                                   │
│  🟠 Analytics Secret Keys (서버 사이드, 일부 플랫폼)                 │
│  ├── Mixpanel API Secret (데이터 내보내기용)                         │
│  ├── Amplitude Secret Key (서버 사이드 이벤트)                       │
│      → AI 키와 동급 보안 적용. Secret Keys로 취급.                   │
└──────────────────────────────────────────────────────────────────────┘
```

| 분류                     | 예시                          |   유출 시 영향   | 보안 등급 | 처리 방식                        |
| ------------------------ | ----------------------------- | :--------------: | :-------: | -------------------------------- |
| 🔴 **Secret Keys**       | OpenAI API Key, Anthropic Key |    금전 피해     |   최고    | Envelope Encryption, 서버 프록시 |
| 🟠 **Analytics Secrets** | Mixpanel API Secret           |   데이터 유출    |   높음    | Secret Keys와 동일 처리          |
| 🟡 **Tracking IDs**      | GA4 ID, Mixpanel Token        | 스팸 데이터 주입 |   중간    | 서버에 암호화 저장, 배포 시 삽입 |

---

## 2. 환경별 키 관리 전략

### 2.1 Desktop (Tauri) — 로컬 보안 저장

```
┌───────────────────────────────────────────────────────────┐
│  Desktop App (Tauri)                                      │
│                                                           │
│  사용자가 키 입력                                          │
│       │                                                   │
│       ▼                                                   │
│  ┌─────────────────────┐                                  │
│  │  OS Secure Storage  │  ← 로컬 캐시 (오프라인용)        │
│  │  ┌───────────────┐  │                                  │
│  │  │ macOS Keychain│  │                                  │
│  │  │ Win Credential│  │                                  │
│  │  │ Linux Secret  │  │                                  │
│  │  └───────────────┘  │                                  │
│  └──────────┬──────────┘                                  │
│             │                                             │
│             ├──▶ AI API 직접 호출 (오프라인에서도 동작)    │
│             │                                             │
│             └──▶ 로그인 상태라면? → 서버에 동기화 (↓)     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- **저장**: OS 네이티브 보안 저장소 (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **호출**: Tauri의 Rust 사이드에서 직접 AI API 호출 → **키가 Formia 서버를 절대 경유하지 않음**
- **메모리**: 사용 후 즉시 메모리에서 클리어
- **동기화**: 로그인 상태라면 서버에 암호화하여 동기화 (Section 6 참조)
- **보안 수준**: ★★★★★ (최고. OS 수준 암호화, 서버 무관여)

### 2.2 Web Client — 4가지 보안 모드

웹 환경에서 API 키를 다루는 것은 Desktop보다 복잡합니다. **대부분의 AI API (OpenAI, Anthropic, Google)는 브라우저에서 직접 호출(CORS)을 지원하지 않으므로**, 서버 프록시가 필수입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│  Web Client                                                     │
│                                                                 │
│  사용자가 키 입력  →  보안 모드 선택                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Mode A: Session-Only (기본값, 가장 안전)                 │    │
│  │ - 키를 서버에 저장하지 않음                              │    │
│  │ - 암호화된 세션에만 유지                                 │    │
│  │ - 브라우저 탭 닫으면 키 사라짐                           │    │
│  │ - 매 세션마다 키 재입력 필요                             │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ Mode B: Encrypted Storage (편의성 + 보안 균형)           │    │
│  │ - 키를 서버에 암호화하여 저장 (AES-256-GCM)             │    │
│  │ - 사용자 비밀번호에서 파생된 키로 이중 암호화            │    │
│  │ - 다음 로그인 시 비밀번호 입력으로 복호화                │    │
│  │ - 서버 운영자도 평문 키에 접근 불가                      │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ Mode C: Server-Managed (팀/기업용, 향후)                 │    │
│  │ - 조직 관리자가 키를 등록                                │    │
│  │ - KMS (AWS KMS 등)로 암호화                             │    │
│  │ - 팀원은 키 없이 AI 사용 가능                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  모든 모드 공통:                                                 │
│  키 → HTTPS → Backend Proxy → AI API → 결과 반환               │
│  (키는 응답에 절대 포함하지 않음)                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 웹 키 관리 상세 설계

### 3.1 Mode A: Session-Only (기본값)

가장 안전한 모드. 키가 영구 저장되지 않습니다.

```typescript
// 클라이언트: 키 제출
const submitKey = async (provider: string, apiKey: string) => {
  await fetch("/api/ai/session-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, apiKey }),
    credentials: "include", // HttpOnly Cookie 포함
  });
  // 키는 서버 세션(메모리/Redis)에만 저장됨
  // 브라우저에는 키가 남지 않음
};
```

```typescript
// 서버: 세션에만 저장 (DB 저장 안 함)
app.post("/api/ai/session-key", authMiddleware, (req, res) => {
  const { provider, apiKey } = req.body;

  // 세션에만 저장 (Redis/메모리)
  req.session.aiKeys = {
    ...req.session.aiKeys,
    [provider]: encrypt(apiKey, SESSION_ENCRYPTION_KEY),
  };

  res.json({ success: true });
  // ⚠️ 키를 응답에 절대 포함하지 않음
});
```

| 항목          | 상세                                               |
| ------------- | -------------------------------------------------- |
| **저장 위치** | 서버 세션 (메모리/Redis). DB 저장 안 함            |
| **수명**      | 세션 종료 (탭 닫기/로그아웃) 시 자동 삭제          |
| **서버 접근** | AI 호출 시에만 복호화. 호출 후 즉시 클리어         |
| **장점**      | 영구 저장 없음. 서버 침해 시에도 과거 키 노출 없음 |
| **단점**      | 매 세션마다 키 재입력 필요                         |

### 3.2 Mode B: Encrypted Storage (편의성 모드)

사용자가 키를 암호화하여 서버에 저장합니다. **Envelope Encryption** 적용.

```
┌──────────────────────────────────────────────────────┐
│  Envelope Encryption 구조                             │
│                                                      │
│  사용자 비밀번호 (클라이언트에서만 존재)               │
│       │                                              │
│       ▼  PBKDF2 (100,000 iterations)                 │
│  ┌────────────────┐                                  │
│  │ User DEK       │  ← 사용자 비밀번호에서 파생된 키  │
│  │ (Data Enc Key) │     서버에 저장하지 않음          │
│  └───────┬────────┘                                  │
│          │  AES-256-GCM                              │
│          ▼                                           │
│  ┌────────────────┐                                  │
│  │ Encrypted      │  ← DB에 저장되는 값               │
│  │ API Key Blob   │     서버 운영자도 복호화 불가     │
│  └────────────────┘                                  │
│                                                      │
│  복호화 플로우:                                       │
│  1. 사용자가 비밀번호 입력 (클라이언트)                │
│  2. 클라이언트에서 DEK 파생                           │
│  3. 클라이언트에서 복호화                             │
│  4. 복호화된 키를 HTTPS로 서버에 전송 (일회성)        │
│  5. 서버가 AI API 호출 후 키 메모리에서 즉시 삭제     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

```typescript
// DB 스키마 (Service Layer)
model UserSecret {
  id          String   @id @default(cuid())

  userId      String
  provider    String   // "gemini" | "openai" | "anthropic"
  encryptedKey String  // AES-256-GCM 암호화된 blob
  iv          String   // Initialization Vector
  salt        String   // PBKDF2 salt
  keyVersion  Int      @default(1)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, provider])
  @@map("user_secrets")
}
```

**핵심 보안 속성:**

- 서버 DB에 저장되지만 **서버 운영자도 복호화 불가** (사용자 비밀번호 필요)
- DB 유출 시에도 암호화된 blob만 노출 — 사용자 비밀번호 없이 무용
- 복호화는 클라이언트에서 수행. 서버는 평문 키를 일시적으로만 보유 (AI 호출 시)

### 3.3 AI Proxy 엔드포인트 보안

```typescript
// /api/ai/generate — AI 프록시 엔드포인트
app.post("/api/ai/generate", authMiddleware, rateLimiter, async (req, res) => {
  const { prompt, formFactor, provider } = req.body;

  // 1. 키 획득 (Mode에 따라)
  let apiKey: string;
  if (req.session.aiKeys?.[provider]) {
    // Mode A: 세션에서 가져오기
    apiKey = decrypt(req.session.aiKeys[provider], SESSION_ENCRYPTION_KEY);
  } else if (req.body.encryptedKey) {
    // Mode B: 클라이언트에서 복호화된 키를 일회성으로 전송
    apiKey = req.body.apiKey; // HTTPS로 전달됨
  } else {
    return res.status(401).json({ error: "API key required" });
  }

  try {
    // 2. AI API 호출
    const result = await aiProviderAdapter.generate(provider, apiKey, {
      prompt,
      context: formFactor,
    });

    // 3. 결과 반환
    res.json({ patches: result.patches, explanation: result.explanation });
  } finally {
    // 4. ⚠️ 키를 메모리에서 즉시 클리어
    apiKey = "";
  }
});
```

---

## 4. 보안 정책 (전체 적용)

### 4.1 키 관련 절대 규칙

| 규칙                  | 설명                                                                           |
| --------------------- | ------------------------------------------------------------------------------ |
| **Never Log**         | API 키를 로그, 콘솔, 에러 리포트에 절대 포함하지 않음                          |
| **Never Return**      | API 키를 API 응답에 절대 포함하지 않음 (저장 확인 시에도 마스킹: `sk-...xxxx`) |
| **Never Git**         | `.env`, `.env.local`, `.env.test`는 `.gitignore` 필수                          |
| **HTTPS Only**        | 키 전송은 반드시 HTTPS (TLS 1.2+). HTTP 요청 거부                              |
| **Minimal Lifetime**  | 키는 사용 직후 메모리에서 클리어. 필요한 순간에만 존재                         |
| **No Client Storage** | 브라우저의 localStorage, sessionStorage에 평문 키 저장 금지                    |

### 4.2 서버 보안 미들웨어

```typescript
// 보안 헤더 (모든 응답에 적용)
const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
```

### 4.3 Rate Limiting

AI 프록시 엔드포인트에는 반드시 Rate Limiting을 적용합니다:

| 엔드포인트                 | 제한                 | 이유                |
| -------------------------- | -------------------- | ------------------- |
| `POST /api/ai/generate`    | 30 req/min per user  | 키 남용 방지        |
| `POST /api/ai/session-key` | 5 req/min per user   | 키 등록 남용 방지   |
| `POST /api/responses`      | 100 req/min per form | 응답 수집 남용 방지 |

### 4.4 입력 검증 (Zod)

모든 API 입력은 Zod로 검증합니다:

```typescript
import { z } from "zod";

const sessionKeySchema = z.object({
  provider: z.enum(["gemini", "openai", "anthropic"]),
  apiKey: z
    .string()
    .min(10, "API key too short")
    .max(200, "API key too long")
    .regex(/^[a-zA-Z0-9_\-]+$/, "Invalid characters in API key"),
});

const aiGenerateSchema = z.object({
  prompt: z.string().min(1).max(10000),
  provider: z.enum(["gemini", "openai", "anthropic"]),
  formFactor: z.record(z.unknown()), // Form Factor JSON
});
```

---

## 5. 환경별 보안 비교

```
┌──────────────────────────────────────────────────────────────────┐
│  보안 수준 비교                                                   │
│                                                                  │
│  Desktop (Tauri)          Web (Session-Only)    Web (Encrypted)  │
│  ─────────────────        ─────────────────     ────────────────  │
│  키 저장: OS Keychain     키 저장: 세션 메모리   키 저장: 암호화 DB│
│  AI 호출: 로컬 직접       AI 호출: 서버 프록시   AI 호출: 서버     │
│  서버 경유: ❌ 없음        서버 경유: ✅ 일시적   서버 경유: ✅     │
│  오프라인: ✅              오프라인: ❌           오프라인: ❌      │
│  키 영속: ✅ (안전)        키 영속: ❌ (세션)     키 영속: ✅       │
│                                                                  │
│  보안: ★★★★★             보안: ★★★★☆           보안: ★★★☆☆      │
│  편의: ★★★★★             편의: ★★★☆☆           편의: ★★★★★      │
│                                                                  │
│  권장: 가장 안전           권장: 기본값            권장: 선택적     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. 크로스 플랫폼 키 동기화

### 6.1 문제

사용자가 Desktop에서 API 키를 설정한 뒤, Web에서 로그인하면 키를 다시 입력해야 합니다.
반대로 Web에서 설정한 키가 Desktop에서는 없습니다. Figma처럼 어디에서든 같은 환경이 되어야 합니다.

```
현재 (동기화 없음):                    목표 (동기화):

Desktop: Key ✅                        Desktop: Key ✅ ←┐
Web:     Key ❌ ← 다시 입력?           Web:     Key ✅ ←┤ 서버에서 동기화
다른 PC: Key ❌ ← 또 다시?             다른 PC: Key ✅ ←┘
```

### 6.2 해결: 서버를 Single Source of Truth로

로그인한 사용자는 **서버에 암호화된 키를 저장**하고, 어떤 환경에서든 동기화합니다.

```
┌──────────────────────────────────────────────────────────────────────┐
│  크로스 플랫폼 키 동기화 아키텍처                                     │
│                                                                      │
│              ┌──────────────────────┐                                │
│              │   Server (Encrypted) │  ← Single Source of Truth      │
│              │   UserSecret table   │                                │
│              └──────────┬───────────┘                                │
│           ┌─────────────┼─────────────┐                              │
│           │             │             │                              │
│   ┌───────▼──────┐ ┌───▼────────┐ ┌──▼──────────┐                   │
│   │ Desktop A    │ │  Web       │ │ Desktop B   │                   │
│   │ (macOS)      │ │  Client    │ │ (Windows)   │                   │
│   │              │ │            │ │             │                   │
│   │ OS Keychain  │ │ 세션 메모리 │ │ Credential  │                   │
│   │ (로컬 캐시)  │ │ (임시)     │ │ Manager     │                   │
│   └──────────────┘ └────────────┘ └─────────────┘                   │
│                                                                      │
│   동기화 규칙:                                                       │
│   1. 로그인 시 → 서버에서 암호화된 키 다운로드 → 로컬에 캐시         │
│   2. 키 변경 시 → 서버에 업로드 → 다른 디바이스는 다음 세션에 반영   │
│   3. 오프라인 시 → 로컬 캐시 사용 (Desktop만)                       │
│   4. 충돌 시 → 최신 updatedAt 기준 (Last Write Wins)                │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 동기화 플로우

```typescript
// 로그인/앱 시작 시 키 동기화
async function syncKeysOnLogin(userId: string): Promise<void> {
  // 1. 서버에서 사용자의 암호화된 키 목록 가져오기
  const serverKeys = await fetch("/api/secrets/list", {
    headers: { Authorization: `Bearer ${token}` },
  });
  // 응답: [{ provider, encryptedKey, iv, salt, updatedAt }]
  // ⚠️ 평문 키는 절대 응답에 포함하지 않음

  // 2. 클라이언트에서 비밀번호로 복호화
  //    (Web: 비밀번호 입력 요청, Desktop: OS Keychain에서 비밀번호 로드)
  const dek = await deriveKey(userPassword, salt);
  const decryptedKeys = serverKeys.map((k) => ({
    provider: k.provider,
    apiKey: decrypt(k.encryptedKey, dek, k.iv),
  }));

  // 3. 환경에 따라 저장
  if (isTauri()) {
    // Desktop: OS Keychain에 캐시 (오프라인용)
    for (const key of decryptedKeys) {
      await tauriSecureStore.set(`ai_key_${key.provider}`, key.apiKey);
    }
  } else {
    // Web: 세션에만 보관
    for (const key of decryptedKeys) {
      await submitToSession(key.provider, key.apiKey);
    }
  }
}
```

### 6.4 동기화 규칙

| 시나리오                              | 동작                                                             |
| ------------------------------------- | ---------------------------------------------------------------- |
| **Desktop에서 키 설정 (로그인 상태)** | OS Keychain 저장 + 서버에 암호화 업로드                          |
| **Desktop에서 키 설정 (오프라인)**    | OS Keychain만 저장. 온라인 복귀 시 서버에 동기화                 |
| **Web에서 키 설정**                   | 서버에 암호화 저장. 다음 Desktop 로그인 시 자동 동기화           |
| **두 환경에서 동시에 다른 키 설정**   | Last Write Wins (updatedAt 기준)                                 |
| **로그아웃한 Desktop**                | OS Keychain의 키를 로컬에서만 사용. 서버 동기화 안 함            |
| **계정 삭제**                         | 서버의 UserSecret 삭제 (CASCADE). 로컬 캐시는 유저에게 삭제 안내 |

### 6.5 키 동기화 시 보안 원칙

- 서버 ↔ 클라이언트 간에는 **암호화된 blob만** 전송. 평문 키는 절대 네트워크를 타지 않음.
- 복호화는 항상 **클라이언트에서만** 수행.
- Desktop은 동기화된 키를 OS Keychain에 캐시하되, **앱 삭제/로그아웃 시 클리어**.
- 동기화 API 자체에도 Rate Limiting + Auth 필수.

---

## 7. Analytics Tracking 키 보안

### 7.1 개요

사용자가 자신의 GA4, Mixpanel, Amplitude 등을 연동하여 **배포된 폼의 진입률, 이탈률, 완료율**을 측정할 수 있습니다.

Analytics 키는 AI 키와 **보안 성격이 완전히 다릅니다**.

```
AI API Key:                          Analytics Tracking ID:
─────────────────                    ─────────────────────
서버에서만 사용                       클라이언트(브라우저)에서 사용
절대 외부 노출 금지                   배포된 폼 HTML에 삽입 → 본질적으로 공개
유출 시 금전 피해                     유출 시 스팸 데이터 주입 가능
```

### 7.2 Analytics 데이터 흐름

```
┌──────────────────────────────────────────────────────────────────┐
│  Analytics 키 lifecycle                                          │
│                                                                  │
│  1. 사용자가 설정 UI에서 Tracking ID 입력                        │
│     (예: GA4 Measurement ID "G-ABC123XYZ")                       │
│                                                                  │
│  2. 서버에 암호화 저장 (UserSecret 테이블 공유)                  │
│     provider: "ga4" | "mixpanel" | "amplitude"                   │
│     category: "tracking"                                         │
│                                                                  │
│  3. 폼 배포(Publish) 시:                                         │
│     서버가 Tracking ID를 복호화 → 배포 HTML에 삽입               │
│                                                                  │
│     <script>                                                     │
│       gtag('config', 'G-ABC123XYZ');  ← 여기 삽입                │
│     </script>                                                    │
│                                                                  │
│  4. 응답자가 폼을 열면:                                          │
│     브라우저 → GA4/Mixpanel/Amplitude 서버로 이벤트 직접 전송    │
│     (Formia 서버 무관여)                                         │
│                                                                  │
│  ⚠️ 배포된 HTML의 Tracking ID는 누구나 볼 수 있음 (공개 키)     │
│     → 이것은 GA4/Mixpanel의 설계 의도. 보안 이슈가 아님.         │
└──────────────────────────────────────────────────────────────────┘
```

### 7.3 Analytics 키의 보안 이슈와 대응

| 이슈                               | 위험                                                              | 대응                                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **배포된 폼에서 Tracking ID 노출** | 공격자가 가짜 이벤트를 전송하여 Analytics 데이터 오염             | 이는 GA4/Mixpanel의 본질적 한계. 사용자에게 "Tracking ID는 배포 폼에 공개됩니다" 경고 표시. Analytics 측 필터링 권장. |
| **Tracking ID 변경 권한**          | 다른 사용자의 폼에 자기 Tracking ID 삽입                          | Tracking ID 설정은 폼 소유자만 가능. 서버에서 ownership 검증 필수.                                                    |
| **설정 페이지에서 ID 탈취**        | XSS로 설정 UI에서 Tracking ID 읽기                                | CSP 헤더, 설정 페이지에서 ID 마스킹 표시 (예: `G-...XYZ`).                                                            |
| **Analytics Secret Key 유출**      | 서버 사이드 키 (Mixpanel API Secret 등) 유출 → 사용자 데이터 접근 | AI 키와 동일한 보안 등급 적용 (Envelope Encryption, 서버 프록시).                                                     |
| **배포 시 키 삽입 과정**           | 서버가 복호화 → HTML 생성 시 키가 일시적으로 메모리에 존재        | 배포 프로세스 완료 후 즉시 메모리 클리어. 배포 로그에 Tracking ID 기록하지 않음.                                      |

### 7.4 DB 스키마 확장

기존 `UserSecret` 테이블을 확장하여 Analytics 키도 관리합니다:

```typescript
model UserSecret {
  id           String   @id @default(cuid())

  userId       String
  provider     String   // "gemini" | "openai" | "anthropic" | "ga4" | "mixpanel" | "amplitude"
  category     String   // "ai_secret" | "tracking" | "analytics_secret"
  encryptedKey String   // AES-256-GCM 암호화된 blob
  iv           String
  salt         String
  keyVersion   Int      @default(1)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, provider])
  @@map("user_secrets")
}
```

> `category` 필드로 보안 등급을 구분합니다.
>
> - `ai_secret`: 최고 보안. 서버 프록시 필수.
> - `analytics_secret`: 높은 보안. AI 키와 동급.
> - `tracking`: 중간 보안. 배포 시 HTML에 삽입됨 (공개 키).

### 7.5 폼 배포 시 Tracking 코드 삽입

```typescript
// 배포 서비스 (Service Layer)
async function publishForm(formId: string, userId: string): Promise<string> {
  const form = await prisma.form.findUnique({ where: { id: formId } });

  // 1. 사용자의 Tracking ID 조회 (서버에서 복호화)
  const trackingSecrets = await prisma.userSecret.findMany({
    where: { userId, category: "tracking" },
  });

  // 2. 복호화 (서버 사이드 — 배포 시에만)
  const trackingIds = trackingSecrets.map((s) => ({
    provider: s.provider,
    id: serverDecrypt(s.encryptedKey, s.iv), // 서버 마스터 키로 복호화
  }));

  // 3. HTML 생성 시 삽입
  const html = generateFormHtml(form.factor, {
    analytics: trackingIds, // GA4, Mixpanel 스니펫 삽입
  });

  // 4. 메모리 클리어
  trackingIds.forEach((t) => {
    t.id = "";
  });

  return html;
}
```

### 7.6 사용자 안내 UI

Analytics 키 설정 시 다음 안내를 표시합니다:

```
┌────────────────────────────────────────────────────────────────────┐
│  ⚡ Analytics 연동 설정                                           │
│                                                                    │
│  Tracking ID를 입력하면 배포된 폼에 자동으로 삽입됩니다.           │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  GA4 Measurement ID                                         │  │
│  │  ┌──────────────────────────────────────────┐               │  │
│  │  │  G-ABC123XYZ                             │               │  │
│  │  └──────────────────────────────────────────┘               │  │
│  │                                                              │  │
│  │  ⚠️ 이 ID는 배포된 폼의 HTML에 공개적으로 포함됩니다.       │  │
│  │     이것은 GA4의 정상적인 동작 방식입니다.                   │  │
│  │                                                              │  │
│  │  💡 권장: GA4에서 데이터 필터를 설정하여                     │  │
│  │     스팸 트래픽을 필터링하세요.                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Mixpanel Project Token                                     │  │
│  │  ┌──────────────────────────────────────────┐               │  │
│  │  │  ••••••••••••••••••••                    │               │  │
│  │  └──────────────────────────────────────────┘               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│                                        [저장]  [테스트 이벤트 전송] │
└────────────────────────────────────────────────────────────────────┘
```

---

## 8. 위협 모델 및 대응

### 8.1 Secret Keys (AI API Keys, Analytics Secrets)

| 위협                   | 공격 벡터                             | 대응                                                                              |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| **XSS를 통한 키 탈취** | 악성 스크립트가 DOM에서 키를 읽음     | CSP 헤더, 키를 DOM/JS 변수에 저장하지 않음. 키 입력 후 즉시 서버 전송.            |
| **서버 메모리 덤프**   | 서버 프로세스 메모리에서 평문 키 추출 | 키 사용 후 즉시 메모리 클리어. 세션 타임아웃 설정.                                |
| **DB 유출**            | DB 백업/덤프에서 키 노출              | Envelope Encryption 적용. 사용자 비밀번호 없이 복호화 불가.                       |
| **MITM (중간자 공격)** | 네트워크에서 키 가로채기              | HTTPS 강제 (HSTS). TLS 1.2+ 요구.                                                 |
| **내부자 위협**        | 서버 운영자가 키 접근                 | Mode B에서 서버는 암호화된 blob만 저장. 평문은 일시적으로만 존재. 감사 로그 기록. |
| **브루트포스**         | 반복적 키 등록 시도                   | Rate Limiting. 계정 잠금 정책.                                                    |
| **키 재사용**          | 유출된 키로 다른 서비스 접근          | 키 스코프 가이드 제공 (최소 권한 원칙 안내).                                      |
| **동기화 API 악용**    | 대량 키 조회/변경 시도                | 동기화 API에 Rate Limiting (10 req/min per user). Auth 필수.                      |

### 8.2 Tracking IDs (GA4, Mixpanel, Amplitude)

| 위협                              | 공격 벡터                                         | 대응                                                          |
| --------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| **스팸 데이터 주입**              | 배포된 폼에서 Tracking ID 추출 → 가짜 이벤트 전송 | GA4/Mixpanel의 본질적 한계. 사용자에게 추천 필터 설정 안내.   |
| **타인의 폼에 자신의 ID 삽입**    | 폼 소유권 우회하여 Tracking ID 변경               | 서버에서 폼 소유자 검증 필수.                                 |
| **Tracking 설정 무단 변경**       | 계정 탈취 후 Tracking ID 교체 → 데이터 하이잼     | 주요 설정 변경 시 이메일 알림. 변경 이력 기록.                |
| **배포 HTML에서 스크립트 인젝션** | Tracking ID 필드에 악성 코드 삽입 시도            | 서버에서 ID 포맷 검증 (정규식). HTML 삽입 시 이스케이프 처리. |

---

## 9. 구현 우선순위

### Phase 1 (MVP)

- [x] Desktop: OS Secure Storage (Tauri plugin-store)
- [ ] Web: **Mode A (Session-Only)** 구현
- [ ] HTTPS 강제
- [ ] Rate Limiting
- [ ] Zod 입력 검증
- [ ] CSP 헤더

### Phase 2 (Beta)

- [ ] Web: **Mode B (Encrypted Storage)** 구현
- [ ] **크로스 플랫폼 키 동기화** 구현
- [ ] 키 마스킹 UI (`sk-...xxxx`)
- [ ] 키 유효성 검증 (등록 시 테스트 호출)
- [ ] 감사 로그 (키 사용 이력, 키 값 제외)

### Phase 3 (Analytics & Production)

- [ ] **Analytics Tracking ID 연동** (GA4, Mixpanel, Amplitude)
- [ ] 배포 시 Tracking 코드 자동 삽입
- [ ] Analytics Secret Keys 지원
- [ ] AWS KMS 연동 (Mode C)
- [ ] 키 로테이션 알림
- [ ] 보안 대시보드 (비정상 사용 감지)

---

## 관련 문서

- [Architecture](./architecture.md) - Editor/Service 레이어 분리 원칙
- [AI Interaction Protocol](./ai_interaction_protocol.md) - AI Agent 통신 프로토콜
- [Cloud Architecture](./cloud_architecture.md) - 인증 시스템 (Section 4)
- [Infrastructure](./infrastructure.md) - 서버 인프라 설계
- [Testing Strategy](./testing_strategy.md) - 테스트 키 관리 (Section 2)
