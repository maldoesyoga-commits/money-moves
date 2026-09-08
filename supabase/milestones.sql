-- Homestead — milestones
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."
--
-- One table for every milestone, wherever it was set from. A milestone can
-- hang off a project, a freelance project, a goal, or nothing at all — the
-- links are optional and independent, so the same row shows on the project
-- page, the goal, the planner and the milestone log without being copied.

create table if not exists public.milestones (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title                text not null,
  detail               text,
  target_date          date,
  achieved             boolean not null default false,
  -- The date it actually happened, which is the bit worth looking back on.
  achieved_on          date,
  project_id           uuid references public.projects(id) on delete set null,
  freelance_project_id uuid references public.freelance_projects(id) on delete set null,
  goal_id              uuid references public.twy_goals(id) on delete set null,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now()
);

alter table public.milestones enable row level security;

drop policy if exists "own milestones" on public.milestones;
create policy "own milestones" on public.milestones
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_milestones_project   on public.milestones (project_id);
create index if not exists idx_milestones_freelance on public.milestones (freelance_project_id);
create index if not exists idx_milestones_goal      on public.milestones (goal_id);
create index if not exists idx_milestones_date      on public.milestones (user_id, target_date);
create index if not exists idx_milestones_achieved  on public.milestones (user_id, achieved_on desc);

-- Sanity check — should return 1 row.
-- select tablename, policyname from pg_policies
-- where schemaname = 'public' and tablename = 'milestones';
