-- Lightweight DB-backed rate limiting for public endpoints (e.g. the
-- submit-response edge function). RLS alone only checks ownership, not abuse
-- (03 §2): this closes the "anyone can script unlimited fake submissions" hole.

create table public.rate_limits (
  id         bigint generated always as identity primary key,
  bucket     text not null,
  created_at timestamptz not null default now()
);
create index rate_limits_bucket_idx on public.rate_limits (bucket, created_at desc);

alter table public.rate_limits enable row level security;
-- No policies: only service_role (which bypasses RLS) touches this table.

-- Atomically records a hit and reports whether the caller is within the limit.
-- Returns true when allowed, false when the window is already at/over p_max.
create or replace function public.hit_rate_limit(
  p_bucket text,
  p_max int,
  p_window_secs int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c int;
begin
  -- Opportunistic cleanup of old rows (10x the window).
  delete from public.rate_limits
    where created_at < now() - make_interval(secs => p_window_secs * 10);

  select count(*) into c
    from public.rate_limits
    where bucket = p_bucket
      and created_at > now() - make_interval(secs => p_window_secs);

  if c >= p_max then
    return false;
  end if;

  insert into public.rate_limits (bucket) values (p_bucket);
  return true;
end;
$$;

-- Only the service role (edge functions) may call this.
revoke execute on function public.hit_rate_limit(text, int, int) from anon, authenticated;
