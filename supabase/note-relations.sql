-- Homestead — related pages (links between notes/pages)
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."
--
-- A relation joins two notes. It's stored once; the page shows relations in
-- either direction, so linking A→B also shows A on B.

create table if not exists public.note_relations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_id         uuid not null references public.notes(id) on delete cascade,
  related_note_id uuid not null references public.notes(id) on delete cascade,
  created_at      timestamptz not null default now()
);

alter table public.note_relations enable row level security;

drop policy if exists "own note_relations" on public.note_relations;
create policy "own note_relations" on public.note_relations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_note_relations_note    on public.note_relations (note_id);
create index if not exists idx_note_relations_related on public.note_relations (related_note_id);
