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
