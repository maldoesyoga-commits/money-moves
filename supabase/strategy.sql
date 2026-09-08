-- Homestead — Brand module: Strategy & Identity docs
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."
--
-- One row per strategy/identity doc, scoped to a brand ('cm','hh','om').
-- Each holds an in-app write-up (body) and an optional Google Drive link.

create table if not exists public.brand_docs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand      text not null,
  title      text not null,
  kind       text not null default 'strategy'
             check (kind in ('strategy','identity','positioning','audience','messaging','other')),
  body       text,
  link       text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.brand_docs enable row level security;

drop policy if exists "own brand_docs" on public.brand_docs;
create policy "own brand_docs" on public.brand_docs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_brand_docs_user_brand on public.brand_docs (user_id, brand);
