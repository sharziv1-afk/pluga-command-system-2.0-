-- ============================================================
-- 002_rls_policies.sql
-- RLS policies and helper function for the pluga-command-system.
--
-- STATUS: Already applied manually in Supabase.
-- PURPOSE: Version-control reference and recovery for new environments.
-- DO NOT re-run in production unless the database was reset.
-- All DROP ... IF EXISTS statements make this file idempotent.
-- ============================================================


-- ============================================================
-- A. Helper: public.is_commander(auth_id uuid)
--    Returns true when the authenticated user is an approved,
--    active commander (מ"פ / סמ"פ or permission_level >= 90).
--
--    SECURITY DEFINER with explicit search_path prevents
--    schema-based injection attacks.
-- ============================================================

drop function if exists public.is_commander(uuid);

create or replace function public.is_commander(auth_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role       text;
  v_status     text;
  v_approval   text;
  v_level      integer;
  v_normalized text;
begin
  select role, status, role_approval_status, permission_level
    into v_role, v_status, v_approval, v_level
    from public.users
   where auth_user_id = auth_id
   limit 1;

  if not found then
    return false;
  end if;

  if v_status <> 'active' then
    return false;
  end if;

  if v_approval <> 'approved' then
    return false;
  end if;

  -- Normalize Hebrew gershayim (U+05F4 ״) to standard double-quote (U+0022 ")
  -- so that roles stored with either encoding match correctly.
  v_normalized := replace(v_role, chr(1524), '"');

  if v_normalized in ('מ"פ', 'סמ"פ') or v_level >= 90 then
    return true;
  end if;

  return false;
end;
$$;


-- ============================================================
-- B. RLS: public.users
-- ============================================================

alter table public.users enable row level security;

-- B1. Every authenticated user can read their own profile row.
drop policy if exists "users: select own profile" on public.users;
create policy "users: select own profile"
  on public.users
  for select
  to authenticated
  using ( auth_user_id = auth.uid() );

-- B2. Commanders can read all profiles.
drop policy if exists "users: commander select all" on public.users;
create policy "users: commander select all"
  on public.users
  for select
  to authenticated
  using ( public.is_commander(auth.uid()) );

-- B3. Commanders can update any profile
--     (used by Admin Panel: approve, reject, edit role/unit/permission_level).
drop policy if exists "users: commander update all" on public.users;
create policy "users: commander update all"
  on public.users
  for update
  to authenticated
  using ( public.is_commander(auth.uid()) )
  with check ( public.is_commander(auth.uid()) );


-- ============================================================
-- C. RLS: public.requests
-- ============================================================

alter table public.requests enable row level security;

-- C1. Any authenticated user can insert a request for themselves.
--     The requested_by value must match their own public.users.id.
drop policy if exists "requests: insert own" on public.requests;
create policy "requests: insert own"
  on public.requests
  for insert
  to authenticated
  with check (
    requested_by = (
      select id from public.users
       where auth_user_id = auth.uid()
       limit 1
    )
  );

-- C2. A user can view requests they created.
drop policy if exists "requests: select own" on public.requests;
create policy "requests: select own"
  on public.requests
  for select
  to authenticated
  using (
    requested_by = (
      select id from public.users
       where auth_user_id = auth.uid()
       limit 1
    )
  );

-- C3. A user can view all requests belonging to their unit.
drop policy if exists "requests: select own unit" on public.requests;
create policy "requests: select own unit"
  on public.requests
  for select
  to authenticated
  using (
    unit_id is not null
    and unit_id = (
      select unit_id from public.users
       where auth_user_id = auth.uid()
         and unit_id is not null
       limit 1
    )
  );

-- C4. Commanders can view all requests.
drop policy if exists "requests: commander select all" on public.requests;
create policy "requests: commander select all"
  on public.requests
  for select
  to authenticated
  using ( public.is_commander(auth.uid()) );

-- C5. Commanders can update any request (status changes, assignment, etc.).
drop policy if exists "requests: commander update all" on public.requests;
create policy "requests: commander update all"
  on public.requests
  for update
  to authenticated
  using ( public.is_commander(auth.uid()) )
  with check ( public.is_commander(auth.uid()) );


-- ============================================================
-- D. RLS: public.comments
-- ============================================================

alter table public.comments enable row level security;

-- D1. Authenticated users can read request comments for requests they can view.
drop policy if exists "comments: select request comments for request viewers" on public.comments;
create policy "comments: select request comments for request viewers"
  on public.comments
  for select
  to authenticated
  using (
    entity_type = 'request'
    and exists (
      select 1
        from public.requests
       where requests.id = comments.entity_id
    )
  );

-- D2. Authenticated users can add their own treatment update to a request they can view.
--     The user_id value must match their own public.users.id.
drop policy if exists "comments: insert own request comments for request viewers" on public.comments;
create policy "comments: insert own request comments for request viewers"
  on public.comments
  for insert
  to authenticated
  with check (
    entity_type = 'request'
    and user_id = (
      select id from public.users
       where auth_user_id = auth.uid()
       limit 1
    )
    and exists (
      select 1
        from public.requests
       where requests.id = comments.entity_id
    )
  );
