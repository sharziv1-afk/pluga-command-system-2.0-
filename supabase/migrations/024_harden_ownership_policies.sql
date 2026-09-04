-- 024_harden_ownership_policies.sql
-- Security fix: a commander blocking a user (public.users.status = 'blocked',
-- or a rejected role_approval_status) only ever took effect client-side
-- (fetchCurrentProfile logs them out of the app UI). At the DB layer, RLS is
-- the real authorization boundary here (no server API routes — every write
-- goes straight from the browser to Supabase with the anon key), and most
-- "own row" policies only checked row ownership, never account status:
--
--   created_by = (select id from public.users where auth_user_id = auth.uid() limit 1)
--
-- A blocked/pending user's own Supabase session/JWT still satisfies this —
-- they could still create/read/update/delete their own tasks, requests,
-- events, gaps, forum posts and comments via direct REST calls, bypassing
-- the app entirely. public.current_app_user_id() (015_tracking_mvp.sql,
-- already applied and in live use for tracking_items) already encodes the
-- missing check and returns null for anyone not active+approved, which
-- makes every ownership match below fail closed instead of open. This
-- migration swaps the raw subquery for that function everywhere the same
-- vulnerable pattern was used — same behavior for legitimate active/approved
-- users, stricter for everyone else. No new tables, no new columns.

-- ---- tasks ----
drop policy if exists "tasks: insert own" on public.tasks;
create policy "tasks: insert own"
  on public.tasks for insert to authenticated
  with check ( created_by = public.current_app_user_id() );

drop policy if exists "tasks: select own" on public.tasks;
create policy "tasks: select own"
  on public.tasks for select to authenticated
  using ( created_by = public.current_app_user_id() );

drop policy if exists "tasks: select assigned" on public.tasks;
create policy "tasks: select assigned"
  on public.tasks for select to authenticated
  using ( assigned_to = public.current_app_user_id() );

drop policy if exists "tasks: creator update own" on public.tasks;
create policy "tasks: creator update own"
  on public.tasks for update to authenticated
  using ( created_by = public.current_app_user_id() )
  with check ( created_by = public.current_app_user_id() );

drop policy if exists "tasks: delete closed" on public.tasks;
create policy "tasks: delete closed"
  on public.tasks for delete to authenticated
  using (
    status in ('completed', 'cancelled')
    and (
      public.is_commander((select auth.uid()))
      or created_by = public.current_app_user_id()
    )
  );

-- ---- requests ----
drop policy if exists "requests: insert own" on public.requests;
create policy "requests: insert own"
  on public.requests for insert to authenticated
  with check ( requested_by = public.current_app_user_id() );

drop policy if exists "requests: select own" on public.requests;
create policy "requests: select own"
  on public.requests for select to authenticated
  using ( requested_by = public.current_app_user_id() );

drop policy if exists "requests: creator update own" on public.requests;
create policy "requests: creator update own"
  on public.requests for update to authenticated
  using ( requested_by = public.current_app_user_id() )
  with check ( requested_by = public.current_app_user_id() );

drop policy if exists "requests: delete closed" on public.requests;
create policy "requests: delete closed"
  on public.requests for delete to authenticated
  using (
    status in ('completed', 'rejected', 'cancelled')
    and (
      public.is_commander((select auth.uid()))
      or requested_by = public.current_app_user_id()
    )
  );

-- ---- events ----
drop policy if exists "events: insert own" on public.events;
create policy "events: insert own"
  on public.events for insert to authenticated
  with check ( created_by = public.current_app_user_id() );

drop policy if exists "events: select own" on public.events;
create policy "events: select own"
  on public.events for select to authenticated
  using ( created_by = public.current_app_user_id() );

drop policy if exists "events: select responsible" on public.events;
create policy "events: select responsible"
  on public.events for select to authenticated
  using ( responsible_user_id = public.current_app_user_id() );

drop policy if exists "events: creator update own" on public.events;
create policy "events: creator update own"
  on public.events for update to authenticated
  using ( created_by = public.current_app_user_id() )
  with check ( created_by = public.current_app_user_id() );

drop policy if exists "events: delete closed" on public.events;
create policy "events: delete closed"
  on public.events for delete to authenticated
  using (
    status in ('completed', 'cancelled')
    and (
      public.is_commander((select auth.uid()))
      or created_by = public.current_app_user_id()
    )
  );

-- ---- gaps ----
drop policy if exists "gaps: insert own" on public.gaps;
create policy "gaps: insert own"
  on public.gaps for insert to authenticated
  with check ( created_by = public.current_app_user_id() );

drop policy if exists "gaps: select own" on public.gaps;
create policy "gaps: select own"
  on public.gaps for select to authenticated
  using ( created_by = public.current_app_user_id() );

drop policy if exists "gaps: creator update own" on public.gaps;
create policy "gaps: creator update own"
  on public.gaps for update to authenticated
  using ( created_by = public.current_app_user_id() )
  with check ( created_by = public.current_app_user_id() );

drop policy if exists "gaps: delete closed" on public.gaps;
create policy "gaps: delete closed"
  on public.gaps for delete to authenticated
  using (
    status = 'נסגר'
    and (
      public.is_commander((select auth.uid()))
      or created_by = public.current_app_user_id()
    )
  );

-- ---- forum_posts ----
drop policy if exists "forum_posts: insert own" on public.forum_posts;
create policy "forum_posts: insert own"
  on public.forum_posts for insert to authenticated
  with check ( author_id = public.current_app_user_id() );

drop policy if exists "forum_posts: creator update own" on public.forum_posts;
create policy "forum_posts: creator update own"
  on public.forum_posts for update to authenticated
  using ( author_id = public.current_app_user_id() )
  with check ( author_id = public.current_app_user_id() );

-- ---- comments ----
drop policy if exists "comments: insert own request comments for request viewers" on public.comments;
create policy "comments: insert own request comments for request viewers"
  on public.comments for insert to authenticated
  with check (
    entity_type = 'request'
    and user_id = public.current_app_user_id()
    and exists ( select 1 from public.requests where requests.id = comments.entity_id )
  );

-- ---- audit_logs ----
drop policy if exists "audit_logs: insert own" on public.audit_logs;
create policy "audit_logs: insert own"
  on public.audit_logs for insert to authenticated
  with check ( user_id = public.current_app_user_id() );

drop policy if exists "audit_logs: select own" on public.audit_logs;
create policy "audit_logs: select own"
  on public.audit_logs for select to authenticated
  using ( user_id = public.current_app_user_id() );
