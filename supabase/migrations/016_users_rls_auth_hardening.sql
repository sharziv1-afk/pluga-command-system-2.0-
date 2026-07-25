-- 016_users_rls_auth_hardening.sql
-- Additive draft for review. Apply manually in Supabase only after approval.

begin;

-- Keep the existing commander rules, but make the helper's volatility explicit
-- for policy planning and query stability.
alter function public.is_commander(uuid) stable;
alter function public.is_commander(uuid) set search_path = public;

-- Reconcile the users policy names observed in the live snapshot and in the
-- repository. Authenticated is intentional: anonymous callers must not enter
-- profile policies even when auth.uid() is null.
alter table public.users enable row level security;

drop policy if exists "users: select own profile" on public.users;
drop policy if exists "users: commander select all" on public.users;
drop policy if exists "users: commander update all" on public.users;
drop policy if exists "users: insert own profile" on public.users;
drop policy if exists "users: update own profile" on public.users;
drop policy if exists "users: commander manage profiles" on public.users;
drop policy if exists "Allow users to view own profile or commanders to view all" on public.users;
drop policy if exists "Users can insert own profile" on public.users;
drop policy if exists "Users can select own profile" on public.users;
drop policy if exists "Users can update own profile" on public.users;
drop policy if exists "Allow commanders to manage profiles" on public.users;

create policy "users: insert own profile"
  on public.users
  for insert
  to authenticated
  with check (auth_user_id = auth.uid());

create policy "users: select own profile"
  on public.users
  for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "users: commander select all"
  on public.users
  for select
  to authenticated
  using (public.is_commander(auth.uid()));

create policy "users: update own profile"
  on public.users
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "users: commander update all"
  on public.users
  for update
  to authenticated
  using (public.is_commander(auth.uid()))
  with check (public.is_commander(auth.uid()));

-- RLS controls rows, not individual columns. Keep identity, membership and
-- approval fields outside ordinary self-service writes.
create or replace function public.guard_users_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
begin
  -- Null auth.uid() is reserved for trusted server-side maintenance paths.
  if v_auth_id is null or public.is_commander(v_auth_id) then
    return new;
  end if;

  if new.auth_user_id is distinct from v_auth_id then
    raise exception 'users auth_user_id must match the authenticated user';
  end if;

  if tg_op = 'INSERT' then
    if new.permission_level <> 0
       or new.role_approval_status <> 'pending'
       or new.status <> 'pending' then
      raise exception 'new profiles require pending approval defaults';
    end if;
    return new;
  end if;

  -- The only non-commander re-link allowed is the verified-email claim RPC
  -- for an existing unlinked profile. RLS prevents direct access to that row.
  -- The claim operation may attach auth_user_id and update safe profile state,
  -- but it must preserve every sensitive field from the unlinked row.
  if old.auth_user_id is null and new.auth_user_id = v_auth_id then
    if new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.unit_id is distinct from old.unit_id
       or new.commanded_unit_id is distinct from old.commanded_unit_id
       or new.permission_level is distinct from old.permission_level
       or new.role_approval_status is distinct from old.role_approval_status
       or new.status is distinct from old.status then
      raise exception 'users sensitive fields are managed by the approval flow';
    end if;
    return new;
  end if;

  if old.auth_user_id is distinct from v_auth_id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.unit_id is distinct from old.unit_id
     or new.commanded_unit_id is distinct from old.commanded_unit_id
     or new.permission_level is distinct from old.permission_level
     or new.role_approval_status is distinct from old.role_approval_status
     or new.status is distinct from old.status then
    raise exception 'users sensitive fields are managed by the approval flow';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_users_sensitive_fields_before_write on public.users;
create trigger guard_users_sensitive_fields_before_write
  before insert or update on public.users
  for each row
  execute function public.guard_users_sensitive_fields();

-- Claim only an unlinked profile whose normalized email matches the verified
-- Auth email. Sensitive values are fixed to safe pending defaults here rather
-- than accepted from the browser as authority.
-- Supabase Auth Confirm email is enabled in the supplied snapshot; keep it
-- enabled because this RPC trusts only the verified email in auth.jwt().
create or replace function public.claim_own_profile(
  p_email text,
  p_name text,
  p_role text,
  p_unit_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
  v_auth_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_role text := trim(coalesce(p_role, ''));
  v_unlinked_matches integer;
  v_profile_id uuid;
begin
  if v_auth_id is null then
    raise exception 'authenticated session required';
  end if;

  if v_auth_email = '' or v_email = '' or v_auth_email <> v_email then
    raise exception 'verified Auth email does not match the requested profile email';
  end if;

  if v_name = '' or v_role = '' then
    raise exception 'profile name and role are required';
  end if;

  select count(*)
    into v_unlinked_matches
    from public.users
   where lower(email) = v_email
     and auth_user_id is null;

  if v_unlinked_matches > 1 then
    raise exception 'multiple unlinked profiles match the verified email';
  end if;

  select id
    into v_profile_id
    from public.users
   where lower(email) = v_email
     and auth_user_id is null
   for update;

  if v_profile_id is not null then
    update public.users
       set auth_user_id = v_auth_id,
           name = v_name,
           has_completed_onboarding = true,
           last_login_at = now(),
           updated_at = now()
     where id = v_profile_id;

    return v_profile_id;
  end if;

  insert into public.users (
    auth_user_id,
    email,
    name,
    role,
    unit_id,
    permission_level,
    has_completed_onboarding,
    role_approval_status,
    status,
    last_login_at
  ) values (
    v_auth_id,
    v_email,
    v_name,
    v_role,
    p_unit_id,
    0,
    true,
    'pending',
    'pending',
    now()
  )
  returning id into v_profile_id;

  return v_profile_id;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'profile claim conflict';
end;
$$;

revoke all on function public.claim_own_profile(text, text, text, uuid) from public;
grant execute on function public.claim_own_profile(text, text, text, uuid) to authenticated;

commit;
