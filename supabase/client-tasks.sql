-- Homestead — per-client tasks
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- This ALTERS an existing table — it adds one column, it does not touch your data.
-- Expect: "Success. No rows returned."
--
-- Tasks can already belong to a personal project (project_id) or a freelance
-- project (freelance_project_id). This lets a task belong straight to a client,
-- so each client can have its own task list without needing a project first.

alter table public.tasks add column if not exists client_id uuid
  references public.clients(id) on delete set null;

create index if not exists idx_tasks_client on public.tasks (client_id);
