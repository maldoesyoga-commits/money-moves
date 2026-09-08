-- Homestead — Stability Studio: limbs check-in log
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."
--
-- One row per day. `limbs` is a JSON map of limb -> { state, note }.

create table if not exists public.stability_checkins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  limbs        jsonb not null default '{}'::jsonb,
  note         text,
  created_at   timestamptz not null default now(),
  unique (user_id, checkin_date)
);

alter table public.stability_checkins enable row level security;

drop policy if exists "own stability_checkins" on public.stability_checkins;
create policy "own stability_checkins" on public.stability_checkins
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_stability_user_date
  on public.stability_checkins (user_id, checkin_date desc);
