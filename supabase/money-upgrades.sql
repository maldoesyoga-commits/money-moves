-- Homestead — Money Moves upgrades
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."
-- All statements are additive and safe to run once.

-- Subscriptions: which day of the month they bill, and which account they come from
alter table public.subscriptions
  add column if not exists billing_day int;
alter table public.subscriptions
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- Documents (receipts): an optional money category
alter table public.documents
  add column if not exists category_id uuid references public.categories(id) on delete set null;

-- Savings fund entries: link to the transfer transaction that moved the money
alter table public.fund_entries
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

-- Transactions: money can be sourced from a debt (a borrow / draw)
alter table public.transactions
  add column if not exists from_debt_id uuid references public.debts(id) on delete set null;

-- Debt entries: link a draw back to the transaction that created it (so it can be reversed)
alter table public.debt_entries
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;
