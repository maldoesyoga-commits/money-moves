-- Homestead — note attachments (links + files on a note)
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."
--
-- Uploaded files reuse the existing "receipts" storage bucket (no new bucket to
-- set up); a row here just records where the file lives, or the link's URL.

create table if not exists public.note_attachments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_id      uuid not null references public.notes(id) on delete cascade,
  kind         text not null default 'link' check (kind in ('link','file')),
  label        text,
  url          text,          -- kind 'link': the URL
  storage_path text,          -- kind 'file': path in the receipts bucket
  mime         text,          -- kind 'file': content type (so images show as images)
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.note_attachments enable row level security;

drop policy if exists "own note_attachments" on public.note_attachments;
create policy "own note_attachments" on public.note_attachments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_note_attachments_note on public.note_attachments (note_id);
