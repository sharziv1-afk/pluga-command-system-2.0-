-- 025_performance_indexes.sql
-- Three unbounded, unindexed sort columns found during a performance audit:
-- tasks/requests both order by created_at desc on every load with no
-- existing index on that column (only due_at/status/assigned_to/created_by/
-- unit_id/event_id are indexed), and forum_posts sorts by (is_pinned,
-- created_at) but only has a single-column created_at index.

create index if not exists idx_tasks_created_at on public.tasks(created_at desc);
create index if not exists idx_requests_created_at on public.requests(created_at desc);
create index if not exists idx_forum_posts_pinned_created_at on public.forum_posts(is_pinned desc, created_at desc);
