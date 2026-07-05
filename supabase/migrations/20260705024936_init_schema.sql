-- Formia v3 schema + RLS + public-form RPC.
-- See docs/flutter_migration/03-backend-supabase.md. Authorization is enforced
-- at the DB level via RLS (fixes the legacy scattered ownership checks).

-- ─── updated_at helper ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── profiles ─────────────────────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ─── forms ────────────────────────────────────────────────────────────────
create table public.forms (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'Untitled Form',
  factor     jsonb not null,
  version    int  not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forms_factor_size check (pg_column_size(factor) <= 1048576) -- 1MB cap
);
create index forms_owner_updated_idx on public.forms (owner_id, updated_at desc);
create trigger forms_updated_at before update on public.forms
  for each row execute function public.set_updated_at();

-- ─── deployments ──────────────────────────────────────────────────────────
create table public.deployments (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null unique references public.forms (id) on delete cascade,
  status       text not null default 'draft'
                 check (status in ('draft', 'published', 'archived')),
  short_id     text unique,
  published_at timestamptz,
  settings     jsonb,
  updated_at   timestamptz not null default now()
);
create index deployments_short_id_idx on public.deployments (short_id);
create trigger deployments_updated_at before update on public.deployments
  for each row execute function public.set_updated_at();

-- ─── responses ────────────────────────────────────────────────────────────
create table public.responses (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.forms (id) on delete cascade,
  data         jsonb not null,
  metadata     jsonb,
  submitted_at timestamptz not null default now(),
  constraint responses_data_size check (pg_column_size(data) <= 262144) -- 256KB cap
);
create index responses_form_submitted_idx on public.responses (form_id, submitted_at desc);

-- ─── chat sessions / messages ─────────────────────────────────────────────
create table public.chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  form_id    uuid not null references public.forms (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_sessions_form_idx on public.chat_sessions (form_id, created_at desc);

create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role       text not null
               check (role in ('user', 'assistant', 'system_error', 'system_info')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_session_idx on public.chat_messages (session_id, created_at);

-- ─── user_secrets (BYOK; plaintext key lives only in Supabase Vault) ────────
create table public.user_secrets (
  user_id         uuid not null references auth.users (id) on delete cascade,
  provider        text not null check (provider in ('gemini', 'openai', 'anthropic')),
  vault_secret_id uuid not null,
  masked          text not null,
  created_at      timestamptz not null default now(),
  primary key (user_id, provider)
);

-- ═══ Ownership helpers (security definer to avoid cross-table RLS grants) ══
-- Policies that reference other tables would otherwise require the caller to
-- hold privileges on those tables. These definer helpers check ownership as
-- the owner, so policies stay simple and don't leak grants.
create or replace function public.owns_form(p_form_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.forms f
    where f.id = p_form_id and f.owner_id = auth.uid());
$$;

create or replace function public.owns_session(p_session_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.chat_sessions s
    join public.forms f on f.id = s.form_id
    where s.id = p_session_id and f.owner_id = auth.uid());
$$;

-- ═══ Row Level Security ════════════════════════════════════════════════════
alter table public.profiles      enable row level security;
alter table public.forms         enable row level security;
alter table public.deployments   enable row level security;
alter table public.responses     enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.user_secrets  enable row level security;

-- profiles: self only
create policy profiles_self on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- forms: owner read/write
create policy forms_owner_rw on public.forms
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- deployments: owner manages; anyone may read a published deployment row
create policy deployments_owner_rw on public.deployments
  for all using (public.owns_form(form_id))
  with check (public.owns_form(form_id));
create policy deployments_public_read on public.deployments
  for select using (status = 'published');

-- responses: owner reads; anon insert is intentionally NOT granted here.
-- Public submissions go through the `submit-response` edge function
-- (service role) which adds rate limiting / size / bot checks (03 §2, §5).
create policy responses_owner_read on public.responses
  for select using (public.owns_form(form_id));

-- chat: owner of the parent form only
create policy chat_sessions_owner on public.chat_sessions
  for all using (public.owns_form(form_id))
  with check (public.owns_form(form_id));
create policy chat_messages_owner on public.chat_messages
  for all using (public.owns_session(session_id))
  with check (public.owns_session(session_id));

-- user_secrets: self only (plaintext never stored here anyway)
create policy user_secrets_self on public.user_secrets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══ Table privileges (RLS filters rows; GRANT enables access at all) ══════
-- RLS without a matching GRANT denies everything, so grant the base privileges
-- to the API roles and let the policies above do row-level filtering.
grant usage on schema public to anon, authenticated, service_role;

-- service_role (edge functions) bypasses RLS but still needs base table grants.
grant select, insert, update, delete on
  public.forms, public.deployments, public.responses,
  public.chat_sessions, public.chat_messages, public.profiles, public.user_secrets
  to service_role;

grant select, insert, update, delete on public.forms         to authenticated;
grant select, insert, update, delete on public.deployments   to authenticated;
grant select                          on public.deployments   to anon; -- published read
grant select                          on public.responses     to authenticated;
grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
grant select, insert, update, delete on public.profiles      to authenticated;
grant select, insert, update, delete on public.user_secrets  to authenticated;
-- responses: no anon/authenticated INSERT — public submits go through the
-- `submit-response` edge function (service_role, which bypasses RLS).

-- ═══ Public form access (projection + security-definer RPC) ════════════════

-- Strips editor-only fields from a factor before exposing it to anon viewers.
create or replace function public.published_factor(factor jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  -- Remove any editor-only/internal keys. Extend as such fields are added.
  select factor - '_migrationWarnings' - '_internal';
$$;

-- Returns ONLY the published projection for a short_id. security definer with a
-- pinned search_path (avoids the privilege-escalation footgun) and never
-- exposes owner info or draft/unpublished forms.
create or replace function public.get_public_form(p_short_id text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select public.published_factor(f.factor)
  from public.forms f
  join public.deployments d on d.form_id = f.id
  where d.short_id = p_short_id and d.status = 'published';
$$;

grant execute on function public.get_public_form(text) to anon, authenticated;
revoke execute on function public.published_factor(jsonb) from anon, authenticated;
