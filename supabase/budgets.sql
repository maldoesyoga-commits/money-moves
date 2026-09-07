-- Homestead — a budget per category, per month
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- If Supabase warns about Row Level Security, click "Run and enable RLS".
-- Expect: "Success. No rows returned."

-- period_start is the first day of the statement period the budget covers,
-- so it lines up with the rest of Money Moves rather than the calendar month.
create table if not exists public.category_budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  period_start date not null,
  amount       numeric(10,2) not null default 0 check (amount >= 0),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, category_id, period_start)
);

alter table public.category_budgets enable row level security;

drop policy if exists "own category budgets" on public.category_budgets;
create policy "own category budgets" on public.category_budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_category_budgets_period
  on public.category_budgets (user_id, period_start);

-- Seed this month from whatever single target each category already had,
-- so nothing you've set up disappears. Uses the 1st of the current month;
-- if your statement day isn't the 1st, just hit "Copy last month" on the
-- budget page for the right period.
insert into public.category_budgets (category_id, period_start, amount)
select c.id, date_trunc('month', current_date)::date, c.monthly_target
  from public.categories c
 where c.monthly_target is not null
   and c.monthly_target > 0
on conflict (user_id, category_id, period_start) do nothing;
