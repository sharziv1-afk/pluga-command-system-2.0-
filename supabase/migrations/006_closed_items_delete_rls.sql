-- ============================================================
-- 006_closed_items_delete_rls.sql
-- Extend delete policies for closed items (Phase 1)
-- ============================================================

-- C6 replacement: Requests - commander OR creator can delete closed requests.
-- Closed = completed, rejected, cancelled.
drop policy if exists "requests: commander delete completed" on public.requests;
drop policy if exists "requests: delete closed" on public.requests;
create policy "requests: delete closed"
  on public.requests
  for delete
  to authenticated
  using (
    status in ('completed', 'rejected', 'cancelled')
    and (
      public.is_commander(auth.uid())
      or requested_by = (
        select id from public.users
         where auth_user_id = auth.uid()
         limit 1
      )
    )
  );

-- F8 replacement: Tasks - commander OR creator can delete closed tasks.
-- Closed = completed, cancelled.
drop policy if exists "tasks: commander delete completed" on public.tasks;
drop policy if exists "tasks: delete closed" on public.tasks;
create policy "tasks: delete closed"
  on public.tasks
  for delete
  to authenticated
  using (
    status in ('completed', 'cancelled')
    and (
      public.is_commander(auth.uid())
      or created_by = (
        select id from public.users
         where auth_user_id = auth.uid()
         limit 1
      )
    )
  );

-- NEW: Events - commander OR creator can delete closed events.
-- Closed = completed, cancelled.
-- on delete set null on tasks.event_id and requests.event_id handles linked items safely.
drop policy if exists "events: delete closed" on public.events;
create policy "events: delete closed"
  on public.events
  for delete
  to authenticated
  using (
    status in ('completed', 'cancelled')
    and (
      public.is_commander(auth.uid())
      or created_by = (
        select id from public.users
         where auth_user_id = auth.uid()
         limit 1
      )
    )
  );
