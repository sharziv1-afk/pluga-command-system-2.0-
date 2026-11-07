-- 045_notifications_stage5.sql
--
-- Notifications, stage 5: the rest of the approved plan (docs/NOTIFICATIONS.md).
-- Run manually — SANDBOX first, then LIVE. Idempotent. Needs 038–044.
--
--   #6  my task was cancelled, or its due time moved      → the assignee
--   #11 a request linked to an event 48h away, not approved → handler, requester
--   #18 a mentoring check passed two days ago, not updated  → whoever wrote it
--   #23 a gap was handed to me                               → the handler
--   #24 an urgent gap (דחוף / קריטי) was opened             → מ״פ and סמ״פ,
--       also during quiet hours. The weekend hold (043) still applies, as
--       decided for every kind on 06.11.2026.
--   Gap notifications now open the gaps tab (they opened the dashboard,
--   which has no gaps).
--   notification_push_users(): which users have push on, for the admin page.
--   Commanders only.

-- ---------------------------------------------------------------------------
-- Quiet hours: an urgent gap is pushed at night too.
-- ---------------------------------------------------------------------------
create or replace function public.notification_push_after(p_kind text, p_at timestamptz default now())
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Jerusalem';
  v_dow int := extract(dow from v_local)::int;  -- 5 = Friday, 6 = Saturday
  v_hour int := extract(hour from v_local)::int;
begin
  if (v_dow = 5 and v_local::time >= time '17:00') or (v_dow = 6 and v_local::time < time '19:00') then
    return ((v_local::date + case when v_dow = 5 then 1 else 0 end) + time '19:00') at time zone 'Asia/Jerusalem';
  end if;
  if v_hour between 6 and 22 or p_kind in ('event_soon', 'task_soon', 'gap_urgent') then
    return p_at;
  end if;
  return ((v_local::date + case when v_hour >= 23 then 1 else 0 end) + time '06:00') at time zone 'Asia/Jerusalem';
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks: #1, #4, #5 as before, plus #6.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_actor_name text;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_actor := public.current_app_user_id();
  select name into v_actor_name from public.users where id = v_actor;

  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.status::text not in ('completed', 'cancelled')
     and (new.assigned_to is distinct from v_actor or new.created_by = v_actor) then
    perform public.notify_user(new.assigned_to, 'task_assigned',
      case when new.assigned_to = new.created_by then 'משימה אישית חדשה'
           else 'קיבלת משימה מ־' || coalesce(v_actor_name, 'המערכת') end,
      new.title, '/tasks', 'task', new.id, 'task_assigned:' || new.id || ':' || new.assigned_to || ':' || txid_current());
  end if;

  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status::text in ('blocked', 'completed')
     and new.created_by is not null
     and new.created_by is distinct from v_actor then
    perform public.notify_user(new.created_by,
      case when new.status::text = 'blocked' then 'task_blocked' else 'task_completed' end,
      case when new.status::text = 'blocked' then 'משימה נתקעה' else 'משימה הושלמה' end,
      new.title, '/tasks', 'task', new.id, 'task_status:' || new.id || ':' || new.status || ':' || txid_current());
  end if;

  -- #6: the same person still holds it, and someone else cancelled it or
  -- moved its due time. A hand-over is #1 above, not this.
  if tg_op = 'UPDATE'
     and new.assigned_to is not null
     and new.assigned_to is not distinct from old.assigned_to
     and new.assigned_to is distinct from v_actor then
    if new.status::text = 'cancelled' and old.status::text <> 'cancelled' then
      perform public.notify_user(new.assigned_to, 'task_cancelled', 'משימה בוטלה', new.title,
        '/tasks', 'task', new.id, 'task_cancelled:' || new.id || ':' || txid_current());
    elsif new.status::text not in ('completed', 'cancelled')
          and new.due_at is not null
          and new.due_at is distinct from old.due_at then
      perform public.notify_user(new.assigned_to, 'task_changed', 'יעד המשימה שונה', new.title,
        '/tasks', 'task', new.id, 'task_changed:' || new.id || ':' || extract(epoch from new.due_at)::bigint || ':' || txid_current());
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists notify_on_task_change on public.tasks;
create trigger notify_on_task_change
  after insert or update of assigned_to, status, due_at on public.tasks
  for each row execute function public.notify_on_task_change();

-- ---------------------------------------------------------------------------
-- Gaps: #22 as before, plus #23 and #24. All open the gaps tab.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_gap_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_url text := '/requests?view=gaps';
  v_urgent boolean;
  r uuid;
begin
  if auth.uid() is null or coalesce(new.status, '') = 'נסגר' then
    return null;
  end if;
  v_actor := public.current_app_user_id();
  v_urgent := new.urgency in ('דחוף', 'קריטי')
              and (tg_op = 'INSERT' or old.urgency not in ('דחוף', 'קריטי'));

  if v_urgent then
    for r in
      select id from public.users
       where status = 'active' and public.notification_role_key(role) in ('מ"פ', 'סמ"פ') and id is distinct from v_actor
    loop
      perform public.notify_user(r, 'gap_urgent', 'נפתח פער דחוף', new.title, v_url, 'gap', new.id, 'gap_urgent:' || new.id || ':' || r);
    end loop;
  end if;

  -- An urgent gap already reached מ״פ; one notification is enough.
  if coalesce(new.requires_commander_decision, false)
     and not (tg_op = 'UPDATE' and coalesce(old.requires_commander_decision, false))
     and not v_urgent then
    for r in
      select id from public.users
       where status = 'active' and public.notification_role_key(role) = 'מ"פ' and id is distinct from v_actor
    loop
      perform public.notify_user(r, 'gap_decision', 'פער מחכה להחלטתך', new.title, v_url, 'gap', new.id, 'gap_decision:' || new.id || ':' || r);
    end loop;
  end if;

  if new.handler_id is not null
     and (tg_op = 'INSERT' or new.handler_id is distinct from old.handler_id)
     and new.handler_id is distinct from v_actor then
    perform public.notify_user(new.handler_id, 'gap_assigned', 'פער הועבר לטיפולך', new.title,
      v_url, 'gap', new.id, 'gap_assigned:' || new.id || ':' || new.handler_id || ':' || txid_current());
  end if;

  return null;
end;
$$;

drop trigger if exists notify_on_gap_change on public.gaps;
create trigger notify_on_gap_change
  after insert or update of requires_commander_decision, handler_id, urgency on public.gaps
  for each row execute function public.notify_on_gap_change();

revoke execute on function public.notify_on_task_change() from public, anon, authenticated;
revoke execute on function public.notify_on_gap_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The tick: 042's, with #11 and #18, and mentoring links to the entry.
-- ---------------------------------------------------------------------------
create or replace function public.notifications_tick(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (p_now at time zone 'Asia/Jerusalem')::date;
  v_local time := (p_now at time zone 'Asia/Jerusalem')::time;
  -- A reminder fires when its moment fell within the last 10 minutes, so a
  -- missed minute is caught up but a stale one is never sent.
  v_window interval := interval '10 minutes';
  v_morning boolean := v_local >= time '07:00' and v_local < time '07:10';
  v_deadline timestamptz;
  v_missing text;
  v_url text;
  rec record;
  r uuid;
begin
  if exists (select 1 from public.notification_settings where key = 'reminders_paused' and value = 'true') then
    return;
  end if;
  perform set_config('app.notifications_tick', 'on', true);

  -- Events: 24 hours, 1 hour and 5 minutes before.
  for rec in
    select e.id, e.title, e.starts_at, o.offset_label, o.kind,
           public.event_audience_user_ids(e.notify_audience, e.unit_id, e.responsible_user_id, e.notify_user_ids)
             || e.responsible_user_id as recipients
      from public.events e
      cross join (values (interval '24 hours', '24h', 'event_reminder'),
                         (interval '1 hour', '1h', 'event_soon'),
                         (interval '5 minutes', '5m', 'event_soon')) as o(before, offset_label, kind)
     where e.status::text not in ('cancelled', 'completed')
       and e.starts_at - o.before <= p_now
       and e.starts_at - o.before > p_now - v_window
       and (e.notify_audience <> 'none' or e.responsible_user_id is not null)
  loop
    for r in select distinct x from unnest(rec.recipients) x where x is not null loop
      perform public.notify_user(r, rec.kind,
        case when rec.offset_label = '5m' then 'המופע מתחיל בעוד 5 דקות' else 'המופע הבא: ' || rec.title end,
        case when rec.offset_label = '5m' then rec.title else null end,
        '/schedule?date=' || to_char(rec.starts_at at time zone 'Asia/Jerusalem', 'YYYY-MM-DD'), 'event', rec.id,
        'event_' || rec.offset_label || ':' || rec.id || ':' || r || ':' || extract(epoch from rec.starts_at)::bigint);
    end loop;
  end loop;

  -- Tasks: 07:00, one note per person listing what is due today.
  if v_morning then
    for rec in
      select t.assigned_to as user_id, count(*) as n, string_agg(t.title, ' · ' order by t.due_at) as titles
        from public.tasks t
       where t.assigned_to is not null
         and t.status::text not in ('completed', 'cancelled')
         and (t.due_at at time zone 'Asia/Jerusalem')::date = v_today
       group by t.assigned_to
    loop
      perform public.notify_user(rec.user_id, 'task_today',
        case when rec.n = 1 then 'משימה לביצוע היום' else 'יש לך ' || rec.n || ' משימות להיום' end,
        rec.titles, '/tasks', null, null, 'task_today:' || rec.user_id || ':' || v_today);
    end loop;
  end if;

  -- Tasks: 5 minutes before the due time, and once when overdue.
  for rec in
    select t.id, t.title, t.due_at, t.assigned_to, t.created_by,
           case when t.due_at <= p_now then 'overdue' else 'soon' end as stage
      from public.tasks t
     where t.status::text not in ('completed', 'cancelled')
       and t.due_at is not null
       and (
         (t.due_at - interval '5 minutes' <= p_now and t.due_at - interval '5 minutes' > p_now - v_window and t.due_at > p_now)
         or (t.due_at <= p_now and t.due_at > p_now - v_window)
       )
  loop
    if rec.stage = 'soon' then
      perform public.notify_user(rec.assigned_to, 'task_soon', 'עוד 5 דקות ליעד המשימה', rec.title,
        '/tasks', 'task', rec.id, 'task_soon:' || rec.id || ':' || extract(epoch from rec.due_at)::bigint);
    else
      for r in select distinct x from unnest(array[rec.assigned_to, rec.created_by]) x where x is not null loop
        perform public.notify_user(r, 'task_overdue', 'משימה באיחור', rec.title,
          '/tasks', 'task', rec.id, 'task_overdue:' || rec.id || ':' || r || ':' || extract(epoch from rec.due_at)::bigint);
      end loop;
    end if;
  end loop;

  -- Forum: the day's deadline (default 20:00).
  v_deadline := (v_today + coalesce((select deadline from public.forum_deadlines where report_date = v_today), time '20:00'))
                at time zone 'Asia/Jerusalem';

  if p_now >= v_deadline - interval '1 hour' and p_now < v_deadline then
    for r in
      select u.id
        from public.users u
        join public.forum_slot_status(v_today) s on s.role_key = public.notification_role_key(u.role)
       where u.status = 'active' and not s.is_done
    loop
      perform public.notify_user(r, 'forum_reminder', 'זה הזמן להגיש פורום מוביל', null,
        '/forum', null, null, 'forum_reminder:' || v_today || ':' || r);
    end loop;
  end if;

  if p_now >= v_deadline and p_now < v_deadline + interval '2 hours' then
    select string_agg(label, ', ') into v_missing from public.forum_slot_status(v_today) where not is_done;
    if v_missing is not null then
      for r in
        select id from public.users
         where status = 'active' and public.notification_role_key(role) in ('מ"פ', 'סמ"פ')
      loop
        perform public.notify_user(r, 'forum_missing', 'חסרים דוחות בפורום המוביל', 'חסרים: ' || v_missing,
          '/forum', null, null, 'forum_missing:' || v_today || ':' || r);
      end loop;
    end if;
  end if;

  if not exists (select 1 from public.forum_slot_status(v_today) where not is_done) then
    for r in select id from public.users where status = 'active' and public.notification_role_key(role) = 'מ"פ' loop
      perform public.notify_user(r, 'forum_complete', 'כל הדוחות בפורום הוגשו', null,
        '/forum', null, null, 'forum_complete:' || v_today || ':' || r);
    end loop;
  end if;

  -- Mentoring: 07:00 on the check day (#17), and once two days after a check
  -- nobody updated (#18). The link opens the mentee's log at the entry.
  if v_morning then
    for rec in
      select m.id, m.created_by, m.mentee_user_id, u.name as mentee
        from public.mentoring_entries m
        left join public.users u on u.id = m.mentee_user_id
       where m.next_check_at = v_today and m.created_by is not null
    loop
      perform public.notify_user(rec.created_by, 'mentoring_check', 'היום בדיקת חניכה', rec.mentee,
        '/mentoring?mentee=' || rec.mentee_user_id, 'mentoring_entry', rec.id, 'mentoring_check:' || rec.id || ':' || v_today);
    end loop;

    for rec in
      select m.id, m.created_by, m.mentee_user_id, m.next_check_at, u.name as mentee
        from public.mentoring_entries m
        left join public.users u on u.id = m.mentee_user_id
       where m.next_check_at = v_today - 2
         and m.created_by is not null
         and m.updated_at < (m.next_check_at::timestamp at time zone 'Asia/Jerusalem')
    loop
      perform public.notify_user(rec.created_by, 'mentoring_overdue', 'בדיקת חניכה לא עודכנה', rec.mentee,
        '/mentoring?mentee=' || rec.mentee_user_id, 'mentoring_entry', rec.id, 'mentoring_overdue:' || rec.id || ':' || rec.next_check_at);
    end loop;
  end if;

  -- Requests linked to an event 48 hours away that are still not approved
  -- (#11): once, to the handler and to whoever asked.
  for rec in
    select q.id, q.title, q.assigned_to, q.requested_by, e.id as event_id, e.starts_at
      from public.events e
      join public.requests q on q.event_id = e.id
     where e.status::text not in ('cancelled', 'completed')
       and e.starts_at - interval '48 hours' <= p_now
       and e.starts_at - interval '48 hours' > p_now - v_window
       and q.status::text in ('open', 'in_progress')
  loop
    for r in select distinct x from unnest(array[rec.assigned_to, rec.requested_by]) x where x is not null loop
      perform public.notify_user(r, 'request_event_soon', 'דרישה למופע עוד לא אושרה', rec.title,
        '/requests', 'request', rec.id, 'request_event_soon:' || rec.id || ':' || r || ':' || extract(epoch from rec.starts_at)::bigint);
    end loop;
  end loop;

  -- Cleanup (06.11.2026): read after 7 days, anything after 30.
  delete from public.notifications
   where (read_at is not null and read_at < p_now - interval '7 days')
      or created_at < p_now - interval '30 days';

  -- One poke for everything due, including pushes held by quiet hours.
  perform set_config('app.notifications_tick', 'off', true);
  if exists (
    select 1 from public.notifications
     where pushed_at is null and push_after <= now() and created_at > now() - interval '2 days'
  ) then
    select value into v_url from public.notification_settings where key = 'dispatch_url';
    if v_url is not null then
      begin
        perform net.http_post(url := v_url, body := '{}'::jsonb, timeout_milliseconds := 5000);
      exception when others then
        null;
      end;
    end if;
  end if;
end;
$$;
revoke execute on function public.notifications_tick(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: who has push on (decision ד׳, 05.11.2026). Ids only, commanders only.
-- ---------------------------------------------------------------------------
create or replace function public.notification_push_users()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct s.user_id
    from public.push_subscriptions s
   where public.is_commander(auth.uid())
     and not public.is_oauth_client_request()
$$;

revoke execute on function public.notification_push_users() from public, anon;
grant execute on function public.notification_push_users() to authenticated;
