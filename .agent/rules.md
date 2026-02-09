# Formia Project Rules & Guidelines

Before starting any task in this codebase, the AI Agent must follow the **토큰 절약 원칙**.

## 🚨 토큰 절약: 선택적 문서 읽기

### 절대 하지 말 것

- ❌ 모든 설계 문서를 매 요청마다 읽기
- ❌ 단순 작업에 대규모 문서 읽기

### 반드시 할 것

- ✅ **먼저 `docs/INDEX.md` 읽기** (문서 색인)
- ✅ 작업 유형에 맞는 **필요한 문서만** 선택적으로 읽기
- ✅ 단순 버그 수정/텍스트 변경은 문서 읽기 생략

---

## 📂 문서 구조

```
docs/
├── INDEX.md              ← 🔑 먼저 이것부터 읽기!
├── architecture.md       (~4KB)  전체 구조
├── cloud_architecture.md (~17KB) 클라우드/인증/배포
├── infrastructure.md     (~26KB) 인프라/DB
├── form_factor_schema.md (~3KB)  폼 스키마
├── ai_interaction_protocol.md    AI 프로토콜
├── code_design_patterns.md       코드 패턴
├── design_tokens.md              디자인 토큰
├── ui_ux_design.md               UI/UX
├── testing_strategy.md           테스트 전략
└── product_requirements.md       제품 요구사항
```

---

## 🎯 작업별 필수 문서 (Quick Reference)

| 작업 유형        | 필수 문서                                             |
| ---------------- | ----------------------------------------------------- |
| UI 스타일        | `design_tokens.md`                                    |
| UI 컴포넌트      | `design_tokens.md`, `ui_ux_design.md`                 |
| 블록/페이지 수정 | `form_factor_schema.md`                               |
| AI 기능          | `ai_interaction_protocol.md`, `form_factor_schema.md` |
| 백엔드 API       | `cloud_architecture.md` (Sec 4-5)                     |
| DB 스키마        | `infrastructure.md` (Sec 5)                           |
| 인증             | `cloud_architecture.md` (Sec 4)                       |
| 테스트           | `testing_strategy.md`                                 |
| 새 기능 설계     | `INDEX.md` → 관련 문서들                              |

---

## 🛠 핵심 원칙

1. **Documentation First**: 설계 문서 확인 후 구현
2. **Schema-Driven**: 폼 변경 = Form Factor 스키마 변경
3. **Local-First**: 로컬 데이터 우선, BYOK
4. **Form Factor는 JSON으로 저장**: DB 스키마와 폼 구조 분리
5. **Araform Aesthetic**: 깔끔하고 현대적인 미니멀 디자인
6. **Step-wise Execution**: 마이크로 스텝 단위 작업
7. **Port-Adapter Integrity**: Repository 인터페이스로 영속성 분리

---

## 📝 상세 가이드

더 자세한 가이드는 `.agent/skills/formia-context/SKILL.md` 참조.
