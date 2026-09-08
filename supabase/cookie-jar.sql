-- Homestead — Cookie Jar
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned." then a second result for the seed rows.
--
-- Separate from milestones on purpose. A milestone is something you were
-- aiming at; a cookie jar moment is something you want to remember. The jar
-- is for reaching into on a bad day, so nothing in it is a target, a status,
-- or a thing left to do.

create table if not exists public.cookie_jar (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null,
  moment_on  date,
  kind       text not null default 'win'
    check (kind in ('win','joy','proud','kindness','growth','other')),
  detail     text,
  -- What made it land. The bit that's worth re-reading later.
  why        text,
  link       text,
  favourite  boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.cookie_jar enable row level security;

drop policy if exists "own cookie jar" on public.cookie_jar;
create policy "own cookie jar" on public.cookie_jar
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_cookie_jar_date on public.cookie_jar (user_id, moment_on desc);
