-- Homestead — 12 Week Year: aims, objectives, and links to projects & habits
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."
--
-- Adds three things:
--   1. an "aim" on each goal — the broad ambition the goal is a slice of
--   2. objectives — the milestones that have to be true for the goal to land
--   3. a goal link on projects and habits, so the planner and the habit
--      tracker feed the goal scoreboard instead of living beside it

-- 1. The aim: one line, no number in it. The goal is this narrowed down.
alter table public.twy_goals add column if not exists aim text;

-- 2. Objectives are ticked off once each — milestones, not weekly actions.
--    (Weekly actions are tactics, which already live in twy_tactics.)
create table if not exists public.twy_objectives (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id    uuid not null references public.twy_goals(id) on delete cascade,
  title      text not null,
  detail     text,
  done       boolean not null default false,
  done_at    timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.twy_objectives enable row level security;

drop policy if exists "own twy objectives" on public.twy_objectives;
create policy "own twy objectives" on public.twy_objectives
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_twy_objectives_goal on public.twy_objectives (goal_id);

-- 3. A project or a habit can serve one goal. Clearing the goal (or deleting
--    the cycle) leaves the project and its tasks untouched — set null, not cascade.
alter table public.projects add column if not exists twy_goal_id uuid
  references public.twy_goals(id) on delete set null;

alter table public.habits add column if not exists twy_goal_id uuid
  references public.twy_goals(id) on delete set null;

create index if not exists idx_projects_twy_goal on public.projects (twy_goal_id);
create index if not exists idx_habits_twy_goal   on public.habits (twy_goal_id);

-- Sanity check — should return 5 rows (one policy per twy_* table).
-- select tablename, policyname from pg_policies
-- where schemaname = 'public' and tablename like 'twy_%';
