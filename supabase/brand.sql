-- Homestead — Brand module: Brand Kit
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."
--
-- Stores the editable pieces of each brand's kit (tagline override, fonts,
-- logo image URLs). Colours, voice and pillars live in the app code
-- (src/lib/brandKit.js); this table is only the stuff you fill in yourself.
-- One row per brand ('cm', 'hh', 'om').

create table if not exists public.brand_kit (
  brand        text primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tagline      text,
  heading_font text,
  body_font    text,
  logo_url     text,
  wordmark_url text,
  submark_url  text,
  notes        text,
  updated_at   timestamptz not null default now()
);

alter table public.brand_kit enable row level security;

drop policy if exists "own brand_kit" on public.brand_kit;
create policy "own brand_kit" on public.brand_kit
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
