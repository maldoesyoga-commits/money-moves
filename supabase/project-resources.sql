-- Homestead — project resources (links per project)
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."
--
-- Links that belong to a project — Drive docs, folders, assets, references.
-- A row can hang off a personal project or a freelance project; the links are
-- optional and independent, same pattern as milestones.

create table if not exists public.project_links (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label                text not null,
  url                  text not null,
  category             text not null default 'link'
                       check (category in ('doc','folder','asset','link','other')),
  project_id           uuid references public.projects(id) on delete cascade,
  freelance_project_id uuid references public.freelance_projects(id) on delete cascade,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now()
);

alter table public.project_links enable row level security;

drop policy if exists "own project_links" on public.project_links;
create policy "own project_links" on public.project_links
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_project_links_project   on public.project_links (project_id);
create index if not exists idx_project_links_freelance on public.project_links (freelance_project_id);
