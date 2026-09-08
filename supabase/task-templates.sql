-- Homestead — task templates
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."
--
-- A template is a named bundle of task lines — "new client onboarding",
-- "monthly close", "shoot day". Applying one stamps out real tasks, dated
-- relative to whatever anchor date you pick.

create table if not exists public.task_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  project_id  uuid references public.projects(id) on delete set null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.task_template_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template_id     uuid not null references public.task_templates(id) on delete cascade,
  title           text not null,
  notes           text,
  priority        text check (priority in ('low','med','high')),
  -- Days from the anchor date. 0 = the day you apply it, 3 = three days later,
  -- -1 = the day before (useful for prep steps before an event).
  due_offset_days int,
  repeat_every    text check (repeat_every in ('daily','weekly','monthly','yearly')),
  repeat_interval int not null default 1 check (repeat_interval between 1 and 52),
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.task_templates      enable row level security;
alter table public.task_template_items enable row level security;

drop policy if exists "own task templates"      on public.task_templates;
drop policy if exists "own task template items" on public.task_template_items;
create policy "own task templates"      on public.task_templates      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own task template items" on public.task_template_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_template_items on public.task_template_items (template_id);
