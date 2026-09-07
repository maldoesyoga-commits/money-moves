-- Homestead — Phase 3: Planning
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."

create table if not exists public.plan_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  horizon     text not null check (horizon in ('day','week','month','quarter','year')),
  start_date  date not null,
  end_date    date not null,
  title       text not null,
  notes       text,
  done        boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  notes       text,
  horizon     text not null default 'year' check (horizon in ('month','quarter','year')),
  target_date date,
  progress    int not null default 0 check (progress between 0 and 100),
  status      text not null default 'active' check (status in ('active','done','parked')),
  created_at  timestamptz not null default now()
);

alter table public.plan_entries enable row level security;
alter table public.goals        enable row level security;

drop policy if exists "own plan entries" on public.plan_entries;
drop policy if exists "own goals"        on public.goals;
create policy "own plan entries" on public.plan_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own goals"        on public.goals        for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_plan_entries_range on public.plan_entries (user_id, horizon, start_date);
create index if not exists idx_goals_target       on public.goals (user_id, target_date);
