-- Homestead — daily planner time blocks + focus sessions
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."

-- One row per booked block. start_min is minutes from midnight, so
-- 9:30am = 570. Blocks are half-hour multiples.
create table if not exists public.time_blocks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  block_date   date not null,
  start_min    int not null check (start_min between 0 and 1439),
  duration_min int not null default 30 check (duration_min between 30 and 720),
  label        text not null,
  kind         text not null default 'focus' check (kind in ('focus','admin','meeting','break','personal','other')),
  task_id      uuid references public.tasks(id) on delete set null,
  done         boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (user_id, block_date, start_min)
);

-- A completed (or abandoned) focus block.
create table if not exists public.focus_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id       uuid references public.tasks(id) on delete set null,
  label         text,
  planned_min   int not null default 50,
  actual_min    int not null default 0,
  completed     boolean not null default false,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  session_date  date not null default current_date
);

alter table public.time_blocks     enable row level security;
alter table public.focus_sessions  enable row level security;

drop policy if exists "own time blocks"     on public.time_blocks;
drop policy if exists "own focus sessions"  on public.focus_sessions;
create policy "own time blocks"    on public.time_blocks    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own focus sessions" on public.focus_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_time_blocks_date on public.time_blocks (user_id, block_date);
create index if not exists idx_focus_date       on public.focus_sessions (user_id, session_date);

-- The daily planner marks its three priorities using plan_entries, so it
-- needs one flag on the table you already have.
alter table public.plan_entries add column if not exists is_priority boolean not null default false;
