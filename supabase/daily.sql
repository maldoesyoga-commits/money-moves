-- Homestead — Daily tracking
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."

create table if not exists public.daily_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date         date not null default current_date,

  -- sleep
  wake_time          time,
  bedtime            time,
  sleep_score        int check (sleep_score between 0 and 100),

  -- how the day felt
  happiness          int check (happiness between 1 and 10),
  energy             int check (energy between 1 and 10),
  mood_words         text[] not null default '{}',

  -- water
  water_glasses      int not null default 0 check (water_glasses >= 0),
  water_goal         int not null default 8 check (water_goal > 0),

  -- gratitude
  morning_gratitude  text,
  evening_gratitude  text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  icon       text,
  slot       text not null default 'any' check (slot in ('am','pm','any')),
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id   uuid not null references public.habits(id) on delete cascade,
  log_date   date not null default current_date,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

alter table public.daily_logs enable row level security;
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;

drop policy if exists "own daily logs" on public.daily_logs;
drop policy if exists "own habits"     on public.habits;
drop policy if exists "own habit logs" on public.habit_logs;
create policy "own daily logs" on public.daily_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own habits"     on public.habits     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own habit logs" on public.habit_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_daily_logs_date on public.daily_logs (user_id, entry_date desc);
create index if not exists idx_habit_logs_date on public.habit_logs (user_id, log_date);
