# 04 — 공개 폼 렌더러 (Jaspr)

`apps/public_form`. 배포된 폼(`/p/<shortId>`)을 **경량 HTML**로 렌더하고 익명 응답을 수집한다. 에디터와 **동일한 `form_factor` 패키지**를 소비한다.

## 1. 왜 별도 앱인가
- 공개 폼은 SEO·초기 로딩·접근성·모바일 브라우저 자동완성이 핵심 → Flutter 캔버스 부적합.
- Jaspr는 Dart로 실제 DOM(HTML/CSS)을 SSR/SSG → 위 요구를 충족하면서 도메인 코드는 재사용.

## 2. 렌더 파이프라인

```
요청 /p/<shortId>
   → (SSR) Supabase RPC get_public_form(shortId) 로 factor(jsonb) 로드
   → FormFactor.fromJson (form_factor 패키지, 공유)
   → PageRenderer(page) → BlockRenderer(block)  // sealed switch, HTML 위젯
   → 초기 HTML 응답 (SEO/빠른 페인트)
   → 클라이언트 하이드레이션: 입력·검증·분기(LogicEvaluator)·제출
```

- **BlockRenderer(공개용)**: `sealed BlockContent` 를 switch 하여 각 타입을 접근성 있는 HTML 폼 컨트롤로 렌더(`<label>`, `<input>`, `<textarea>`, fieldset/radio 등). 자동완성 속성(`autocomplete`) 부여.
- **분기/표시**: 에디터와 **동일한 `LogicEvaluator`** 로 페이지 이동·블록 표시 계산 → 동작 일관성.
- 다중 페이지 폼은 단계 진행(progress) + 조건 분기 지원.

## 3. 응답 제출
- 클라이언트에서 검증(`FormFactorValidator`의 검증 규칙 재사용) 후, `ResponseRepository.submit(shortId, answers, meta)` 호출.
- 구현: **Edge Function `submit-response` 경유**(레이트리밋·크기제한·봇차단, → 03 §2·§5). anon 직접 insert 아님.
- 파일 업로드: Supabase Storage 서명 업로드 후 응답에 경로 저장.
- 제출 완료 시 종료 페이지(ending role) 렌더. 조건부 조기 종료(early-exit ending) 지원.

## 4. 테마
- `theme.tokens`(primary/background/surface/radius 등)를 CSS 변수로 매핑 → 폼별 브랜딩. 다크모드 지원.
- 에디터 프리뷰와 시각적 동등성을 목표로 하되, 픽셀 100% 일치가 아니라 **동일 토큰·동일 레이아웃 규칙** 공유로 근접시킨다.

## 5. 배포/호스팅
- Jaspr 빌드 산출물(정적 + 서버 엔트리)을 무료 티어(Cloudflare Pages / Deno Deploy / Vercel)에 배포.
- 라우트: `/p/:shortId`. SSR로 초기 렌더, 이후 CSR 하이드레이션.
- 환경변수: Supabase URL + **anon key만**(service-role 절대 금지). 데이터 접근은 RLS/RPC로 제한.

## 6. 공유 경계
- `apps/public_form` 는 `form_factor` 와, 응답 제출용 최소 `formia_data`(ResponseRepository의 anon 구현)만 의존.
- 에디터 전용 코드(명령/이력/AI/DnD)는 **의존 금지**. 공개 앱 번들을 가볍게 유지.
