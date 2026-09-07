-- Homestead — recurring tasks
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- This ALTERS the existing tasks table — it adds columns, it does not touch your data.
-- Expect: "Success. No rows returned."

alter table public.tasks
  add column if not exists repeat_every text
    check (repeat_every in ('daily','weekly','monthly','yearly'));

alter table public.tasks
  add column if not exists repeat_interval int not null default 1
    check (repeat_interval between 1 and 52);
