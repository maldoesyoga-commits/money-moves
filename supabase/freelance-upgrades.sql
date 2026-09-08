-- Homestead — Freelance upgrades: timer, project dates, invoice periods, client detail
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- This ALTERS existing tables — it adds columns, it does not touch your data.
-- Expect: "Success. No rows returned."

-- 1. Time: a session now has a real start and end. A row with started_at and
--    no ended_at IS the running timer — there's no separate "timer" state to
--    get out of sync with the log.
alter table public.time_entries add column if not exists started_at timestamptz;
alter table public.time_entries add column if not exists ended_at   timestamptz;

-- A running timer is a row with minutes = 0 until it is stopped, so a
-- "minutes > 0" check has to become "minutes >= 0". The name of that
-- constraint varies, so find it rather than guessing.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'time_entries'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%minutes%'
  loop
    execute format('alter table public.time_entries drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.time_entries
  add constraint time_entries_minutes_check check (minutes >= 0);

create index if not exists idx_time_running
  on public.time_entries (user_id) where ended_at is null and started_at is not null;

-- 2. Freelance projects run between two dates. The deadline stays, but it's
--    optional now — a project has a shape whether or not anything is due.
alter table public.freelance_projects add column if not exists start_date date;
alter table public.freelance_projects add column if not exists end_date   date;
alter table public.freelance_projects add column if not exists notes      text;
alter table public.freelance_projects add column if not exists plan       text;

-- Tasks can belong to a freelance project, the same way they belong to a
-- personal one. Both links are optional and independent.
alter table public.tasks add column if not exists freelance_project_id uuid
  references public.freelance_projects(id) on delete set null;

create index if not exists idx_tasks_freelance on public.tasks (freelance_project_id);

-- 3. An invoice covers a stretch of time, not a project.
alter table public.invoices add column if not exists period_start date;
alter table public.invoices add column if not exists period_end   date;

-- 4. Client detail — the things you need when actually invoicing someone.
alter table public.clients add column if not exists company        text;
alter table public.clients add column if not exists phone          text;
alter table public.clients add column if not exists billing_email  text;
alter table public.clients add column if not exists address        text;
alter table public.clients add column if not exists website        text;
alter table public.clients add column if not exists payment_terms  text;
alter table public.clients add column if not exists started_on     date;
alter table public.clients add column if not exists how_we_met     text;

-- Sanity check — the freelance pages read all of these.
-- select table_name, column_name from information_schema.columns
-- where table_name in ('time_entries','freelance_projects','invoices','clients')
--   and column_name in ('started_at','ended_at','start_date','end_date','period_start','billing_email');
