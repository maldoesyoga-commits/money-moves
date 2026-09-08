-- Homestead — Brand module: Products & Offers
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."

create table if not exists public.brand_offers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand      text not null,
  name       text not null,
  price      text,
  status     text not null default 'idea'
             check (status in ('idea','draft','live','retired')),
  link       text,
  notes      text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.brand_offers enable row level security;

drop policy if exists "own brand_offers" on public.brand_offers;
create policy "own brand_offers" on public.brand_offers
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_brand_offers_user_brand on public.brand_offers (user_id, brand);
