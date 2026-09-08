-- Homestead — client dashboard (Phase 3): brand kit + client links
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."

-- 1. A per-client brand kit — free text so it stays low-friction. Colours can
--    be hex codes or names; the page shows swatches for anything that looks
--    like a hex code.
alter table public.clients add column if not exists brand_colors text;
alter table public.clients add column if not exists brand_fonts  text;
alter table public.clients add column if not exists brand_voice  text;

-- 2. Client-level links — reference docs, folders, and brand assets/logos.
create table if not exists public.client_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id  uuid references public.clients(id) on delete cascade,
  label      text not null,
  url        text not null,
  category   text not null default 'link'
             check (category in ('doc','folder','asset','link','other')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.client_links enable row level security;

drop policy if exists "own client_links" on public.client_links;
create policy "own client_links" on public.client_links
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_client_links_client on public.client_links (client_id);
