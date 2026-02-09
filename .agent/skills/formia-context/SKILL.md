# Formia Development Guide

---

## description: Formia 프로젝트 개발 시 설계 문서 참조 가이드

This skill ensures that the agent follows the project-specific rules, architecture, and design philosophy of Formia.

## 🚨 중요: 토큰 절약 원칙

**모든 문서를 매번 읽지 마세요!** 다음 규칙을 따르세요:

1. **먼저 `docs/INDEX.md` 읽기** - 작업 유형에 맞는 필요 문서만 확인
2. **작업 유형에 따라 필요한 문서만 선택적으로 읽기**
3. **단순 작업은 문서 읽기 불필요** (버그 수정, 텍스트 변경 등)

---

## 📂 작업 유형별 필수 문서

### UI/프론트엔드 작업

```
필수: docs/design_tokens.md, docs/ui_ux_design.md
블록 관련: + docs/form_factor_schema.md
```

### Form Factor / 블록 수정

```
필수: docs/form_factor_schema.md
AI 연동: + docs/ai_interaction_protocol.md
```

### AI Agent 기능

```
필수: docs/ai_interaction_protocol.md, docs/form_factor_schema.md
```

### 백엔드/API 개발

```
필수: docs/cloud_architecture.md (Section 4-5만)
DB 관련: + docs/infrastructure.md (Section 5만)
```

### 인프라/배포

```
필수: docs/infrastructure.md
```

### 인증/로그인

```
필수: docs/cloud_architecture.md (Section 4만)
```

### 테스트 작성

```
필수: docs/testing_strategy.md
```

### 새 기능 설계

```
필수: docs/product_requirements.md, docs/code_design_patterns.md
대규모: + docs/architecture.md
```

---

## ⚡ 빠른 참조: 문서 읽기 결정 트리

```
작업이 뭔가?
    │
    ├─ 버그 수정 → 문서 불필요, 코드만 확인
    │
    ├─ 스타일 변경 → design_tokens.md만
    │
    ├─ 텍스트 변경 → 문서 불필요
    │
    ├─ 블록 수정 → form_factor_schema.md
    │
    ├─ UI 컴포넌트 → design_tokens.md + ui_ux_design.md
    │
    ├─ AI 기능 → ai_interaction_protocol.md + form_factor_schema.md
    │
    ├─ 백엔드 API → cloud_architecture.md (Section 4-5)
    │
    ├─ DB 스키마 → infrastructure.md (Section 5)
    │
    └─ 새 기능 설계 → INDEX.md 확인 후 관련 문서들
```

---

## 🛠 핵심 원칙 (항상 기억)

1. **Schema-Driven**: 폼 변경은 Form Factor 스키마를 통해서만
2. **Local-First**: 데이터는 로컬 우선, BYOK (Bring Your Own Key)
3. **Form Factor는 JSON**: DB에 JSON으로 저장, 세부 구조 변경이 DB 스키마에 영향 없음
4. **Araform Aesthetic**: 깔끔하고 현대적인 미니멀 디자인
5. **Port-Adapter**: 영속성 로직은 Repository 인터페이스로 분리

---

## 📋 체크리스트

작업 전:

- [ ] INDEX.md에서 필요 문서 확인
- [ ] 필요한 문서만 선택적으로 읽기
- [ ] `.agent/rules.md` 원칙 준수

작업 후:

- [ ] 관련 테스트 실행
- [ ] 설계 문서 업데이트 필요 시 INDEX.md도 함께 업데이트
