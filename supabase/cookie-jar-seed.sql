-- Homestead — Cookie Jar: moments brought over from the Notion Cookie Jar
-- Run AFTER cookie-jar.sql, in the Supabase SQL editor.
-- Expect: "Success. 10 rows" (or similar).
--
-- The SQL editor runs as an admin, not as you, so auth.uid() is null here —
-- the insert looks your user id up instead. If you ever have more than one
-- account in this project, change the subquery to your own email.
--
-- Dates are the Notion "Created Date" — the day the entry was written.
-- The Notion "Achievement Date" field was empty on every one of these, so
-- this is the closest true record of when each moment was captured.

with me as (
  select id from auth.users order by created_at limit 1
)
insert into public.cookie_jar (user_id, title, moment_on, kind, detail)
select me.id, v.title, v.moment_on::date, v.kind, v.detail
from me, (values
  ('Write my first Notion formula without using a pre-built one',
   '2025-12-28', 'growth', 'Written from scratch, no Notion AI.'),
  ('Read my first book',
   '2026-01-01', 'proud', null),
  ('Applied for 5 jobs',
   '2026-02-11', 'win', null),
  ('Landed a job interview',
   '2026-02-11', 'win', null),
  ('Started working with my first client — Cindy, as a Notion consultant',
   '2026-02-18', 'win', 'First paid consulting work.'),
  ('Got my first pay working for Cindy',
   '2026-04-09', 'win', null),
  ('Moving into a one bedroom apartment!!!',
   '2026-04-28', 'joy', null),
  ('Choosing my health again',
   '2026-05-14', 'proud', 'Marked as mission accomplished in the Notion jar.'),
  ('Made my first working Make.com automation',
   '2026-06-12', 'growth', null),
  ('Two weeks ahead on content for Hope Heals',
   '2026-06-22', 'proud', null)
) as v(title, moment_on, kind, detail);
