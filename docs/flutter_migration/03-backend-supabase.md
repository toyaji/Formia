# 03 — 백엔드: Supabase

Prisma/Next.js API를 Supabase(Postgres + Auth + Storage + Edge Functions + RLS)로 이관한다. 인가는 **RLS로 DB 레벨에서 강제**(기존의 흩어진 소유권 체크 결함 개선).

## 1. 스키마 (SQL migration)

```sql
-- 사용자는 auth.users(Supabase 관리) 사용. 공개 프로필이 필요하면 profiles 추가.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text, avatar_url text,
  created_at timestamptz default now()
);

create table forms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Form',
  factor jsonb not null,                 -- Form Factor v3 전체 (불투명 blob)
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on forms(owner_id, updated_at desc);

create table deployments (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null unique references forms(id) on delete cascade,
  status text not null default 'draft',  -- draft | published | archived
  short_id text unique,                  -- 공개 URL용 짧은 id
  published_at timestamptz,
  settings jsonb
);
create index on deployments(short_id);

create table responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  data jsonb not null,                   -- { blockId: answer, ... }
  metadata jsonb,                        -- ua, referrer, duration ...
  submitted_at timestamptz default now()
);
create index on responses(form_id, submitted_at desc);

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null,                    -- user | assistant | system_error | system_info
  content text not null,
  created_at timestamptz default now()
);
create index on chat_messages(session_id, created_at);
```

### BYOK 키 저장 — Supabase Vault 사용 (보안 강화)
기존은 세션 쿠키 + 하드코딩 폴백 시크릿(`default-...-change-me`)이라 위험. v3는:

```sql
-- 로그인 사용자 키: Vault(암호화 at-rest)에 저장, 참조만 테이블에.
create table user_secrets (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,                -- gemini | openai | anthropic
  vault_secret_id uuid not null,         -- vault.secrets 참조
  masked text not null,                  -- 표시용 마스킹 (sk-...abcd)
  created_at timestamptz default now(),
  primary key (user_id, provider)
);
```
- 키 평문은 **Vault에만** 존재. Edge Function이 service-role로 Vault에서 복호화하여 사용.
- **게스트 키**: 서버에 저장하지 않음(휘발성 원칙). **프록시를 거치지 않고 클라이언트가 자기 키로 provider에 직결**한다 → 게스트 키가 우리 서버·로그를 통과하지 않음(리뷰 반영, → 07 §6). `llm-proxy`는 로그인 사용자(Vault 키)와 서버 기본키 경로만 처리.
- 하드코딩 폴백 시크릿 **완전 제거**. 서버 기본키(`GEMINI_API_KEY` 등)는 Edge Function 환경변수로만.

## 2. RLS 정책 (핵심)

```sql
alter table forms enable row level security;
create policy "owner_rw_forms" on forms
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

alter table deployments enable row level security;
-- 소유자는 자기 폼 배포 관리
create policy "owner_rw_deploy" on deployments
  for all using (exists (select 1 from forms f where f.id = form_id and f.owner_id = auth.uid()));
-- 공개: published 배포는 anon도 읽기 가능(공개 폼 렌더)
create policy "public_read_published" on deployments
  for select using (status = 'published');

alter table responses enable row level security;
-- 익명 응답 제출: 대상 폼이 published일 때만 insert 허용
create policy "anon_insert_response" on responses
  for insert with check (
    exists (select 1 from deployments d
            where d.form_id = responses.form_id and d.status = 'published'));
-- 응답 조회: 폼 소유자만
create policy "owner_read_responses" on responses
  for select using (exists (select 1 from forms f where f.id = form_id and f.owner_id = auth.uid()));
```

> **⚠️ RLS는 소유권만 강제, 남용 방지는 아님 (리뷰 반영)**: 위 정책은 "published면 anon insert 허용"일 뿐이라, `short_id`만 알면 **무제한 가짜 응답 스크립팅**이 가능하다. 추가 방어가 필수:
> - **응답 제출을 Edge Function `submit-response` 뒤로** 두어 per-IP/세션 **레이트리밋 + 봇 차단(Turnstile/CAPTCHA 옵션)** + 중복 억제.
> - **크기 상한**: `data`/`metadata` jsonb 크기를 DB `check` 제약 또는 Edge에서 제한(거대 페이로드 차단).
> - 공개 폼은 anon이 `responses`에 **직접 insert 하지 않고** 이 함수 경유(직접 insert 정책은 service-role 전용으로 축소 가능).
```sql

-- chat_sessions / chat_messages: 폼 소유자만 (published와 무관)
```

> **공개 폼 factor 노출 범위**: 응답자에겐 폼 렌더에 필요한 factor만 필요. `forms` 전체를 anon에 열지 않고, **`get_public_form(short_id)` RPC**(security definer)로 published 폼의 `factor`만 반환한다. 소유자 정보·초안은 노출 금지.

```sql
create function public.get_public_form(p_short_id text)
returns jsonb
language sql
security definer
stable
set search_path = ''          -- ⚠️ 필수: security definer 권한상승 방지(스키마 한정)
as $$
  select public.published_factor(f.factor)   -- 전체 factor가 아니라 '배포용 투영'만 반환
  from public.forms f
  join public.deployments d on d.form_id = f.id
  where d.short_id = p_short_id and d.status = 'published';
$$;
```

> **리뷰 반영 — 두 가지 보강**:
> 1. `set search_path = ''` + 모든 테이블 **스키마 한정(`public.`)** — `security definer` 함수의 전형적 권한상승 footgun 차단.
> 2. **`published_factor(factor)`** 투영 함수로 **에디터 전용 필드(내부 메모·초안·`_migrationWarnings` 등)를 제거**한 뒤 반환. 작업 중 문서를 anon에 통째로 노출하지 않는다.

## 3. 인증

- Supabase Auth **Google OAuth** (기존 NextAuth Google 대체). 필요 시 GitHub 추가.
- Flutter: `supabase_flutter` 패키지, 웹은 OAuth redirect, 데스크톱은 PKCE + 딥링크/로컬 리다이렉트.
- 세션은 Supabase SDK가 관리(토큰 갱신 포함). `authControllerProvider`가 `onAuthStateChange` 구독.

## 4. AI — `llm-proxy` provider-aware 게이트웨이 (에이전트 루프는 클라이언트)

기존 `/api/ai/generate`(단발 `generateObject`)를 대체한다. 에이전트 오케스트레이션(툴콜 루프)은 클라이언트(dartantic_ai)에서 돌고, 이 Edge Function은 **키 주입 + 검증 게이트 + provider native 호출**을 담당한다(상세 → 07 §6).

**요청**: dartantic가 만든 chat 요청(messages·tools·model·stream) + (로그인이면) JWT.
**처리**:
1. JWT 검증 → `user_id`. 로그인 사용자는 **Vault에서 키 복호화**. 없으면 서버 기본키(env). 게스트는 **여기 오지 않음**(클라이언트가 provider 직결, → §1).
2. **적대적 클라이언트 가정 검증**: 모델 allowlist, 컨텍스트/툴 상한, 사용자별 쿼터(초과 429), 서버 기본키 월 비용 하드캡.
3. **provider native function-calling API**로 호출·SSE 중계. ⚠️ **Gemini OpenAI-호환 스트리밍+툴콜 버그** 회피 위해 Gemini native 사용(→ 07 §2).
4. 요청 **바디 로깅 금지**(구조화 로그 allowlist). 키는 응답·로그에 남기지 않음. **하드코딩 폴백 시크릿 없음.**

**툴 실행·검증**: 클라이언트에서 `툴 = FormCommand`로 실행되고, `form_factor` 검증기가 불변식/잠금/그래프 정합을 강제한다(최종 방어선).

## 5. 배포 & 응답 수집 (zero-cost)

- **배포(publish)**: 소유자가 `deployments` upsert(`status=published`, `short_id` 생성). RPC 또는 SDK. 기존 `/api/forms/[id]/publish` 대체.
- **공개 폼 조회**: Jaspr 공개 앱이 `get_public_form(short_id)` RPC(anon key)로 factor 로드 → 렌더(→ 04 문서).
- **응답 제출**: 공개 앱이 **Edge Function `submit-response` 경유**(레이트리밋·크기제한·봇차단, → §2). anon 직접 insert 정책은 축소. 대용량 파일은 Supabase Storage 버킷(공개 폼 전용, 서명 업로드).
- **호스팅**: 공개 폼(Jaspr) 정적/SSR 산출물을 무료 티어(Cloudflare Pages / Deno Deploy / Vercel)에 배포. Supabase 무료 티어와 합쳐 zero-cost 목표 지향.

> **⚠️ 무료 티어 한계 명시(리뷰 반영)**: Supabase 무료 티어는 DB 용량·월 egress·비활성 시 프로젝트 일시중지 제한이 있고, RLS/Vault/Edge/RPC 로직은 **Supabase 종속적**(Port 추상화는 앱만 커버, 백엔드 로직은 이식 부담). "zero-cost"는 초기 목표이며, 응답량 증가 시 유료 전환 임계를 사전에 파악한다.

## 6. 응답 Export & 분석 (리뷰 반영 — 폼 제품의 핵심 기능)

레거시에 응답 저장은 있었으나 **export/분석 UI가 없었다**. v3는 이를 1급 기능으로 포함한다.
- **Export**: 소유자가 응답을 **CSV / XLSX** 로 내보내기. 블록 스키마(질문 라벨) 기준으로 컬럼 매핑. 대량은 Edge Function으로 스트리밍 생성.
- **응답 대시보드**: 목록/상세 열람, 제출 시각·메타(referrer/duration), 필터.
- **기본 분석**: 완료율, 문항별 응답 분포(choice/rating 집계), 이탈 지점(페이지별 drop-off). Postgres 집계 쿼리(RPC)로 계산.
- (선택) 외부 추적: 레거시의 `tracking` 시크릿(GA4/Mixpanel) 슬롯은 **의도적으로 후속**으로 미룸(초기 스코프 축소). 필요 시 `user_secrets`에 `category='tracking'` 확장.

## 7. 레거시 데이터 이관

- 기존 `dev.db`(SQLite) / 운영 DB의 `Form.factor`(v2 JSON)를 **v2→v3 마이그레이터**(→ 01 §4, **무손실 보장**)로 변환 후 `forms.factor`에 적재하는 일회성 스크립트(`supabase/scripts/import_legacy.dart`).
- 사용자 계정은 OAuth 재로그인으로 재생성(이메일 매칭). 키(UserSecret)는 보안상 재입력 유도(이관하지 않음).
