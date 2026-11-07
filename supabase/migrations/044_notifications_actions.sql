-- 044_notifications_actions.sql
--
-- Notifications, stage 4: open the item itself, and quick actions
-- (docs/NOTIFICATIONS.md). Run manually — SANDBOX first, then LIVE.
-- Idempotent. Needs 038–043.
--
-- 1. notify_user() adds item=<entity id> to the link, so a tap opens the
--    task, event, request or gap itself, not just its page.
-- 2. notification_quick_action(id, action): "בוצע", "התחלתי", "קיבלתי",
--    "ראיתי", "דחה ביום". SECURITY INVOKER: the change runs under the
--    caller's own RLS and the same triggers as the site (036 still stops an
--    assignee from cancelling), so a quick action can never do more than the
--    person could do on the page. Only small, reversible changes; nothing is
--    approved, closed, published or deleted from a notification. Each action
--    is checked against the notification's kind, written to audit_logs, and
--    marks the notification read. OAuth (MCP) tokens cannot use it.

create or replace function public.notify_user(
  p_user uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_url text,
  p_entity_type text,
  p_entity_id uuid,
  p_dedupe text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := p_url;
begin
  if p_user is null or not exists (select 1 from public.users where id = p_user and status = 'active') then
    return;
  end if;
  if v_url is not null and p_entity_id is not null and v_url !~ '[?&]item=' then
    v_url := v_url || case when position('?' in v_url) > 0 then '&' else '?' end || 'item=' || p_entity_id;
  end if;
  insert into public.notifications (user_id, kind, title, body, url, entity_type, entity_id, dedupe_key, push_after)
  values (p_user, p_kind, left(p_title, 120), left(p_body, 400), v_url, p_entity_type, p_entity_id, p_dedupe,
          public.notification_push_after(p_kind))
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke execute on function public.notify_user(uuid, text, text, text, text, text, uuid, text) from public, anon, authenticated;

-- Which action fits which kind. The app (src/lib/notifications/actions.ts)
-- shows the same list; this is the one that is enforced.
create or replace function public.notification_actions_for(p_kind text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_kind
    when 'task_assigned' then array['task_start', 'task_done']
    when 'task_soon' then array['task_done']
    when 'task_overdue' then array['task_done']
    when 'task_changed' then array['task_done']
    when 'event_responsible' then array['seen']
    when 'event_invite' then array['seen']
    when 'event_reminder' then array['seen']
    when 'event_soon' then array['seen']
    when 'event_changed' then array['seen']
    when 'request_assigned' then array['request_ack']
    when 'mentoring_check' then array['mentoring_snooze']
    else array[]::text[]
  end
$$;

create or replace function public.notification_quick_action(p_notification uuid, p_action text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_me uuid := public.current_app_user_id();
  v_n public.notifications%rowtype;
  v_hit uuid;
  v_before text;
  v_after text;
  v_result text := 'done';
  v_profile record;
begin
  if v_me is null or public.is_oauth_client_request() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into v_n from public.notifications where id = p_notification and user_id = v_me;
  if not found then
    raise exception 'notification not found' using errcode = 'P0002';
  end if;
  if not (p_action = any (public.notification_actions_for(v_n.kind))) then
    raise exception 'action not allowed for this notification' using errcode = '22023';
  end if;

  if p_action in ('task_start', 'task_done') then
    if v_n.entity_type is distinct from 'task' or v_n.entity_id is null then
      raise exception 'action not allowed for this notification' using errcode = '22023';
    end if;
    select status::text into v_before from public.tasks where id = v_n.entity_id;
    if v_before is null then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    v_after := case p_action when 'task_start' then 'in_progress' else 'completed' end;
    if v_before = v_after or v_before in ('completed', 'cancelled')
       or (p_action = 'task_start' and v_before <> 'open') then
      v_result := 'already';
    else
      update public.tasks
         set status = v_after::task_status,
             completed_at = case when v_after = 'completed' then now() else completed_at end
       where id = v_n.entity_id
      returning id into v_hit;
      if v_hit is null then
        raise exception 'not allowed' using errcode = '42501';
      end if;
    end if;

  elsif p_action = 'request_ack' then
    if v_n.entity_type is distinct from 'request' or v_n.entity_id is null then
      raise exception 'action not allowed for this notification' using errcode = '22023';
    end if;
    select status::text into v_before from public.requests where id = v_n.entity_id and assigned_to = v_me;
    if v_before is null then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    v_after := 'in_progress';
    if v_before <> 'open' then
      v_result := 'already';
    else
      update public.requests set status = 'in_progress' where id = v_n.entity_id and assigned_to = v_me
      returning id into v_hit;
      if v_hit is null then
        raise exception 'not allowed' using errcode = '42501';
      end if;
    end if;

  elsif p_action = 'mentoring_snooze' then
    if v_n.entity_type is distinct from 'mentoring_entry' or v_n.entity_id is null then
      raise exception 'action not allowed for this notification' using errcode = '22023';
    end if;
    -- One day from the check date it was due on, and only once: a second tap
    -- on the same notification finds the date already moved.
    select next_check_at::text into v_before from public.mentoring_entries where id = v_n.entity_id;
    if v_before is null then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    if v_before::date > (v_n.created_at at time zone 'Asia/Jerusalem')::date then
      v_result := 'already';
      v_after := v_before;
    else
      v_after := (v_before::date + 1)::text;
      update public.mentoring_entries set next_check_at = v_after::date where id = v_n.entity_id
      returning id into v_hit;
      if v_hit is null then
        raise exception 'not allowed' using errcode = '42501';
      end if;
    end if;
  end if;

  if v_result = 'done' and p_action <> 'seen' then
    select name, role into v_profile from public.users where id = v_me;
    insert into public.audit_logs (user_id, user_name, user_role, action_type, entity_type, entity_id, previous_value, new_value)
    values (
      v_me, v_profile.name, v_profile.role,
      case p_action
        when 'request_ack' then 'request_status_changed'
        when 'mentoring_snooze' then 'mentoring_entry_updated'
        else 'task_status_changed'
      end,
      v_n.entity_type, v_n.entity_id,
      jsonb_build_object(case when p_action = 'mentoring_snooze' then 'next_check_at' else 'status' end, v_before),
      jsonb_build_object(case when p_action = 'mentoring_snooze' then 'next_check_at' else 'status' end, v_after,
                         'via', 'notification')
    );
  end if;

  update public.notifications set read_at = now() where id = v_n.id and read_at is null;

  return jsonb_build_object('result', v_result, 'action', p_action, 'entity_type', v_n.entity_type, 'entity_id', v_n.entity_id);
end;
$$;

revoke execute on function public.notification_quick_action(uuid, text) from public, anon;
grant execute on function public.notification_quick_action(uuid, text) to authenticated;

-- The dispatcher needs the kind's actions for the phone's buttons; it already
-- gets the kind. Nothing else changes in delivery.
