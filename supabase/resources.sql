-- Homestead — Brand module: Resources (Drive links)
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."

create table if not exists public.brand_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand      text not null,
  label      text not null,
  url        text not null,
  category   text not null default 'other'
             check (category in ('doc','folder','asset','link','other')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.brand_links enable row level security;

drop policy if exists "own brand_links" on public.brand_links;
create policy "own brand_links" on public.brand_links
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_brand_links_user_brand on public.brand_links (user_id, brand);
