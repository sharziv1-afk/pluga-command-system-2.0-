-- 017_security_and_performance_hardening.sql
--
-- Everything in this file was verified against LIVE state via
-- get_advisors + `select * from pg_policies where schemaname='public'`,
-- not against the migration files on disk. That mattered: migrations
-- 001-002 document intent for `users` and `requests`, but those two
-- tables' live policies never matched them — they run an older,
-- differently-named generation ("Users can ...", "Allow ...") that
-- predates this migration history, with two policies scoped `to public`
-- instead of `to authenticated`. Everything else (tasks, events,
-- forum_posts, forum_daily_reports, forum_daily_summaries, tracking_*)
-- matches its migration file exactly.
--
-- This migration:
--   A. Fixes mutable search_path on is_commander() and set_updated_at().
--   B. Revokes anon execute on is_commander() (was publicly callable via
--      /rest/v1/rpc/is_commander).
--   C. Rewrites every RLS policy that calls auth.uid() unwrapped to use
--      (select auth.uid()) instead, so Postgres evaluates it once per
--      statement (InitPlan) instead of once per row. All 52 policies
--      flagged by the performance advisor are addressed here. Functions
--      that take no auth.uid() argument in the policy text itself
--      (current_app_user_id(), current_tracking_unit_id(),
--      can_edit_tracking_unit()) were not flagged and are left as-is —
--      they're STABLE, so Postgres already caches them per statement.
--   D. Reconciles users/requests/comments onto the one naming convention
--      already used everywhere else, and narrows the two `to public`
--      policies on users to `to authenticated`. (anon cannot exploit them
--      today — auth.uid() is null when unauthenticated, so every match
--      fails closed — but public exposure is unnecessary.)
--   E. Drops `anon` from units/roles read access. It existed only to feed
--      the self-registration role/unit dropdowns; that flow is gone as of
--      the invite-only login rewrite, so nothing anonymous needs to read
--      these tables now.
--
-- Every existing access rule is preserved exactly (same owner/commander/
-- unit logic) — this changes performance and role scoping, not who can
-- see or edit what. No table structure or data is touched. Safe to run
-- against a live database with real rows.

-- ============================================================
-- A. search_path
-- ============================================================

alter function public.is_commander(uuid) set search_path = public;
alter function public.set_updated_at() set search_path = public;

-- ============================================================
-- B. anon execute
-- ============================================================

revoke execute on function public.is_commander(uuid) from public;
revoke execute on function public.is_commander(uuid) from anon;
grant execute on function public.is_commander(uuid) to authenticated;

-- ============================================================
-- users (drift-corrected: old "Allow .../Users can ..." names, two `to public`)
-- ============================================================

drop policy if exists "Users can insert own profile" on public.users;
drop policy if exists "Users can select own profile" on public.users;
drop policy if exists "Users can update own profile" on public.users;
drop policy if exists "Allow users to view own profile or commanders to view all" on public.users;
drop policy if exists "Allow commanders to manage profiles" on public.users;
drop policy if exists "users: select own profile" on public.users;
drop policy if exists "users: commander select all" on public.users;
drop policy if exists "users: commander update all" on public.users;
drop policy if exists "users: insert own profile" on public.users;
drop policy if exists "users: update own profile" on public.users;

create policy "users: insert own profile"
  on public.users for insert to authenticated
  with check ( auth_user_id = (select auth.uid()) );

create policy "users: select own profile"
  on public.users for select to authenticated
  using ( auth_user_id = (select auth.uid()) );

create policy "users: commander select all"
  on public.users for select to authenticated
  using ( public.is_commander((select auth.uid())) );

create policy "users: update own profile"
  on public.users for update to authenticated
  using ( auth_user_id = (select auth.uid()) )
  with check ( auth_user_id = (select auth.uid()) );

create policy "users: commander update all"
  on public.users for update to authenticated
  using ( public.is_commander((select auth.uid())) )
  with check ( public.is_commander((select auth.uid())) );

-- ============================================================
-- requests (drift-corrected: old "Allow ..." names for insert/select/update-all)
-- ============================================================

drop policy if exists "Allow users to create own requests" on public.requests;
drop policy if exists "Allow users to view own requests" on public.requests;
drop policy if exists "Allow commanders to view all requests" on public.requests;
drop policy if exists "Allow commanders to update all requests" on public.requests;
drop policy if exists "requests: insert own" on public.requests;
drop policy if exists "requests: select own" on public.requests;
drop policy if exists "requests: commander select all" on public.requests;
drop policy if exists "requests: commander update all" on public.requests;
drop policy if exists "requests: creator update own" on public.requests;
drop policy if exists "requests: delete closed" on public.requests;

create policy "requests: insert own"
  on public.requests for insert to authenticated
  with check ( requested_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "requests: select own"
  on public.requests for select to authenticated
  using ( requested_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "requests: commander select all"
  on public.requests for select to authenticated
  using ( public.is_commander((select auth.uid())) );

create policy "requests: commander update all"
  on public.requests for update to authenticated
  using ( public.is_commander((select auth.uid())) )
  with check ( public.is_commander((select auth.uid())) );

create policy "requests: creator update own"
  on public.requests for update to authenticated
  using ( requested_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) )
  with check ( requested_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "requests: delete closed"
  on public.requests for delete to authenticated
  using (
    status in ('completed', 'rejected', 'cancelled')
    and (
      public.is_commander((select auth.uid()))
      or requested_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1)
    )
  );

-- ============================================================
-- comments (drift-corrected names only, same logic)
-- ============================================================

drop policy if exists "request viewers can add request comments" on public.comments;
drop policy if exists "request comments are visible to request viewers" on public.comments;
drop policy if exists "comments: select request comments for request viewers" on public.comments;
drop policy if exists "comments: insert own request comments for request viewers" on public.comments;

create policy "comments: select request comments for request viewers"
  on public.comments for select to authenticated
  using (
    entity_type = 'request'
    and exists ( select 1 from public.requests where requests.id = comments.entity_id )
  );

create policy "comments: insert own request comments for request viewers"
  on public.comments for insert to authenticated
  with check (
    entity_type = 'request'
    and user_id = (select id from public.users where auth_user_id = (select auth.uid()) limit 1)
    and exists ( select 1 from public.requests where requests.id = comments.entity_id )
  );

-- ============================================================
-- audit_logs
-- ============================================================

drop policy if exists "audit_logs: insert own" on public.audit_logs;
drop policy if exists "audit_logs: commander select all" on public.audit_logs;
drop policy if exists "audit_logs: select own" on public.audit_logs;

create policy "audit_logs: insert own"
  on public.audit_logs for insert to authenticated
  with check ( user_id = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "audit_logs: commander select all"
  on public.audit_logs for select to authenticated
  using ( public.is_commander((select auth.uid())) );

create policy "audit_logs: select own"
  on public.audit_logs for select to authenticated
  using ( user_id = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

-- ============================================================
-- tasks
-- ============================================================

drop policy if exists "tasks: insert own" on public.tasks;
drop policy if exists "tasks: select own" on public.tasks;
drop policy if exists "tasks: select assigned" on public.tasks;
drop policy if exists "tasks: select own unit" on public.tasks;
drop policy if exists "tasks: commander select all" on public.tasks;
drop policy if exists "tasks: commander update all" on public.tasks;
drop policy if exists "tasks: creator update own" on public.tasks;
drop policy if exists "tasks: delete closed" on public.tasks;

create policy "tasks: insert own"
  on public.tasks for insert to authenticated
  with check ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "tasks: select own"
  on public.tasks for select to authenticated
  using ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "tasks: select assigned"
  on public.tasks for select to authenticated
  using ( assigned_to = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "tasks: select own unit"
  on public.tasks for select to authenticated
  using (
    unit_id is not null
    and unit_id = (select unit_id from public.users where auth_user_id = (select auth.uid()) and unit_id is not null limit 1)
  );

create policy "tasks: commander select all"
  on public.tasks for select to authenticated
  using ( public.is_commander((select auth.uid())) );

create policy "tasks: commander update all"
  on public.tasks for update to authenticated
  using ( public.is_commander((select auth.uid())) )
  with check ( public.is_commander((select auth.uid())) );

create policy "tasks: creator update own"
  on public.tasks for update to authenticated
  using ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) )
  with check ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "tasks: delete closed"
  on public.tasks for delete to authenticated
  using (
    status in ('completed', 'cancelled')
    and (
      public.is_commander((select auth.uid()))
      or created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1)
    )
  );

-- ============================================================
-- events
-- ============================================================

drop policy if exists "events: insert own" on public.events;
drop policy if exists "events: select own" on public.events;
drop policy if exists "events: select responsible" on public.events;
drop policy if exists "events: select own unit" on public.events;
drop policy if exists "events: commander select all" on public.events;
drop policy if exists "events: commander update all" on public.events;
drop policy if exists "events: creator update own" on public.events;
drop policy if exists "events: delete closed" on public.events;

create policy "events: insert own"
  on public.events for insert to authenticated
  with check ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "events: select own"
  on public.events for select to authenticated
  using ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "events: select responsible"
  on public.events for select to authenticated
  using ( responsible_user_id = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "events: select own unit"
  on public.events for select to authenticated
  using (
    unit_id is not null
    and unit_id = (select unit_id from public.users where auth_user_id = (select auth.uid()) and unit_id is not null limit 1)
  );

create policy "events: commander select all"
  on public.events for select to authenticated
  using ( public.is_commander((select auth.uid())) );

create policy "events: commander update all"
  on public.events for update to authenticated
  using ( public.is_commander((select auth.uid())) )
  with check ( public.is_commander((select auth.uid())) );

create policy "events: creator update own"
  on public.events for update to authenticated
  using ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) )
  with check ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

create policy "events: delete closed"
  on public.events for delete to authenticated
  using (
    status in ('completed', 'cancelled')
    and (
      public.is_commander((select auth.uid()))
      or created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1)
    )
  );

-- ============================================================
-- forum_posts
-- ============================================================

drop policy if exists "forum_posts: approved active select" on public.forum_posts;
drop policy if exists "forum_posts: select active users" on public.forum_posts;
drop policy if exists "forum_posts: insert own" on public.forum_posts;
drop policy if exists "forum_posts: commander update all" on public.forum_posts;
drop policy if exists "forum_posts: creator update own" on public.forum_posts;

create policy "forum_posts: approved active select"
  on public.forum_posts for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.auth_user_id = (select auth.uid()) and u.status = 'active' and u.role_approval_status = 'approved'
    )
  );

create policy "forum_posts: insert own"
  on public.forum_posts for insert to authenticated
  with check ( author_id = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1) );

create policy "forum_posts: commander update all"
  on public.forum_posts for update to authenticated
  using ( public.is_commander((select auth.uid())) )
  with check ( public.is_commander((select auth.uid())) );

create policy "forum_posts: creator update own"
  on public.forum_posts for update to authenticated
  using ( author_id = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1) )
  with check ( author_id = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1) );

-- ============================================================
-- forum_daily_reports
-- ============================================================

drop policy if exists "forum_daily_reports: owner select own" on public.forum_daily_reports;
drop policy if exists "forum_daily_reports: owner insert own" on public.forum_daily_reports;
drop policy if exists "forum_daily_reports: owner update own" on public.forum_daily_reports;
drop policy if exists "forum_daily_reports: commander select all" on public.forum_daily_reports;
drop policy if exists "forum_daily_reports: commander update all" on public.forum_daily_reports;
drop policy if exists "forum_daily_reports: commander insert all" on public.forum_daily_reports;
drop policy if exists "forum_daily_reports: delete own or commander" on public.forum_daily_reports;

create policy "forum_daily_reports: owner select own"
  on public.forum_daily_reports for select to authenticated
  using ( owner_user_id = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1) );

create policy "forum_daily_reports: owner insert own"
  on public.forum_daily_reports for insert to authenticated
  with check (
    exists (
      select 1 from public.users u
      where u.auth_user_id = (select auth.uid())
        and u.status = 'active' and u.role_approval_status = 'approved'
        and forum_daily_reports.created_by = u.id and forum_daily_reports.owner_user_id = u.id
    )
  );

create policy "forum_daily_reports: owner update own"
  on public.forum_daily_reports for update to authenticated
  using ( owner_user_id = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1) )
  with check ( owner_user_id = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1) );

create policy "forum_daily_reports: commander select all"
  on public.forum_daily_reports for select to authenticated
  using ( public.is_commander((select auth.uid())) );

create policy "forum_daily_reports: commander update all"
  on public.forum_daily_reports for update to authenticated
  using ( public.is_commander((select auth.uid())) )
  with check ( public.is_commander((select auth.uid())) );

create policy "forum_daily_reports: commander insert all"
  on public.forum_daily_reports for insert to authenticated
  with check (
    public.is_commander((select auth.uid()))
    and created_by = (select commander_user.id from public.users commander_user where commander_user.auth_user_id = (select auth.uid()) limit 1)
    and owner_user_id is not null
    and exists (
      select 1 from public.users owner_user
      where owner_user.id = forum_daily_reports.owner_user_id and owner_user.status = 'active' and owner_user.role_approval_status = 'approved'
    )
  );

create policy "forum_daily_reports: delete own or commander"
  on public.forum_daily_reports for delete to authenticated
  using (
    public.is_commander((select auth.uid()))
    or created_by = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1)
    or owner_user_id = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1)
  );

-- ============================================================
-- forum_daily_summaries (legacy prototype from 009 — still RLS-active live)
-- ============================================================

drop policy if exists "forum_daily_summaries: approved active select" on public.forum_daily_summaries;
drop policy if exists "forum_daily_summaries: insert own unit" on public.forum_daily_summaries;
drop policy if exists "forum_daily_summaries: creator update own" on public.forum_daily_summaries;
drop policy if exists "forum_daily_summaries: commander update all" on public.forum_daily_summaries;

create policy "forum_daily_summaries: approved active select"
  on public.forum_daily_summaries for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.auth_user_id = (select auth.uid()) and u.status = 'active' and u.role_approval_status = 'approved'
    )
  );

create policy "forum_daily_summaries: insert own unit"
  on public.forum_daily_summaries for insert to authenticated
  with check (
    exists (
      select 1 from public.users u
      where u.auth_user_id = (select auth.uid())
        and u.status = 'active' and u.role_approval_status = 'approved'
        and forum_daily_summaries.created_by = u.id
    )
  );

create policy "forum_daily_summaries: creator update own"
  on public.forum_daily_summaries for update to authenticated
  using ( created_by = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1) )
  with check ( created_by = (select u.id from public.users u where u.auth_user_id = (select auth.uid()) limit 1) );

create policy "forum_daily_summaries: commander update all"
  on public.forum_daily_summaries for update to authenticated
  using ( public.is_commander((select auth.uid())) )
  with check ( public.is_commander((select auth.uid())) );

-- ============================================================
-- tracking: soldiers / tracking_items / tracking_records
-- ============================================================

drop policy if exists "soldiers: commander select all" on public.soldiers;
drop policy if exists "soldiers: select own tracking unit" on public.soldiers;
drop policy if exists "soldiers: commander insert" on public.soldiers;
drop policy if exists "soldiers: commander update" on public.soldiers;

create policy "soldiers: commander select all"
  on public.soldiers for select to authenticated
  using ( public.is_tracking_commander((select auth.uid())) );

create policy "soldiers: select own tracking unit"
  on public.soldiers for select to authenticated
  using ( unit_id = public.current_tracking_unit_id() );

create policy "soldiers: commander insert"
  on public.soldiers for insert to authenticated
  with check ( public.is_tracking_commander((select auth.uid())) );

create policy "soldiers: commander update"
  on public.soldiers for update to authenticated
  using ( public.is_tracking_commander((select auth.uid())) )
  with check ( public.is_tracking_commander((select auth.uid())) );

drop policy if exists "tracking_items: active approved select" on public.tracking_items;
drop policy if exists "tracking_items: commander insert" on public.tracking_items;
drop policy if exists "tracking_items: commander update" on public.tracking_items;

create policy "tracking_items: active approved select"
  on public.tracking_items for select to authenticated
  using ( public.current_app_user_id() is not null );

create policy "tracking_items: commander insert"
  on public.tracking_items for insert to authenticated
  with check ( public.is_tracking_commander((select auth.uid())) );

create policy "tracking_items: commander update"
  on public.tracking_items for update to authenticated
  using ( public.is_tracking_commander((select auth.uid())) )
  with check ( public.is_tracking_commander((select auth.uid())) );

drop policy if exists "tracking_records: select visible soldiers" on public.tracking_records;
drop policy if exists "tracking_records: insert tracking unit editors" on public.tracking_records;
drop policy if exists "tracking_records: update tracking unit editors" on public.tracking_records;

create policy "tracking_records: select visible soldiers"
  on public.tracking_records for select to authenticated
  using (
    exists (
      select 1 from public.soldiers s
      where s.id = tracking_records.soldier_id
        and ( public.is_tracking_commander((select auth.uid())) or s.unit_id = public.current_tracking_unit_id() )
    )
  );

create policy "tracking_records: insert tracking unit editors"
  on public.tracking_records for insert to authenticated
  with check (
    exists ( select 1 from public.soldiers s where s.id = tracking_records.soldier_id and public.can_edit_tracking_unit(s.unit_id) )
  );

create policy "tracking_records: update tracking unit editors"
  on public.tracking_records for update to authenticated
  using (
    exists ( select 1 from public.soldiers s where s.id = tracking_records.soldier_id and public.can_edit_tracking_unit(s.unit_id) )
  )
  with check (
    exists ( select 1 from public.soldiers s where s.id = tracking_records.soldier_id and public.can_edit_tracking_unit(s.unit_id) )
  );

-- ============================================================
-- E. units / roles — drop anon (self-registration dropdowns are gone)
-- ============================================================

drop policy if exists "units: public read" on public.units;
create policy "units: authenticated read"
  on public.units for select to authenticated using (true);

drop policy if exists "roles: public read" on public.roles;
create policy "roles: authenticated read"
  on public.roles for select to authenticated using (true);
