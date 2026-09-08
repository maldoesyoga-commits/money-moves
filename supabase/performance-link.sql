-- Homestead — Brand module: link performance entries to Content items
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."
--
-- Adds an optional link from a performance_log row to the content_items piece
-- it measures. Safe to run once; does nothing if the column already exists.

alter table public.performance_log
  add column if not exists content_item_id uuid
  references public.content_items(id) on delete set null;
