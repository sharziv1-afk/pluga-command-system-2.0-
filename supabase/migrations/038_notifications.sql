-- 038_notifications.sql
--
-- Notifications, stage 1 (foundation). Run manually — first in the SANDBOX
-- (hjltpajvqhnygjybtivd), then in LIVE (vmfihyritfmjycrfpxjn). Idempotent.
-- The plan the company commander approved on 05.11.2026 is in
-- docs/NOTIFICATIONS.md.
--
--   notifications            — each user's inbox, behind the bell in the
--                              header. A user reads their own rows and may
--                              only set read_at. Rows are written by
--                              SECURITY DEFINER code only (stage 1: the test
--                              notification; stage 2: triggers), never by a
--                              client insert.
--   push_subscriptions       — the devices that allowed Web Push. Registered
--                              through register_push_subscription() so a
--                              phone that changes hands moves to the user who
--                              is signed in now, instead of failing on the
--                              unique endpoint.
--   notification_preferences — what a user muted. Used from stage 2.
--
-- OAuth (MCP) tokens may not write any of these (see 035).

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{1,40}$'),
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 400),
  -- In-app path only, so a notification can never send anyone off-site.
  url text check (url is null or (url ~ '^/[^/\\]' and char_length(url) <= 300)),
  entity_type text,
  entity_id uuid,
  -- One notification per event: stage 2/3 producers set a key such as
  -- 'task_due:<task id>:<due_at>' so a re-run never sends twice.
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications: select own" on public.notifications;
create policy "notifications: select own"
  on public.notifications for select to authenticated
  using ( user_id = public.current_app_user_id() );

drop policy if exists "notifications: mark own read" on public.notifications;
create policy "notifications: mark own read"
  on public.notifications for update to authenticated
  using ( user_id = public.current_app_user_id() )
  with check ( user_id = public.current_app_user_id() );

-- The update policy is for read_at alone: the column grant stops a client
-- from rewriting a notification's text or owner.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists "oauth: no update" on public.notifications;
create policy "oauth: no update" on public.notifications
  as restrictive for update to authenticated
  using (not public.is_oauth_client_request())
  with check (not public.is_oauth_client_request());

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{16,32}$'),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: select own" on public.push_subscriptions;
create policy "push_subscriptions: select own"
  on public.push_subscriptions for select to authenticated
  using ( user_id = public.current_app_user_id() );

-- Turning notifications off on a device, and the sender dropping an endpoint
-- the push service reports as gone (404/410).
drop policy if exists "push_subscriptions: delete own" on public.push_subscriptions;
create policy "push_subscriptions: delete own"
  on public.push_subscriptions for delete to authenticated
  using ( user_id = public.current_app_user_id() );

revoke insert, update on public.push_subscriptions from anon, authenticated;

drop policy if exists "oauth: no delete" on public.push_subscriptions;
create policy "oauth: no delete" on public.push_subscriptions
  as restrictive for delete to authenticated
  using (not public.is_oauth_client_request());

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.current_app_user_id();
  v_id uuid;
begin
  if v_user is null or public.is_oauth_client_request() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_user, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now(),
        last_failure_at = null,
        failure_count = 0
  returning id into v_id;

  -- A person has a few devices, not dozens: keep the newest ten.
  delete from public.push_subscriptions
   where user_id = v_user
     and id not in (
       select id from public.push_subscriptions
        where user_id = v_user
        order by created_at desc
        limit 10
     );

  return v_id;
end;
$$;

revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- notification_preferences
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  muted_kinds text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences: select own" on public.notification_preferences;
create policy "notification_preferences: select own"
  on public.notification_preferences for select to authenticated
  using ( user_id = public.current_app_user_id() );

drop policy if exists "notification_preferences: insert own" on public.notification_preferences;
create policy "notification_preferences: insert own"
  on public.notification_preferences for insert to authenticated
  with check ( user_id = public.current_app_user_id() );

drop policy if exists "notification_preferences: update own" on public.notification_preferences;
create policy "notification_preferences: update own"
  on public.notification_preferences for update to authenticated
  using ( user_id = public.current_app_user_id() )
  with check ( user_id = public.current_app_user_id() );

revoke delete on public.notification_preferences from anon, authenticated;

drop policy if exists "oauth: no insert" on public.notification_preferences;
create policy "oauth: no insert" on public.notification_preferences
  as restrictive for insert to authenticated
  with check (not public.is_oauth_client_request());

drop policy if exists "oauth: no update" on public.notification_preferences;
create policy "oauth: no update" on public.notification_preferences
  as restrictive for update to authenticated
  using (not public.is_oauth_client_request())
  with check (not public.is_oauth_client_request());

-- ---------------------------------------------------------------------------
-- The test notification ("שלח התראת בדיקה" in the profile)
-- ---------------------------------------------------------------------------
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

  insert into public.notifications (user_id, kind, title, body, url)
  values (v_user, 'test', 'התראת בדיקה', 'ההתראות פועלות במכשיר הזה.', '/profile')
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'title', v_row.title, 'body', v_row.body, 'url', v_row.url);
end;
$$;

revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;
