-- 042_notifications_reminders.sql
--
-- Notifications, stage 3: time-based reminders (docs/NOTIFICATIONS.md,
-- decided 06.11.2026). Run manually — SANDBOX first, then LIVE. Needs 038,
-- 039 and 041. Idempotent.
--
-- pg_cron runs notifications_tick() every minute. The tick writes what has
-- come due through notify_user() (039), each with a dedupe key so nothing is
-- sent twice, then pokes the dispatcher once. It takes the time as a
-- parameter so the sandbox can test any hour.
--
--   events  24 hours, 1 hour and 5 minutes before (responsible + audience;
--           an event with audience 'none' and no responsible sends nothing)
--   tasks   07:00 one note listing today's due tasks; 5 minutes before the
--           due time; once when overdue (assignee and creator)
--   forum   an hour before the day's deadline to whoever has not submitted;
--           at the deadline the missing list to מ"פ and סמ"פ; when all
--           eight reports are in, to מ"פ
--   mentoring  07:00 on the check day, to whoever wrote the entry
--   cleanup read notifications after 7 days, any after 30 (decided 06.11)
--
-- Quiet hours (23:00–06:00) still hold, except for the 1-hour and 5-minute
-- reminders: those are about something happening right then, and a push
-- held until 06:00 would arrive after it.
-- Pause everything with notification_settings ('reminders_paused', 'true').

create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------------
-- The daily forum deadline. No row for a date means 20:00.
-- ---------------------------------------------------------------------------
create table if not exists public.forum_deadlines (
  report_date date primary key,
  deadline time not null default '20:00',
  set_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.forum_deadlines enable row level security;

drop policy if exists "forum_deadlines: select active" on public.forum_deadlines;
create policy "forum_deadlines: select active"
  on public.forum_deadlines for select to authenticated
  using ( public.current_app_user_id() is not null );

-- מ"פ and סמ"פ set it (hasAdminAccess in the app).
drop policy if exists "forum_deadlines: commanders write" on public.forum_deadlines;
create policy "forum_deadlines: commanders write"
  on public.forum_deadlines for insert to authenticated
  with check ( exists (
    select 1 from public.users u
     where u.id = public.current_app_user_id()
       and public.notification_role_key(u.role) in ('מ"פ', 'סמ"פ')
  ) and set_by = public.current_app_user_id() );

drop policy if exists "forum_deadlines: commanders update" on public.forum_deadlines;
create policy "forum_deadlines: commanders update"
  on public.forum_deadlines for update to authenticated
  using ( exists (
    select 1 from public.users u
     where u.id = public.current_app_user_id()
       and public.notification_role_key(u.role) in ('מ"פ', 'סמ"פ')
  ) )
  with check ( set_by = public.current_app_user_id() );

revoke delete on public.forum_deadlines from anon, authenticated;

drop policy if exists "oauth: no insert" on public.forum_deadlines;
create policy "oauth: no insert" on public.forum_deadlines
  as restrictive for insert to authenticated
  with check (not public.is_oauth_client_request());

drop policy if exists "oauth: no update" on public.forum_deadlines;
create policy "oauth: no update" on public.forum_deadlines
  as restrictive for update to authenticated
  using (not public.is_oauth_client_request())
  with check (not public.is_oauth_client_request());

-- ---------------------------------------------------------------------------
-- Quiet hours: the 1-hour and 5-minute reminders go out at once.
-- ---------------------------------------------------------------------------
create or replace function public.notification_push_after(p_kind text)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_local timestamp := now() at time zone 'Asia/Jerusalem';
  v_hour int := extract(hour from v_local)::int;
begin
  if v_hour between 6 and 22 or p_kind in ('event_soon', 'task_soon') then
    return now();
  end if;
  return ((v_local::date + case when v_hour >= 23 then 1 else 0 end) + time '06:00') at time zone 'Asia/Jerusalem';
end;
$$;

-- The tick sets app.notifications_tick so each insert does not poke the
-- dispatcher on its own; the tick pokes once at the end.
create or replace function public.notifications_poke_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  if current_setting('app.notifications_tick', true) = 'on' then
    return null;
  end if;
  select value into v_url from public.notification_settings where key = 'dispatch_url';
  if v_url is null then
    return null;
  end if;
  begin
    perform net.http_post(url := v_url, body := '{}'::jsonb, timeout_milliseconds := 5000);
  exception when others then
    -- Never fail the user's write over a missed poke; the next one sends it.
    null;
  end;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- The eight reports of the daily forum, and whether each is in.
-- A platoon counts by its מ"מ owning the report or by its unit; a staff
-- report by its staff_role. "In" is submitted or closed, as in the app.
-- ---------------------------------------------------------------------------
create or replace function public.forum_slot_status(p_date date)
returns table (role_key text, label text, is_done boolean)
language sql
stable
security definer
set search_path = public
as $$
  with slots(level, role_key, staff_role, label, sort) as (
    values
      ('platoon', 'מ"מ 1', null, 'מ״מ 1', 1),
      ('platoon', 'מ"מ 2', null, 'מ״מ 2', 2),
      ('platoon', 'מ"מ 3', null, 'מ״מ 3', 3),
      ('platoon', 'מ"מ 4', null, 'מ״מ 4', 4),
      ('staff', 'חובש פלוגתי', 'medic', 'חופ״ל', 5),
      ('staff', 'מש"ד', 'assistant_commander', 'מש״ד', 6),
      ('staff', 'רס"פ / לוגיסטיקה', 'logistics_nco', 'רס״פ', 7),
      ('staff', 'סמ"פ', 'deputy_commander', 'סמ״פ', 8)
  ), holders as (
    select public.notification_role_key(u.role) as role_key, u.id, coalesce(u.commanded_unit_id, u.unit_id) as unit_id
      from public.users u
     where u.status = 'active'
  )
  select s.role_key, s.label, exists (
    select 1 from public.forum_daily_reports r
     where r.report_date = p_date
       and r.status in ('submitted', 'closed')
       and (
         (s.level = 'staff' and r.report_level = 'staff' and r.staff_role = s.staff_role)
         or (s.level = 'platoon' and r.report_level = 'platoon' and (
               r.owner_user_id in (select h.id from holders h where h.role_key = s.role_key)
               or r.platoon_unit_id in (select h.unit_id from holders h where h.role_key = s.role_key)
             ))
       )
  )
  from slots s
  order by s.sort
$$;

revoke execute on function public.forum_slot_status(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The tick
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

  -- Mentoring: 07:00 on the check day.
  if v_morning then
    for rec in
      select m.id, m.created_by, u.name as mentee
        from public.mentoring_entries m
        left join public.users u on u.id = m.mentee_user_id
       where m.next_check_at = v_today and m.created_by is not null
    loop
      perform public.notify_user(rec.created_by, 'mentoring_check', 'היום בדיקת חניכה', rec.mentee,
        '/mentoring', null, null, 'mentoring_check:' || rec.id || ':' || v_today);
    end loop;
  end if;

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

-- Every minute (5-minute reminders need it). Re-running updates the job.
select cron.schedule('notifications-tick', '* * * * *', 'select public.notifications_tick()');
