-- Homestead — Brand module: Hashtag banks
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."
--
-- One row per hashtag bank, scoped to a brand ('cm','hh','om').
-- `tags` stores the hashtags as plain text (spaces or new lines); the app
-- parses them into chips and a copy-all set.

create table if not exists public.hashtag_banks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand      text not null,
  name       text not null,
  kind       text not null default 'mixed'
             check (kind in ('core','pillar','niche','broad','mixed')),
  tags       text,
  strategy   text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.hashtag_banks enable row level security;

drop policy if exists "own hashtag_banks" on public.hashtag_banks;
create policy "own hashtag_banks" on public.hashtag_banks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_hashtag_banks_user_brand on public.hashtag_banks (user_id, brand);
