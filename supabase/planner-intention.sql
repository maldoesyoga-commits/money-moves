-- Homestead — separate the day's intention from its three priorities
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Adds one column to a table you already have. Expect "Success. No rows returned."

alter table public.plan_entries
  add column if not exists entry_kind text not null default 'priority'
    check (entry_kind in ('intention', 'priority', 'note'));

-- Anything already flagged as a priority stays one; everything else on a
-- day becomes a plain note rather than being mistaken for a priority.
update public.plan_entries
   set entry_kind = 'priority'
 where horizon = 'day' and is_priority = true and entry_kind = 'priority';

update public.plan_entries
   set entry_kind = 'note'
 where horizon = 'day' and is_priority = false;
