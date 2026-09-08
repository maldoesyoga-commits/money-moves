-- Homestead — project pages
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- This ALTERS existing tables — it adds columns, it does not touch your data.
-- Expect: "Success. No rows returned."
--
-- Notes already carry a project_id (from notes-journal.sql), so a project's
-- notes live in the Notes database and are only *shown* on the project page.
-- This adds the same link for content, plus dates so a project has a timeline.

alter table public.projects add column if not exists start_date  date;
alter table public.projects add column if not exists target_date date;

alter table public.content_items add column if not exists project_id uuid
  references public.projects(id) on delete set null;

create index if not exists idx_content_project on public.content_items (project_id);
create index if not exists idx_notes_project   on public.notes (project_id);

-- Sanity check — the project page reads all four of these.
-- select column_name from information_schema.columns
-- where table_name = 'projects' and column_name in
--   ('notes','twy_goal_id','start_date','target_date');
