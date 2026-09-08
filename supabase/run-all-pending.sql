-- Homestead — everything still pending, in one run
-- Paste the WHOLE of this into the Supabase SQL editor and hit Run.
-- Safe to run more than once: every statement is create-if-not-exists,
-- add-column-if-not-exists, or drop-policy-then-create.
-- Expect: "Success. No rows returned."

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
-- Homestead — project pages
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- This ALTERS existing tables — it adds columns, it does not touch your data.
-- Expect: "Success. No rows returned."
--
-- Notes already carry a project_id (from notes-journal.sql), so a project's
-- notes live in the Notes database and are only *shown* on the project page.
-- This adds the same link for content, plus dates so a project has a timeline.

alter table public.projects add column if not exists start_date  date;
alter table public.projects add column if not exists target_date date;

alter table public.content_items add column if not exists project_id uuid
  references public.projects(id) on delete set null;

create index if not exists idx_content_project on public.content_items (project_id);
create index if not exists idx_notes_project   on public.notes (project_id);

-- Sanity check — the project page reads all four of these.
-- select column_name from information_schema.columns
-- where table_name = 'projects' and column_name in
--   ('notes','twy_goal_id','start_date','target_date');
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
-- Homestead — Household
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."
--
-- Three tables that lean on each other: what you own, the paperwork for it,
-- and the upkeep it needs. A document or a maintenance job can hang off an
-- item, or stand alone (the furnace filter schedule doesn't need the furnace
-- in inventory first).

create table if not exists public.household_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null,
  category       text,
  location       text,
  quantity       int not null default 1 check (quantity >= 0),
  brand          text,
  model          text,
  serial_number  text,
  purchase_date  date,
  purchase_price numeric(12,2),
  warranty_until date,
  notes          text,
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists public.household_documents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id    uuid references public.household_items(id) on delete set null,
  title      text not null,
  kind       text not null default 'manual'
    check (kind in ('manual','warranty','receipt','insurance','instructions','other')),
  link       text,
  notes      text,
  created_at timestamptz not null default now()
);

-- Upkeep on a repeat: filter every 3 months, gutters every 6, batteries yearly.
create table if not exists public.household_maintenance (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id        uuid references public.household_items(id) on delete set null,
  title          text not null,
  area           text,
  interval_value int not null default 1 check (interval_value between 1 and 120),
  interval_unit  text not null default 'months'
    check (interval_unit in ('days','weeks','months','years')),
  last_done      date,
  notes          text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.household_maintenance_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  maintenance_id uuid not null references public.household_maintenance(id) on delete cascade,
  done_on        date not null default current_date,
  notes          text,
  created_at     timestamptz not null default now()
);

alter table public.household_items            enable row level security;
alter table public.household_documents        enable row level security;
alter table public.household_maintenance      enable row level security;
alter table public.household_maintenance_logs enable row level security;

drop policy if exists "own household items"       on public.household_items;
drop policy if exists "own household documents"   on public.household_documents;
drop policy if exists "own household maintenance" on public.household_maintenance;
drop policy if exists "own household logs"        on public.household_maintenance_logs;
create policy "own household items"       on public.household_items            for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own household documents"   on public.household_documents        for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own household maintenance" on public.household_maintenance      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own household logs"        on public.household_maintenance_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_household_docs_item on public.household_documents (item_id);
create index if not exists idx_household_maint_item on public.household_maintenance (item_id);
create index if not exists idx_household_logs_maint on public.household_maintenance_logs (maintenance_id, done_on desc);

-- Sanity check — should return 4 rows.
-- select tablename, policyname from pg_policies
-- where schemaname = 'public' and tablename like 'household%';
-- Homestead — pantry & standing shopping list
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned." (the migration at the bottom may report
-- rows copied — that's the old grocery list moving across.)
--
-- The shopping list stops being a list you build and clear. Instead there is
-- one permanent list of ingredients — the pantry — and each one carries a
-- status: have it, running low, out. The shopping list is just the pantry
-- filtered to what isn't stocked, plus anything a recipe has flagged.

create table if not exists public.pantry_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  aisle       text not null default 'other'
    check (aisle in ('produce','protein','dairy','pantry','frozen','bakery','household','other')),
  unit        text,
  status      text not null default 'out' check (status in ('have','low','out')),
  -- A staple is something you always want in stock, so "low" on it matters
  -- more than "low" on something you buy for one recipe.
  staple      boolean not null default false,
  -- Set when a recipe check finds it missing. Cleared when you pick it up.
  needed      boolean not null default false,
  needed_note text,
  est_cost    numeric(10,2),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One name, one row — that's what makes the list permanent instead of piling up.
create unique index if not exists idx_pantry_name on public.pantry_items (user_id, lower(name));

-- What each recipe needs, pointing at real pantry rows rather than free text.
create table if not exists public.meal_ingredients (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meal_id        uuid not null references public.meals(id) on delete cascade,
  pantry_item_id uuid not null references public.pantry_items(id) on delete cascade,
  amount         text,
  optional       boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  unique (meal_id, pantry_item_id)
);

alter table public.pantry_items     enable row level security;
alter table public.meal_ingredients enable row level security;

drop policy if exists "own pantry items"     on public.pantry_items;
drop policy if exists "own meal ingredients" on public.meal_ingredients;
create policy "own pantry items"     on public.pantry_items     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own meal ingredients" on public.meal_ingredients for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_meal_ingredients_meal on public.meal_ingredients (meal_id);
create index if not exists idx_pantry_status on public.pantry_items (user_id, status);

-- Bring the old grocery list across as pantry rows marked "out", so nothing
-- you'd already written down is lost. Runs once; duplicates are skipped.
insert into public.pantry_items (user_id, name, aisle, status, est_cost)
select distinct on (g.user_id, lower(g.name))
  g.user_id,
  g.name,
  case when g.aisle in ('produce','protein','dairy','pantry','frozen','bakery','household','other')
    then g.aisle else 'other' end,
  'out',
  g.est_cost
from public.grocery_items g
where g.name is not null and length(trim(g.name)) > 0
order by g.user_id, lower(g.name), g.created_at
on conflict do nothing;

-- Sanity check — should return 2 rows.
-- select tablename, policyname from pg_policies
-- where schemaname = 'public' and tablename in ('pantry_items','meal_ingredients');
