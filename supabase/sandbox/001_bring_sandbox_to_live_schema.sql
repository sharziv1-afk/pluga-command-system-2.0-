-- =====================================================================
-- Bring the sandbox project up to the live schema
--
-- Target:  hjltpajvqhnygjybtivd   (currently named "pluga-command-system")
-- Source:  vmfihyritfmjycrfpxjn   (currently named "hamifkad-staging")
--
-- Run this in the Supabase SQL editor of the TARGET project only.
-- Do NOT run it against the live project — it is already at this state.
--
-- Measured gap (2026-09-06), not guessed:
--   missing tables    : mentoring_entries, tracking_weeks
--   missing columns   : forum_daily_reports.updated_by, tasks.updated_by,
--                       tracking_items.week_id
--   missing functions : caller_outranks, force_updated_by,
--                       is_company_commander
--   every other table matched byte-for-byte on a column signature hash,
--   including `users`.
--
-- This is migrations 023-032 concatenated in order. All ten are idempotent
-- (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS), so running
-- it twice is harmless.
--
-- It creates schema only. It inserts no users and no company data.
-- =====================================================================



-- ===== 023_mentoring =====
-- 023_mentoring.sql
-- "תיק חניכה" — a mentoring log the company commander (מ"פ) keeps for his
-- direct reports (4 מ"מ + סמ"פ today; מ"כים are explicitly out of scope for
-- now, per the commander). Modeled on the working מודל already proven in the
-- sibling project (PLUGA A APP: src/domain/mentoring.ts) — observation, focus,
-- agreed action, next check-in date — rather than inventing a new shape.
--
-- Deliberately does NOT duplicate personal data (name/role/unit already live
-- on public.users). Matches the exact privacy boundary already written down
-- in that sibling project's docs/notion-product-map.md: "no medical
-- diagnoses, no personnel file" — this table only ever holds mentoring
-- observations/actions the מ"פ chooses to write, never sensitive personal
-- data. commander_note gets the same FieldPrivacyHint treatment already used
-- elsewhere in this app for free-text sensitive fields (forum/tracking).
--
-- Access is intentionally stricter than the existing public.is_commander()
-- (which also grants סמ"פ) — this is מ"פ-only, both because it's a personal
-- coaching tool for him and because a סמ"פ seeing "notes about themselves and
-- their peers" would defeat the point.

create or replace function public.is_company_commander(auth_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     text;
  v_status   text;
  v_approval text;
begin
  select role, status, role_approval_status
    into v_role, v_status, v_approval
    from public.users
   where auth_user_id = auth_id
   limit 1;

  if not found then
    return false;
  end if;

  if v_status <> 'active' or v_approval <> 'approved' then
    return false;
  end if;

  return v_role = 'מ"פ' or v_role = 'מ״פ';
end;
$$;

revoke execute on function public.is_company_commander(uuid) from public;
revoke execute on function public.is_company_commander(uuid) from anon;
grant execute on function public.is_company_commander(uuid) to authenticated;

create table if not exists public.mentoring_entries (
  id uuid primary key default gen_random_uuid(),
  mentee_user_id uuid not null references public.users(id) on delete cascade,
  created_by uuid not null references public.users(id),
  occurred_on date not null,
  observation text,
  focus text not null,
  agreed_action text not null,
  next_check_at date,
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentoring_entries_mentee_idx on public.mentoring_entries(mentee_user_id, occurred_on desc);

drop trigger if exists set_mentoring_entries_updated_at on public.mentoring_entries;
create trigger set_mentoring_entries_updated_at
  before update on public.mentoring_entries
  for each row execute function public.set_updated_at();

alter table public.mentoring_entries enable row level security;

create policy "mentoring_entries: commander only"
  on public.mentoring_entries
  for all
  using ( public.is_company_commander((select auth.uid())) )
  with check ( public.is_company_commander((select auth.uid())) );


-- ===== 024_harden_ownership_policies =====
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


-- ===== 025_performance_indexes =====
-- 025_performance_indexes.sql
-- Three unbounded, unindexed sort columns found during a performance audit:
-- tasks/requests both order by created_at desc on every load with no
-- existing index on that column (only due_at/status/assigned_to/created_by/
-- unit_id/event_id are indexed), and forum_posts sorts by (is_pinned,
-- created_at) but only has a single-column created_at index.

create index if not exists idx_tasks_created_at on public.tasks(created_at desc);
create index if not exists idx_requests_created_at on public.requests(created_at desc);
create index if not exists idx_forum_posts_pinned_created_at on public.forum_posts(is_pinned desc, created_at desc);


-- ===== 026_tracking_weeks =====
-- 026_tracking_weeks.sql
-- Formalizes what the commander was already doing informally: every
-- tracking_items row so far shares subject='שבוע מטווחים' — a free-text
-- "week" label with no real definition, no dates, and no way to browse or
-- search by it. This adds a real tracking_weeks entity (title + short
-- definition of what the week covers + date range) and links items to it,
-- while leaving tracking_items.subject/category untouched — subject stays as
-- free text for now (not removed), category becomes searchable in the UI.
--
-- Existing behavior is preserved: tracking_items.week_id is nullable, so the
-- current flat "all items" table view keeps working unchanged for any item
-- not assigned to a week.

create table if not exists public.tracking_weeks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_date date,
  end_date date,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tracking_items add column if not exists week_id uuid references public.tracking_weeks(id);
create index if not exists tracking_items_week_id_idx on public.tracking_items(week_id);

drop trigger if exists set_tracking_weeks_updated_at on public.tracking_weeks;
create trigger set_tracking_weeks_updated_at
  before update on public.tracking_weeks
  for each row execute function public.set_updated_at();

alter table public.tracking_weeks enable row level security;

-- Mirrors tracking_items' own policies exactly (026 follows 015's pattern):
-- any active/approved user reads week definitions, only a tracking commander
-- creates/edits them.
drop policy if exists "tracking_weeks: active approved select" on public.tracking_weeks;
create policy "tracking_weeks: active approved select"
  on public.tracking_weeks
  for select
  to authenticated
  using (public.current_app_user_id() is not null);

drop policy if exists "tracking_weeks: commander insert" on public.tracking_weeks;
create policy "tracking_weeks: commander insert"
  on public.tracking_weeks
  for insert
  to authenticated
  with check (public.is_tracking_commander(auth.uid()));

drop policy if exists "tracking_weeks: commander update" on public.tracking_weeks;
create policy "tracking_weeks: commander update"
  on public.tracking_weeks
  for update
  to authenticated
  using (public.is_tracking_commander(auth.uid()))
  with check (public.is_tracking_commander(auth.uid()));

-- Backfill: the 3 live items sharing subject='שבוע מטווחים' become the first
-- real week, preserving continuity instead of losing the existing grouping.
insert into public.tracking_weeks (title, description, sort_order)
select 'שבוע מטווחים', 'מטווחי אקדח ורובה ומבחן סיווג ירי.', 1
where exists (select 1 from public.tracking_items where subject = 'שבוע מטווחים')
  and not exists (select 1 from public.tracking_weeks where title = 'שבוע מטווחים');

update public.tracking_items
set week_id = (select id from public.tracking_weeks where title = 'שבוע מטווחים' limit 1)
where subject = 'שבוע מטווחים' and week_id is null;


-- ===== 027_hierarchy_conflict_tracking =====
-- Adds updated_by tracking to the two highest-risk concurrent-write tables
-- (tasks, forum_daily_reports), mirroring the existing pattern already used
-- on soldiers/tracking_items/tracking_records. This is the data needed to
-- resolve a write conflict by role hierarchy instead of plain last-write-wins.

alter table public.tasks
  add column if not exists updated_by uuid references public.users(id) on delete set null;

alter table public.forum_daily_reports
  add column if not exists updated_by uuid references public.users(id) on delete set null;


-- ===== 028_hierarchy_rank_lookup =====
-- The hierarchy write-conflict resolver (src/lib/concurrency/hierarchyWrite.ts)
-- needs to read another user's permission_level to decide who outranks whom.
-- The existing RLS on public.users only lets a user read their OWN row,
-- or lets a commander (מ"פ/סמ"פ) read everyone. A non-commander (the common
-- case: two מ"כ, or a מ"מ vs a מ"כ) could never read the OTHER editor's
-- permission_level — the lookup silently returned nothing, defaulted to 0,
-- and the CURRENT user always "won" the conflict regardless of real rank.
--
-- Fix: a narrow SECURITY DEFINER function exposing only what's needed
-- (permission_level) for one target user, callable by any active/approved
-- user — same pattern as current_app_user_id() etc.
create or replace function public.get_user_rank_info(target_user_id uuid)
returns table(permission_level int)
language sql
stable
security definer
set search_path = public
as $$
  select u.permission_level
  from public.users u
  where u.id = target_user_id
    and public.current_app_user_id() is not null;
$$;

revoke execute on function public.get_user_rank_info(uuid) from public;
revoke execute on function public.get_user_rank_info(uuid) from anon;
grant execute on function public.get_user_rank_info(uuid) to authenticated;


-- ===== 029_caller_outranks =====
-- Fixes a forgeable authority check in the write-conflict resolver.
--
-- Migration 028 added get_user_rank_info() so a non-commander could read the
-- OTHER editor's permission_level. But the CURRENT user's own level was still
-- passed in from the browser (hierarchyWrite.ts took it as a parameter), so
-- anyone editing the request could claim level 100 and win every conflict.
-- The asymmetry was easy to miss precisely because one side was server-read.
--
-- This replaces both halves with a single server-side question: does the
-- CALLER outrank this user? The caller's identity comes from the JWT via
-- current_app_user_id(), so it cannot be supplied or altered by the client.
--
-- Fails closed: a caller who is not an active/approved app user gets null
-- from current_app_user_id(), the comparison yields null, and coalesce
-- returns false. A target that no longer exists is treated as rank 0.
create or replace function public.caller_outranks(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select me.permission_level from public.users me where me.id = public.current_app_user_id())
      > coalesce((select them.permission_level from public.users them where them.id = target_user_id), 0),
    false
  );
$$;

revoke execute on function public.caller_outranks(uuid) from public;
revoke execute on function public.caller_outranks(uuid) from anon;
grant execute on function public.caller_outranks(uuid) to authenticated;

-- get_user_rank_info is now unused by the app, and an unused SECURITY DEFINER
-- function that exposes another user's permission_level is surface we don't
-- need to keep. caller_outranks answers the same question without returning
-- anyone's rank to the client.
drop function if exists public.get_user_rank_info(uuid);


-- ===== 030_force_updated_by =====
-- Makes `updated_by` non-forgeable.
--
-- Migration 029 moved the rank comparison server-side, but the conflict
-- resolver still asks "who edited this row last?" by reading `updated_by` —
-- and that column was written by the client as part of the update payload.
-- A user could stamp it with their own id (or leave it null on a row that
-- had never been through the resolver) and the client-side code would then
-- skip the rank check entirely and treat itself as the winner.
--
-- Fixing this in the client is not possible: any value the browser sends is
-- attacker-controlled. So the database now owns the column. Every UPDATE on
-- these tables has `updated_by` overwritten with the caller's real app-user
-- id, whatever the payload said.
--
-- current_app_user_id() returns null for a non-app caller (service role, SQL
-- editor, a migration). In that case the supplied value is left alone so
-- admin/maintenance writes and backfills are not rewritten to null.
create or replace function public.force_updated_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := coalesce(public.current_app_user_id(), new.updated_by);
  return new;
end;
$$;

revoke execute on function public.force_updated_by() from public;
revoke execute on function public.force_updated_by() from anon;
revoke execute on function public.force_updated_by() from authenticated;

drop trigger if exists tasks_force_updated_by on public.tasks;
create trigger tasks_force_updated_by
  before update on public.tasks
  for each row execute function public.force_updated_by();

drop trigger if exists forum_daily_reports_force_updated_by on public.forum_daily_reports;
create trigger forum_daily_reports_force_updated_by
  before update on public.forum_daily_reports
  for each row execute function public.force_updated_by();


-- ===== 031_units_roles_require_app_user =====
-- Closes an information leak from the invite-only auth model.
--
-- login/page.tsx uses `signInWithOtp({ shouldCreateUser: true })` because a
-- commander's invite creates the public.users row before the invited person
-- ever signs in — Supabase Auth doesn't know their email yet at invite time,
-- so shouldCreateUser must stay true or the invited user's own first login
-- would fail. That flag is not itself the bug; the real gate is
-- claim_own_profile, which only succeeds against a matching unlinked
-- public.users row.
--
-- The bug is downstream: `shouldCreateUser: true` also means ANYONE can
-- request an OTP for ANY email and receive a valid `authenticated` JWT for
-- an auth.users row with no matching public.users invite — an orphan
-- account, never approved, never able to claim a profile. Migration 017
-- (section E) already dropped anon access to units/roles, but left them
-- `for select to authenticated using (true)` — which that orphan JWT still
-- satisfies. Anyone could request a code for a throwaway email and read the
-- entire unit/role structure without ever being invited.
--
-- current_app_user_id() (015) returns null unless the caller is an
-- active + approved row in public.users, which an orphan account can never
-- be. Tightening to it costs nothing for real users: units/roles are only
-- read from /admin (commander-only, already active+approved to reach it)
-- and no page a pending or unapproved user can reach needs them anymore
-- (the self-registration dropdowns that used to need them were removed —
-- the invite-only model has the commander set role/unit directly).
drop policy if exists "units: authenticated read" on public.units;
create policy "units: active approved read"
  on public.units for select to authenticated
  using (public.current_app_user_id() is not null);

drop policy if exists "roles: authenticated read" on public.roles;
create policy "roles: active approved read"
  on public.roles for select to authenticated
  using (public.current_app_user_id() is not null);


-- ===== 032_mentoring_entries_authenticated_only =====
-- The mentoring_entries policy (023) omitted `to authenticated`, so it
-- defaults to PUBLIC — the anon role is evaluated against it too. It fails
-- closed regardless (is_company_commander(auth.uid()) is false when
-- auth.uid() is null for an unauthenticated request), so this was never an
-- actual leak. Restricting to `authenticated` matches every other policy in
-- this schema and removes the anon role from evaluation entirely, rather
-- than relying on it failing closed by coincidence.
drop policy if exists "mentoring_entries: commander only" on public.mentoring_entries;
create policy "mentoring_entries: commander only"
  on public.mentoring_entries
  for all
  to authenticated
  using ( public.is_company_commander((select auth.uid())) )
  with check ( public.is_company_commander((select auth.uid())) );
