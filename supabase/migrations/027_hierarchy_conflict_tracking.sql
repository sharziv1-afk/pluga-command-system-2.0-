-- Adds updated_by tracking to the two highest-risk concurrent-write tables
-- (tasks, forum_daily_reports), mirroring the existing pattern already used
-- on soldiers/tracking_items/tracking_records. This is the data needed to
-- resolve a write conflict by role hierarchy instead of plain last-write-wins.

alter table public.tasks
  add column if not exists updated_by uuid references public.users(id) on delete set null;

alter table public.forum_daily_reports
  add column if not exists updated_by uuid references public.users(id) on delete set null;
