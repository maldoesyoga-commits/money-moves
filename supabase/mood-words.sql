-- Homestead — your own mood words on Daily
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."

create table if not exists public.mood_words (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  word       text not null,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, word)
);

alter table public.mood_words enable row level security;

drop policy if exists "own mood words" on public.mood_words;
create policy "own mood words" on public.mood_words for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_mood_words_user on public.mood_words (user_id, sort_order);
