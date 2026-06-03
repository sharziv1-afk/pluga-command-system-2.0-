-- ============================================================
-- 005_request_event_link.sql
-- Link requests to events
-- ============================================================

alter table public.requests
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists idx_requests_event_id
  on public.requests(event_id);
