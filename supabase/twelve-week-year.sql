-- Homestead — 12 Week Year goals
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."

-- A cycle is one 12-week "year". Week 13 is the buffer/planning week.
create table if not exists public.twy_cycles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  vision      text,
  start_date  date not null,
  status      text not null default 'active' check (status in ('planning','active','done','abandoned')),
  created_at  timestamptz not null default now()
);

-- One to three goals per cycle. The lag measure is the outcome you're
-- chasing; tactics are the weekly actions that get you there.
create table if not exists public.twy_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cycle_id      uuid not null references public.twy_cycles(id) on delete cascade,
  title         text not null,
  why           text,
  lag_measure   text,
  lag_target    numeric(12,2),
  lag_current   numeric(12,2) not null default 0,
  lag_unit      text,
  color         text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.twy_tactics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id     uuid not null references public.twy_goals(id) on delete cascade,
  title       text not null,
  cadence     text not null default 'weekly' check (cadence in ('weekly','once')),
  times_per_week int not null default 1 check (times_per_week between 1 and 14),
  due_week    int check (due_week between 1 and 13),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- One row per completion. A weekly tactic done 3x logs 3 rows for that week.
create table if not exists public.twy_tactic_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tactic_id  uuid not null references public.twy_tactics(id) on delete cascade,
  week_no    int not null check (week_no between 1 and 13),
  done_on    date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.twy_cycles      enable row level security;
alter table public.twy_goals       enable row level security;
alter table public.twy_tactics     enable row level security;
alter table public.twy_tactic_logs enable row level security;

drop policy if exists "own twy cycles"      on public.twy_cycles;
drop policy if exists "own twy goals"       on public.twy_goals;
drop policy if exists "own twy tactics"     on public.twy_tactics;
drop policy if exists "own twy tactic logs" on public.twy_tactic_logs;
create policy "own twy cycles"      on public.twy_cycles      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own twy goals"       on public.twy_goals       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own twy tactics"     on public.twy_tactics     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own twy tactic logs" on public.twy_tactic_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_twy_goals_cycle  on public.twy_goals (cycle_id);
create index if not exists idx_twy_tactics_goal on public.twy_tactics (goal_id);
create index if not exists idx_twy_logs_week    on public.twy_tactic_logs (user_id, week_no);
