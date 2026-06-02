-- ============================================================
-- 004_task_event_link.sql
-- Link tasks to events
-- ============================================================

alter table public.tasks
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists idx_tasks_event_id
  on public.tasks(event_id);
