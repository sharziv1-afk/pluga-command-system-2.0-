-- 040_test_notification_pushed.sql
--
-- The profile's "שלח התראת בדיקה" pushes straight from its own route
-- (/api/notifications/send-test), but send_test_notification() left
-- pushed_at empty. Once the dispatcher of 039 was live it took that row for
-- pending and pushed it a second time (found 06.11.2026: the morning's test
-- arrived again when the dispatcher first ran). The row is now born pushed.
-- Run manually — SANDBOX first, then LIVE. Idempotent.

create or replace function public.send_test_notification()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.current_app_user_id();
  v_row public.notifications%rowtype;
begin
  if v_user is null or public.is_oauth_client_request() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.notifications
     where user_id = v_user and kind = 'test' and created_at > now() - interval '20 seconds'
  ) then
    raise exception 'test notification rate limited' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  -- pushed_at: the calling route sends it itself, so the dispatcher must not.
  insert into public.notifications (user_id, kind, title, body, url, pushed_at)
  values (v_user, 'test', 'התראת בדיקה', 'ההתראות פועלות במכשיר הזה.', '/profile', now())
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'title', v_row.title, 'body', v_row.body, 'url', v_row.url);
end;
$$;

revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;
