-- Homestead — notebooks
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."

create table if not exists public.notebooks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  area        text,
  color       text,
  icon        text,
  archived    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.notebooks enable row level security;

drop policy if exists "own notebooks" on public.notebooks;
create policy "own notebooks" on public.notebooks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notes live in a notebook. Existing notes stay where they are (no
-- notebook) and show under "Loose notes" until you file them.
alter table public.notes
  add column if not exists notebook_id uuid references public.notebooks(id) on delete set null;

alter table public.notes
  add column if not exists sort_order int not null default 0;

create index if not exists idx_notes_notebook on public.notes (notebook_id);
