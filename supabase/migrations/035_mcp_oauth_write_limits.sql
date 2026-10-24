-- 035_mcp_oauth_write_limits.sql
--
-- Limits what an OAuth (MCP) access token can write. Run manually — first in
-- the SANDBOX (hjltpajvqhnygjybtivd), then in LIVE (vmfihyritfmjycrfpxjn).
-- Idempotent.
--
-- Supabase OAuth 2.1 access tokens carry a `client_id` claim; first-party
-- sessions from the website do not. Every policy below is RESTRICTIVE and
-- only bites when that claim is present, so nothing changes for the site.
--
-- An OAuth token may:
--   * insert/update tasks, requests, events, tracking_records,
--     mentoring_entries (still under the existing permissive policies), and
--     insert its own audit_logs rows;
--   * delete a task/request/event/mentoring entry ONLY if the row was created
--     through MCP (metadata.created_via = 'mcp', or created_via = 'mcp' for
--     mentoring) — and still only where the existing delete policies allow it
--     (closed items, creator or commander);
--   * never change that origin marker (trigger), so a site-created row cannot
--     be relabelled and then deleted through MCP.
-- It may not write to any other table at all.

create or replace function public.is_oauth_client_request()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'client_id', '') <> ''
$$;

revoke execute on function public.is_oauth_client_request() from public;
revoke execute on function public.is_oauth_client_request() from anon;
grant execute on function public.is_oauth_client_request() to authenticated;

-- mentoring_entries has no metadata column; the origin marker lives here.
alter table public.mentoring_entries add column if not exists created_via text;

-- ── Deletes: only MCP-created rows, for OAuth tokens ─────────────────────────
drop policy if exists "oauth: delete only mcp-created" on public.tasks;
create policy "oauth: delete only mcp-created" on public.tasks
  as restrictive for delete to authenticated
  using (not public.is_oauth_client_request() or coalesce(metadata ->> 'created_via', '') = 'mcp');

drop policy if exists "oauth: delete only mcp-created" on public.requests;
create policy "oauth: delete only mcp-created" on public.requests
  as restrictive for delete to authenticated
  using (not public.is_oauth_client_request() or coalesce(metadata ->> 'created_via', '') = 'mcp');

drop policy if exists "oauth: delete only mcp-created" on public.events;
create policy "oauth: delete only mcp-created" on public.events
  as restrictive for delete to authenticated
  using (not public.is_oauth_client_request() or coalesce(metadata ->> 'created_via', '') = 'mcp');

drop policy if exists "oauth: delete only mcp-created" on public.mentoring_entries;
create policy "oauth: delete only mcp-created" on public.mentoring_entries
  as restrictive for delete to authenticated
  using (not public.is_oauth_client_request() or coalesce(created_via, '') = 'mcp');

-- tracking_records and audit_logs: never deleted or (audit) edited via OAuth.
drop policy if exists "oauth: no delete" on public.tracking_records;
create policy "oauth: no delete" on public.tracking_records
  as restrictive for delete to authenticated
  using (not public.is_oauth_client_request());

drop policy if exists "oauth: no update" on public.audit_logs;
create policy "oauth: no update" on public.audit_logs
  as restrictive for update to authenticated
  using (not public.is_oauth_client_request())
  with check (not public.is_oauth_client_request());

drop policy if exists "oauth: no delete" on public.audit_logs;
create policy "oauth: no delete" on public.audit_logs
  as restrictive for delete to authenticated
  using (not public.is_oauth_client_request());

-- ── Every other table: no writes from OAuth tokens ──────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'units', 'roles',
    'forum_daily_reports', 'forum_daily_summaries', 'forum_posts', 'comments',
    'gaps', 'soldiers', 'tracking_items', 'tracking_weeks'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'oauth: no insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (not public.is_oauth_client_request())',
      'oauth: no insert', t);

    execute format('drop policy if exists %I on public.%I', 'oauth: no update', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (not public.is_oauth_client_request()) with check (not public.is_oauth_client_request())',
      'oauth: no update', t);

    execute format('drop policy if exists %I on public.%I', 'oauth: no delete', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (not public.is_oauth_client_request())',
      'oauth: no delete', t);
  end loop;
end $$;

-- ── The origin marker cannot be changed by an OAuth token ───────────────────
create or replace function public.guard_mcp_origin_marker()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_v text;
  new_v text;
begin
  if not public.is_oauth_client_request() then
    return new;
  end if;

  if tg_table_name = 'mentoring_entries' then
    old_v := to_jsonb(old) ->> 'created_via';
    new_v := to_jsonb(new) ->> 'created_via';
  else
    old_v := to_jsonb(old) -> 'metadata' ->> 'created_via';
    new_v := to_jsonb(new) -> 'metadata' ->> 'created_via';
  end if;

  if old_v is distinct from new_v then
    raise exception 'created_via cannot be changed by an OAuth client'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_mcp_origin_marker() from public;
revoke execute on function public.guard_mcp_origin_marker() from anon;
revoke execute on function public.guard_mcp_origin_marker() from authenticated;

drop trigger if exists guard_mcp_origin_marker_before_update on public.tasks;
create trigger guard_mcp_origin_marker_before_update
  before update on public.tasks
  for each row execute function public.guard_mcp_origin_marker();

drop trigger if exists guard_mcp_origin_marker_before_update on public.requests;
create trigger guard_mcp_origin_marker_before_update
  before update on public.requests
  for each row execute function public.guard_mcp_origin_marker();

drop trigger if exists guard_mcp_origin_marker_before_update on public.events;
create trigger guard_mcp_origin_marker_before_update
  before update on public.events
  for each row execute function public.guard_mcp_origin_marker();

drop trigger if exists guard_mcp_origin_marker_before_update on public.mentoring_entries;
create trigger guard_mcp_origin_marker_before_update
  before update on public.mentoring_entries
  for each row execute function public.guard_mcp_origin_marker();
