-- RLS verification for Formia schema (run against a fresh local db).
-- Enforces RLS by switching to the non-superuser `authenticated`/`anon` roles
-- and setting request.jwt.claims so auth.uid() resolves.
--
-- Usage (local stack up):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
-- Expects to print "RLS TESTS PASSED" and roll back all changes.

begin;

create schema if not exists tests;

-- Two fake users.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

create or replace function tests.as_user(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
end $$;

create or replace function tests.as_anon() returns void
language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
end $$;

do $$
declare
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  form_id uuid;
  cnt int;
  pub jsonb;
begin
  -- User A creates a form.
  perform tests.as_user(a);
  insert into public.forms (owner_id, title, factor)
    values (a, 'A form', '{"schemaVersion":"3.0.0","secret":"draft"}'::jsonb)
    returning id into form_id;

  -- A sees own form.
  select count(*) into cnt from public.forms where id = form_id;
  assert cnt = 1, 'owner should read own form';

  -- Reset role to escalate back for the next impersonation.
  reset role;
  -- User B cannot see A's form.
  perform tests.as_user(b);
  select count(*) into cnt from public.forms where id = form_id;
  assert cnt = 0, 'non-owner must NOT read others form (got '||cnt||')';

  -- User B cannot update A's form.
  update public.forms set title = 'hacked' where id = form_id;
  get diagnostics cnt = row_count;
  assert cnt = 0, 'non-owner must NOT update others form';

  -- A publishes the form.
  reset role;
  perform tests.as_user(a);
  insert into public.deployments (form_id, status, short_id, published_at)
    values (form_id, 'published', 'abc123', now());

  -- anon can fetch the published projection via RPC (secret stays; only
  -- _migrationWarnings/_internal are stripped — secret is author content).
  reset role;
  perform tests.as_anon();
  select public.get_public_form('abc123') into pub;
  assert pub is not null, 'anon should fetch published form via RPC';

  -- anon cannot read forms table directly (no GRANT -> hard permission error,
  -- which is even stronger than an RLS-filtered empty result).
  begin
    perform count(*) from public.forms;
    raise exception 'anon must NOT read forms table directly';
  exception when insufficient_privilege then
    null; -- expected
  end;

  -- anon cannot insert a response directly (no policy; goes via edge fn).
  begin
    insert into public.responses (form_id, data) values (form_id, '{}'::jsonb);
    raise exception 'anon response insert should have been blocked';
  exception when insufficient_privilege or check_violation then
    null; -- expected: RLS blocks
  end;

  reset role;
  raise notice 'RLS TESTS PASSED';
end $$;

rollback;
