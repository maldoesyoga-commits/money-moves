-- Tactics: tick-off + notes
-- Adds a done state (like objectives) and a free-text notes field to each tactic.
-- Safe to run more than once.

alter table twy_tactics
  add column if not exists done boolean not null default false,
  add column if not exists done_at timestamptz,
  add column if not exists notes text;
