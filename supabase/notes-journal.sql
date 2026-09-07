-- Homestead — Notes, Journal, and project notes
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text,
  body       text not null default '',
  category   text not null default 'note' check (category in ('note','idea','reference','someday')),
  pinned     boolean not null default false,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  body       text not null default '',
  mood       text check (mood in ('rough','low','steady','good','great')),
  gratitude  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Longer notes on a project, separate from its one-line description.
alter table public.projects add column if not exists notes text;

alter table public.notes           enable row level security;
alter table public.journal_entries enable row level security;

drop policy if exists "own notes"           on public.notes;
drop policy if exists "own journal entries" on public.journal_entries;
create policy "own notes"           on public.notes           for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own journal entries" on public.journal_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_notes_pinned  on public.notes (user_id, pinned);
create index if not exists idx_journal_date  on public.journal_entries (user_id, entry_date desc);
