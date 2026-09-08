-- Homestead — Brand module: Mood Board
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."

create table if not exists public.brand_moodboard (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand      text not null,
  image_url  text not null,
  caption    text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.brand_moodboard enable row level security;

drop policy if exists "own brand_moodboard" on public.brand_moodboard;
create policy "own brand_moodboard" on public.brand_moodboard
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_brand_moodboard_user_brand on public.brand_moodboard (user_id, brand);
