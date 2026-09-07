-- Homestead — Phase 2: Tasks & Projects
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  status      text not null default 'active' check (status in ('active','on_hold','done','archived')),
  color       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  notes       text,
  project_id  uuid references public.projects(id) on delete set null,
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  priority    text check (priority in ('low','med','high')),
  due_date    date,
  done_at     timestamptz,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.tasks    enable row level security;

drop policy if exists "own projects" on public.projects;
drop policy if exists "own tasks"    on public.tasks;
create policy "own projects" on public.projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tasks"    on public.tasks    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_tasks_user_due on public.tasks (user_id, due_date);
create index if not exists idx_tasks_project  on public.tasks (project_id);
