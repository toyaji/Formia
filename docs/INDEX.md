# Formia Design Documents Index

> 이 문서는 모든 설계 문서의 색인 역할을 합니다.
> Agent는 이 문서를 먼저 읽고, **필요한 문서만 선택적으로** 읽어야 합니다.

## 📋 문서 목록 및 요약

| 문서                           | 크기  | 핵심 내용                                              | 언제 읽어야 하나?              |
| ------------------------------ | ----- | ------------------------------------------------------ | ------------------------------ |
| **architecture.md**            | ~10KB | Editor/Service 레이어 분리, AI Port, 시스템 다이어그램 | 전체 구조 이해 필요 시         |
| **cloud_architecture.md**      | ~17KB | 클라우드/인증/배포 설계                                | 백엔드, 인증, 배포 작업 시     |
| **infrastructure.md**          | ~26KB | 인프라, DB, 서버 배포                                  | 인프라, DevOps 작업 시         |
| **form_factor_schema.md**      | ~3KB  | Form Factor JSON 스키마                                | 폼 구조/블록 수정 시           |
| **ai_interaction_protocol.md** | ~2KB  | AI 응답 포맷, JSON Patch                               | AI 기능 수정 시                |
| **code_design_patterns.md**    | ~5KB  | 레이어 아키텍처, Port/Adapter 패턴, AI Port            | 새 기능 설계 시                |
| **design_tokens.md**           | ~2KB  | 폰트, 색상, 스타일                                     | UI 스타일 수정 시              |
| **ui_ux_design.md**            | ~2KB  | 3-패널 레이아웃, UX                                    | UI 컴포넌트 수정 시            |
| **testing_strategy.md**        | ~2KB  | 테스트 전략                                            | 테스트 작성 시                 |
| **security.md**                | ~24KB | BYOK 키 보안, 크로스플랫폼 동기화, Analytics 키        | AI 키, 보안, Analytics 연동 시 |
| **product_requirements.md**    | ~1KB  | 제품 요구사항                                          | 기능 기획 시                   |
| **design_system.md**           | ~2KB  | UX/UI 규칙, 커스텀 툴팁 사용법                         | UI/UX 및 디자인 가이드 필요 시 |
| **zero_cost_publishing_architecture.md** | ~3KB | $0 비용 배포 및 응답 수집 전략                       | 배포 기능 구현 시작 시         |

---

## 🎯 작업 유형별 필수 문서

### 1. UI/프론트엔드 작업

```
필수: design_tokens.md, ui_ux_design.md
선택: form_factor_schema.md (블록 관련 시)
```

### 2. Form Factor / 블록 수정

```
필수: form_factor_schema.md
선택: ai_interaction_protocol.md (AI 연동 시)
```

### 3. AI Agent 기능

```
필수: ai_interaction_protocol.md, form_factor_schema.md
선택: security.md (API 키 관리), architecture.md (AI Port 설계)
```

### 4. 백엔드/API 작업

```
필수: cloud_architecture.md (Section 4-6)
선택: infrastructure.md (DB/백엔드 전환 시), security.md (보안 정책)
```

### 5. 인프라/배포

```
필수: infrastructure.md, zero_cost_publishing_architecture.md
선택: cloud_architecture.md
```

### 6. 인증/로그인

```
필수: cloud_architecture.md (Section 4), security.md
```

### 7. 테스트 작성

```
필수: testing_strategy.md
선택: 해당 기능의 문서
```

### 8. 새 기능 설계

```
필수: product_requirements.md, code_design_patterns.md
선택: architecture.md
```

---

## ⚠️ 토큰 절약 가이드

### 읽지 않아도 되는 경우

- **단순 버그 수정**: 해당 코드 파일만 확인
- **스타일 미세 조정**: design_tokens.md만 참조
- **텍스트 변경**: 문서 불필요
- **리팩토링**: code_design_patterns.md만

### 전체 문서 읽기가 필요한 경우

- 새로운 대규모 기능 추가
- 아키텍처 변경 제안
- 프로젝트 처음 이해

---

## 📐 문서 구조 규칙

### 각 문서의 섹션 번호

문서 내에서 특정 섹션만 필요한 경우, 섹션 번호로 참조:

```
cloud_architecture.md#4  → 인증 시스템
cloud_architecture.md#5  → 폼 배포 아키텍처
cloud_architecture.md#6  → DB 스키마 (Prisma)
infrastructure.md#3      → 백엔드 전환 전략 (Next.js → NestJS)
infrastructure.md#5      → Editor/Service 레이어 분리 원칙
infrastructure.md#6      → Fly.io + LiteFS
```

### 문서 업데이트 시 규칙

1. INDEX.md의 요약/크기 업데이트
2. 관련 문서 간 상호 참조 유지
3. 섹션 번호 변경 시 INDEX 업데이트

---

## 🔗 문서 간 의존성

```
product_requirements.md
         │
         ▼
    architecture.md ─────────────────────┐
         │                               │
    ┌────┴────┬─────────┬───────┐       │
    ▼         ▼         ▼       ▼       ▼
form_factor  ai_inter  code_   cloud_   infrastructure
_schema.md   action    design  architecture  .md
             _protocol patterns .md
             .md       .md
    │                          │
    ▼                          ▼
design_    ui_ux_     testing_
tokens.md  design.md  strategy.md
```

---

_마지막 업데이트: 2026-02-11_
