-- 037_calendar_feeds.sql
--
-- Personal calendar subscription links (ICS) for the phone/Mac calendar
-- widgets. Run manually — first in the SANDBOX (hjltpajvqhnygjybtivd), then
-- in LIVE (vmfihyritfmjycrfpxjn). Idempotent.
--
-- A calendar app cannot sign in, so each link carries a secret code. Only its
-- SHA-256 is stored; the code is shown once, when the user creates the link,
-- and a link is revoked by setting revoked_at.
--
-- calendar_feed(p_token_hash) is the only way to read through a code. It is
-- SECURITY DEFINER because the request has no user session, so it repeats the
-- SELECT rules of the tables it reads, for that code's user:
--   events               — commander, or created_by / responsible_user_id is
--                          the user, or same unit_id   (events: select *)
--   forum_daily_reports  — commander, or owner_user_id is the user
--                          (forum_daily_reports: * select *)
-- and only for an active, approved, linked user. Squad reports stay out, as in
-- the leading forum.

create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists calendar_feeds_user_id_idx on public.calendar_feeds(user_id);

alter table public.calendar_feeds enable row level security;

drop policy if exists "calendar_feeds: select own" on public.calendar_feeds;
create policy "calendar_feeds: select own"
  on public.calendar_feeds for select to authenticated
  using ( user_id = public.current_app_user_id() );

drop policy if exists "calendar_feeds: insert own" on public.calendar_feeds;
create policy "calendar_feeds: insert own"
  on public.calendar_feeds for insert to authenticated
  with check ( user_id = public.current_app_user_id() and revoked_at is null );

drop policy if exists "calendar_feeds: update own" on public.calendar_feeds;
create policy "calendar_feeds: update own"
  on public.calendar_feeds for update to authenticated
  using ( user_id = public.current_app_user_id() )
  with check ( user_id = public.current_app_user_id() );

-- No delete policy: a link is revoked, not erased.

-- OAuth (MCP) tokens may not create, change or remove links (see 035).
drop policy if exists "oauth: no insert" on public.calendar_feeds;
create policy "oauth: no insert" on public.calendar_feeds
  as restrictive for insert to authenticated
  with check (not public.is_oauth_client_request());

drop policy if exists "oauth: no update" on public.calendar_feeds;
create policy "oauth: no update" on public.calendar_feeds
  as restrictive for update to authenticated
  using (not public.is_oauth_client_request())
  with check (not public.is_oauth_client_request());

drop policy if exists "oauth: no delete" on public.calendar_feeds;
create policy "oauth: no delete" on public.calendar_feeds
  as restrictive for delete to authenticated
  using (not public.is_oauth_client_request());

create or replace function public.calendar_feed(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feed public.calendar_feeds%rowtype;
  v_user public.users%rowtype;
  v_is_commander boolean;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_from timestamptz := ((v_today - 2)::timestamp at time zone 'Asia/Jerusalem');
  v_to timestamptz := ((v_today + 15)::timestamp at time zone 'Asia/Jerusalem');
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select * into v_feed
    from public.calendar_feeds
   where token_hash = p_token_hash and revoked_at is null;
  if not found then
    return null;
  end if;

  select * into v_user from public.users where id = v_feed.user_id;
  if not found
     or v_user.auth_user_id is null
     or v_user.status <> 'active'
     or v_user.role_approval_status <> 'approved' then
    return null;
  end if;

  v_is_commander := public.is_commander(v_user.auth_user_id);

  update public.calendar_feeds set last_used_at = now() where id = v_feed.id;

  return jsonb_build_object(
    'today', v_today,
    'user', jsonb_build_object('name', v_user.name, 'role', v_user.role, 'is_commander', v_is_commander),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'title', e.title, 'description', e.description, 'location', e.location,
               'starts_at', e.starts_at, 'ends_at', e.ends_at, 'status', e.status
             ) order by e.starts_at)
        from public.events e
       where e.starts_at >= v_from and e.starts_at < v_to
         and e.status::text <> 'cancelled'
         and (
           v_is_commander
           or e.created_by = v_user.id
           or e.responsible_user_id = v_user.id
           or (e.unit_id is not null and e.unit_id = v_user.unit_id)
         )
    ), '[]'::jsonb),
    'forum', coalesce((
      select jsonb_agg(jsonb_build_object(
               'report_date', r.report_date, 'level', r.report_level, 'status', r.status,
               'mine', r.owner_user_id = v_user.id, 'platoon_unit_id', r.platoon_unit_id,
               'present', r.content ->> 'present_count', 'total', r.content ->> 'total_count'
             ))
        from public.forum_daily_reports r
       where r.report_date between v_today - 2 and v_today + 1
         and r.report_level <> 'squad'
         and (v_is_commander or r.owner_user_id = v_user.id)
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
