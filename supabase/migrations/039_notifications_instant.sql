-- 039_notifications_instant.sql
--
-- Notifications, stage 2: instant notifications (docs/NOTIFICATIONS.md, plan
-- approved 06.11.2026). Run manually — SANDBOX first, then LIVE. Idempotent.
-- Needs 038.
--
-- Producers: AFTER triggers on tasks, events, requests, gaps and users write
-- rows into notifications through notify_user(). Triggers, not app code, so
-- a change made from the site, Claude or ChatGPT notifies the same way.
--   * Nobody is notified about their own action — except a task someone
--     creates and assigns to themselves (a personal task), which still
--     notifies them (company commander, 06.11.2026).
--   * A write with no signed-in user (manual SQL, imports) notifies nobody,
--     so a schedule import can never flood anyone.
--   * 23:00–06:00 (Jerusalem) a notification lands in the bell at once and
--     its push waits for 06:00 (push_after).
--
-- Delivery: an insert into notifications pokes /api/notifications/dispatch
-- through pg_net with an empty body. The route holds the dispatch key (in
-- Vercel only; just its SHA-256 is stored here) and calls
-- claim_pending_pushes(), the only way to read other users' pending
-- notifications and devices. A stranger hitting the route can only cause
-- what is already pending to be sent. No service-role key anywhere.
-- The poke URL lives in notification_settings ('dispatch_url'); with no row,
-- as in the sandbox, nothing is poked.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Private config: dispatch URL and dispatch key hashes. No client access.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon, authenticated;

create table if not exists public.notification_dispatch_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.notification_dispatch_keys enable row level security;
revoke all on public.notification_dispatch_keys from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Event audience (who an event notifies). 'none' by default: the schedule
-- holds 10–18 company events a day, so notifying the whole staff by default
-- would mean ~25 pushes a day each (decided 05.11.2026).
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists notify_audience text not null default 'none',
  add column if not exists notify_user_ids uuid[] not null default '{}';

alter table public.events drop constraint if exists events_notify_audience_check;
alter table public.events add constraint events_notify_audience_check
  check (notify_audience in ('none', 'responsible', 'unit', 'forum', 'custom'));

alter table public.notifications
  add column if not exists push_after timestamptz not null default now();

create index if not exists notifications_pending_push_idx
  on public.notifications(push_after) where pushed_at is null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- "מ״מ  1" and 'מ"מ 1' are the same role (same rule as normalizeRole in the app).
create or replace function public.notification_role_key(p_role text)
returns text
language sql
immutable
as $$
  select regexp_replace(btrim(translate(coalesce(p_role, ''), '״׳', '"''')), '\s+', ' ', 'g')
$$;

-- "יום ג׳ 12.11 08:00", Jerusalem time.
create or replace function public.notification_when(p_at timestamptz)
returns text
language sql
stable
as $$
  select 'יום ' || (array['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'])[extract(dow from p_at at time zone 'Asia/Jerusalem')::int + 1]
         || ' ' || to_char(p_at at time zone 'Asia/Jerusalem', 'DD.MM HH24:MI')
$$;

-- Quiet hours: 23:00–06:00 Jerusalem, the push waits for 06:00.
create or replace function public.notification_push_after(p_kind text)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_local timestamp := now() at time zone 'Asia/Jerusalem';
  v_hour int := extract(hour from v_local)::int;
begin
  if v_hour between 6 and 22 then
    return now();
  end if;
  return ((v_local::date + case when v_hour >= 23 then 1 else 0 end) + time '06:00') at time zone 'Asia/Jerusalem';
end;
$$;

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
begin
  if p_user is null or not exists (select 1 from public.users where id = p_user and status = 'active') then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, url, entity_type, entity_id, dedupe_key, push_after)
  values (p_user, p_kind, left(p_title, 120), left(p_body, 400), p_url, p_entity_type, p_entity_id, p_dedupe,
          public.notification_push_after(p_kind))
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke execute on function public.notify_user(uuid, text, text, text, text, text, uuid, text) from public, anon, authenticated;

-- Who an event's audience is. 'responsible' is just the responsible person;
-- 'unit' is every active profile in the event's unit and the units under it;
-- 'forum' is the nine roles that own a daily forum report (06.11.2026).
create or replace function public.event_audience_user_ids(
  p_audience text,
  p_unit uuid,
  p_responsible uuid,
  p_custom uuid[]
)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct x), '{}')
  from (
    select p_responsible as x where p_audience <> 'none'
    union all
    select u.id from public.users u
     where p_audience = 'unit' and u.status = 'active'
       and u.unit_id in (
         with recursive tree as (
           select id from public.units where id = p_unit
           union all
           select child.id from public.units child join tree on child.parent_unit_id = tree.id
         )
         select id from tree
       )
    union all
    select u.id from public.users u
     where p_audience = 'forum' and u.status = 'active'
       and public.notification_role_key(u.role) = any (array[
         'מ"פ', 'סמ"פ', 'מ"מ 1', 'מ"מ 2', 'מ"מ 3', 'מ"מ 4', 'מש"ד', 'רס"פ / לוגיסטיקה', 'חובש פלוגתי'
       ])
    union all
    select unnest(p_custom) where p_audience = 'custom'
  ) audience
  where x is not null
$$;

revoke execute on function public.event_audience_user_ids(text, uuid, uuid, uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Producers
-- ---------------------------------------------------------------------------

-- Tasks: #1 assigned to me (also a personal task), #4 blocked, #5 completed.
create or replace function public.notify_on_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_actor_name text;
  v_body text;
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
    v_body := case when new.assigned_to = new.created_by then 'משימה אישית'
                   else 'מאת ' || coalesce(v_actor_name, 'המערכת') end;
    if new.due_at is not null then
      v_body := v_body || ' · יעד ' || public.notification_when(new.due_at);
    end if;
    perform public.notify_user(new.assigned_to, 'task_assigned', 'משימה חדשה: ' || new.title, v_body,
      '/tasks', 'task', new.id, 'task_assigned:' || new.id || ':' || new.assigned_to || ':' || txid_current());
  end if;

  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status::text in ('blocked', 'completed')
     and new.created_by is not null
     and new.created_by is distinct from v_actor then
    perform public.notify_user(new.created_by,
      case when new.status::text = 'blocked' then 'task_blocked' else 'task_completed' end,
      case when new.status::text = 'blocked' then 'משימה תקועה: ' else 'משימה הושלמה: ' end || new.title,
      case when new.status::text = 'blocked' then 'סומנה כתקועה על ידי ' else 'הושלמה על ידי ' end || coalesce(v_actor_name, 'המערכת'),
      '/tasks', 'task', new.id, 'task_status:' || new.id || ':' || new.status || ':' || txid_current());
  end if;

  return null;
end;
$$;

drop trigger if exists notify_on_task_change on public.tasks;
create trigger notify_on_task_change
  after insert or update of assigned_to, status on public.tasks
  for each row execute function public.notify_on_task_change();

-- Events: #7 responsible, #8 audience, #10 moved or cancelled.
create or replace function public.notify_on_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_actor_name text;
  v_detail text;
  v_url text;
  v_new uuid[];
  v_old uuid[] := '{}';
  v_recipients uuid[];
  v_change text;
  r uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_actor := public.current_app_user_id();
  select name into v_actor_name from public.users where id = v_actor;

  v_detail := public.notification_when(new.starts_at) || coalesce(' · ' || nullif(btrim(new.location), ''), '');
  v_url := '/schedule?date=' || to_char(new.starts_at at time zone 'Asia/Jerusalem', 'YYYY-MM-DD');
  v_new := public.event_audience_user_ids(new.notify_audience, new.unit_id, new.responsible_user_id, new.notify_user_ids);
  if tg_op = 'UPDATE' then
    v_old := public.event_audience_user_ids(old.notify_audience, old.unit_id, old.responsible_user_id, old.notify_user_ids);
  end if;

  if new.status::text <> 'cancelled'
     and new.responsible_user_id is not null
     and new.responsible_user_id is distinct from v_actor
     and (tg_op = 'INSERT' or new.responsible_user_id is distinct from old.responsible_user_id) then
    perform public.notify_user(new.responsible_user_id, 'event_responsible', 'מופע באחריותך: ' || new.title, v_detail,
      v_url, 'event', new.id, 'event_responsible:' || new.id || ':' || new.responsible_user_id || ':' || txid_current());
  end if;

  if tg_op = 'UPDATE' then
    if new.status::text = 'cancelled' and old.status::text <> 'cancelled' then
      v_change := 'בוטל';
      v_recipients := v_old || old.responsible_user_id || new.responsible_user_id;
    elsif new.status::text <> 'cancelled' and new.starts_at is distinct from old.starts_at then
      v_change := 'הוזז ל־' || v_detail;
      -- People added to the audience in this same edit get an invitation below.
      v_recipients := (select coalesce(array_agg(x), '{}') from unnest(v_new) x where x = any (v_old))
                      || new.responsible_user_id;
    end if;

    if v_change is not null then
      for r in select distinct x from unnest(v_recipients) x where x is not null loop
        if r is distinct from v_actor then
          perform public.notify_user(r, 'event_changed', 'שינוי במופע: ' || new.title, v_change,
            v_url, 'event', new.id, 'event_changed:' || new.id || ':' || r || ':' || md5(v_change) || ':' || txid_current());
        end if;
      end loop;
    end if;
  end if;

  if new.status::text <> 'cancelled' then
    for r in select x from unnest(v_new) x loop
      if r is distinct from v_actor
         and r is distinct from new.responsible_user_id
         and not (r = any (v_old)) then
        perform public.notify_user(r, 'event_invite', new.title,
          v_detail || ' · נקבע על ידי ' || coalesce(v_actor_name, 'המערכת'),
          v_url, 'event', new.id, 'event_invite:' || new.id || ':' || r || ':' || txid_current());
      end if;
    end loop;
  end if;

  return null;
end;
$$;

drop trigger if exists notify_on_event_change on public.events;
create trigger notify_on_event_change
  after insert or update of starts_at, status, responsible_user_id, notify_audience, notify_user_ids, unit_id on public.events
  for each row execute function public.notify_on_event_change();

-- Requests: #19 assigned to me, #20 my request was decided.
create or replace function public.notify_on_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_actor_name text;
  v_requester_name text;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_actor := public.current_app_user_id();
  select name into v_actor_name from public.users where id = v_actor;

  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to is distinct from v_actor
     and new.status::text in ('open', 'in_progress') then
    select name into v_requester_name from public.users where id = new.requested_by;
    perform public.notify_user(new.assigned_to, 'request_assigned', 'דרישה לטיפולך: ' || new.title,
      'מאת ' || coalesce(v_requester_name, v_actor_name, 'המערכת'),
      '/requests', 'request', new.id, 'request_assigned:' || new.id || ':' || new.assigned_to || ':' || txid_current());
  end if;

  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status::text in ('approved', 'rejected', 'completed')
     and new.requested_by is not null
     and new.requested_by is distinct from v_actor then
    perform public.notify_user(new.requested_by, 'request_status',
      'הדרישה ' || case new.status::text when 'approved' then 'אושרה' when 'rejected' then 'נדחתה' else 'הושלמה' end || ': ' || new.title,
      'עודכן על ידי ' || coalesce(v_actor_name, 'המערכת'),
      '/requests', 'request', new.id, 'request_status:' || new.id || ':' || new.status || ':' || txid_current());
  end if;

  return null;
end;
$$;

drop trigger if exists notify_on_request_change on public.requests;
create trigger notify_on_request_change
  after insert or update of assigned_to, status on public.requests
  for each row execute function public.notify_on_request_change();

-- Gaps: #22 a gap that needs the company commander's decision.
create or replace function public.notify_on_gap_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_reporter_name text;
  r uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  if not coalesce(new.requires_commander_decision, false)
     or coalesce(new.status, '') = 'נסגר'
     or (tg_op = 'UPDATE' and coalesce(old.requires_commander_decision, false)) then
    return null;
  end if;
  v_actor := public.current_app_user_id();
  select name into v_reporter_name from public.users where id = coalesce(new.reported_by, new.created_by);

  for r in
    select id from public.users
     where status = 'active' and public.notification_role_key(role) = 'מ"פ' and id is distinct from v_actor
  loop
    perform public.notify_user(r, 'gap_decision', 'פער להחלטתך: ' || new.title,
      coalesce(new.urgency, 'חשוב') || ' · דווח על ידי ' || coalesce(v_reporter_name, 'המערכת'),
      '/dashboard', 'gap', new.id, 'gap_decision:' || new.id || ':' || r);
  end loop;
  return null;
end;
$$;

drop trigger if exists notify_on_gap_change on public.gaps;
create trigger notify_on_gap_change
  after insert or update of requires_commander_decision on public.gaps
  for each row execute function public.notify_on_gap_change();

-- Users: #25 a signed-in profile waits for approval. The pending person is
-- the actor here, and has no active profile yet, so only the session counts.
create or replace function public.notify_on_user_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r uuid;
begin
  if auth.uid() is null
     or new.role_approval_status::text <> 'pending'
     or new.auth_user_id is null
     or new.status::text = 'blocked'
     or (tg_op = 'UPDATE' and old.role_approval_status::text = 'pending' and old.auth_user_id is not null) then
    return null;
  end if;

  for r in
    select id from public.users
     where status = 'active' and role_approval_status = 'approved'
       and public.notification_role_key(role) in ('מ"פ', 'סמ"פ') and id <> new.id
  loop
    perform public.notify_user(r, 'user_pending', 'משתמש ממתין לאישור: ' || coalesce(nullif(btrim(new.name), ''), new.email),
      new.role, '/admin', 'user', new.id, 'user_pending:' || new.id || ':' || r);
  end loop;
  return null;
end;
$$;

drop trigger if exists notify_on_user_pending on public.users;
create trigger notify_on_user_pending
  after insert or update of role_approval_status, auth_user_id on public.users
  for each row execute function public.notify_on_user_pending();

revoke execute on function public.notify_on_task_change() from public, anon, authenticated;
revoke execute on function public.notify_on_event_change() from public, anon, authenticated;
revoke execute on function public.notify_on_request_change() from public, anon, authenticated;
revoke execute on function public.notify_on_gap_change() from public, anon, authenticated;
revoke execute on function public.notify_on_user_pending() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------------

-- One poke per statement, empty body: "there may be something to send".
create or replace function public.notifications_poke_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
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

revoke execute on function public.notifications_poke_dispatch() from public, anon, authenticated;

drop trigger if exists notifications_poke_dispatch on public.notifications;
create trigger notifications_poke_dispatch
  after insert on public.notifications
  for each statement execute function public.notifications_poke_dispatch();

create or replace function public.notification_dispatch_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_key is not null and length(p_key) >= 32 and exists (
    select 1 from public.notification_dispatch_keys
     where key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex') and revoked_at is null
  )
$$;

revoke execute on function public.notification_dispatch_key_ok(text) from public, anon, authenticated;

-- Hands the dispatcher what is due and marks it pushed in the same step, so
-- two pokes at once never send the same notification twice. Muted kinds are
-- marked and skipped (they stay in the bell).
create or replace function public.claim_pending_pushes(p_key text, p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.notification_dispatch_key_ok(p_key) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with picked as (
    select n.id
      from public.notifications n
     where n.pushed_at is null
       and n.push_after <= now()
       and n.created_at > now() - interval '2 days'
     order by n.created_at
     limit least(greatest(coalesce(p_limit, 200), 1), 500)
     for update skip locked
  ), claimed as (
    update public.notifications n
       set pushed_at = now()
      from picked
     where n.id = picked.id
    returning n.id, n.user_id, n.kind, n.title, n.body, n.url
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'kind', c.kind, 'title', c.title, 'body', c.body, 'url', c.url,
           'subscriptions', subs.list
         )), '[]'::jsonb)
    into v_result
    from claimed c
    cross join lateral (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb) as list
        from public.push_subscriptions s
       where s.user_id = c.user_id
    ) subs
   where jsonb_array_length(subs.list) > 0
     and not exists (
       select 1 from public.notification_preferences p
        where p.user_id = c.user_id and c.kind = any (p.muted_kinds)
     );

  return v_result;
end;
$$;

revoke execute on function public.claim_pending_pushes(text, integer) from public;
grant execute on function public.claim_pending_pushes(text, integer) to anon, authenticated;

create or replace function public.record_push_results(p_key text, p_results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.notification_dispatch_key_ok(p_key) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  delete from public.push_subscriptions s
   using jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as r(subscription_id uuid, ok boolean, gone boolean)
   where s.id = r.subscription_id and r.gone;

  update public.push_subscriptions s
     set last_success_at = now(), failure_count = 0
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as r(subscription_id uuid, ok boolean, gone boolean)
   where s.id = r.subscription_id and r.ok;

  update public.push_subscriptions s
     set last_failure_at = now(), failure_count = s.failure_count + 1
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as r(subscription_id uuid, ok boolean, gone boolean)
   where s.id = r.subscription_id and not r.ok and not coalesce(r.gone, false);
end;
$$;

revoke execute on function public.record_push_results(text, jsonb) from public;
grant execute on function public.record_push_results(text, jsonb) to anon, authenticated;
