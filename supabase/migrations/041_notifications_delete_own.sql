-- 041_notifications_delete_own.sql
--
-- The bell gets "מחק" on each notification and "נקה הכל" (company
-- commander, 06.11.2026): without them a notification stays in the list
-- forever. 038 let a client only set read_at; now a user may also delete
-- their own notifications — nobody else's, and never through an OAuth (MCP)
-- token. Deleting a notification touches nothing else: the task, event or
-- request it pointed at stays as it is.
-- Run manually — SANDBOX first, then LIVE. Idempotent.

grant delete on public.notifications to authenticated;

drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: delete own"
  on public.notifications for delete to authenticated
  using ( user_id = public.current_app_user_id() );

drop policy if exists "oauth: no delete" on public.notifications;
create policy "oauth: no delete" on public.notifications
  as restrictive for delete to authenticated
  using (not public.is_oauth_client_request());
