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
