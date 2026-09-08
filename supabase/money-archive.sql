-- Homestead — Money Moves: archive debts and savings funds
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."

alter table public.debts
  add column if not exists archived boolean not null default false;

alter table public.savings_funds
  add column if not exists archived boolean not null default false;
