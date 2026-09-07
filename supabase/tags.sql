-- Homestead — tags that cut across modules
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."

create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  color      text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- One row per (tag, thing). item_table is the table the id lives in —
-- kept loose on purpose so a tag can point at anything without a
-- foreign key per module.
create table if not exists public.taggings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  item_table text not null check (item_table in (
    'tasks','projects','notes','content_items','clients',
    'freelance_projects','learning_items','meals','goals'
  )),
  item_id    uuid not null,
  created_at timestamptz not null default now(),
  unique (tag_id, item_table, item_id)
);

alter table public.tags     enable row level security;
alter table public.taggings enable row level security;

drop policy if exists "own tags"     on public.tags;
drop policy if exists "own taggings" on public.taggings;
create policy "own tags"     on public.tags     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own taggings" on public.taggings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_taggings_tag  on public.taggings (tag_id);
create index if not exists idx_taggings_item on public.taggings (item_table, item_id);
