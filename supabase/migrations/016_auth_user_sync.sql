-- 016_auth_user_sync.sql
--
-- Ports an invite-claim subsystem that was already built and live on the
-- Staging project (claim_own_profile, guard_users_sensitive_fields,
-- rls_auto_enable) but existed nowhere in this migration history and had
-- never reached Production. One real gap in the original is fixed here:
-- claim_own_profile used to silently create a new pending profile when no
-- invitation matched — that made registration open, not invite-only. This
-- version raises instead.
--
-- Admin workflow: the commander adds a row to public.users directly in the
-- Supabase Table Editor (email, name, role, unit_id; status/role_approval
-- default to 'pending'; auth_user_id left null). No Supabase Auth Dashboard
-- step needed.
--
-- Login flow: the invited person requests an OTP for their email
-- (shouldCreateUser: true — Supabase Auth doesn't know them yet), verifies
-- the code, then the client calls claim_own_profile(email, name). The
-- function requires the JWT's verified email to match an existing
-- public.users row with auth_user_id still null; it links that row to the
-- new auth user and returns its id. Anyone whose email was never added by
-- the commander gets an exception — no profile is ever created for them.
--
-- guard_users_sensitive_fields prevents anyone but a commander (or the
-- claim path itself, which never touches these fields) from changing
-- role / unit_id / commanded_unit_id / permission_level / status /
-- role_approval_status — those stay commander-only via /admin.
--
-- rls_auto_enable is an unrelated, unconditionally-safe addition: an event
-- trigger that force-enables RLS on any table created from now on, so a
-- future migration can never forget it.

-- Defensive: remove the earlier attempt at this (auth.users-insert trigger)
-- if it exists anywhere. It is incompatible with the claim flow — both
-- would race to create/link a profile for the same auth user.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();

-- ============================================================
-- A. guard_users_sensitive_fields
-- ============================================================

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

revoke execute on function public.guard_users_sensitive_fields() from public;
revoke execute on function public.guard_users_sensitive_fields() from anon;
revoke execute on function public.guard_users_sensitive_fields() from authenticated;

drop trigger if exists guard_users_sensitive_fields_before_write on public.users;
create trigger guard_users_sensitive_fields_before_write
  before insert or update on public.users
  for each row execute function public.guard_users_sensitive_fields();

-- ============================================================
-- B. claim_own_profile — invite-only. No fallback insert.
-- ============================================================

drop function if exists public.claim_own_profile(text, text, text, uuid);
drop function if exists public.claim_own_profile(text, text);

create or replace function public.claim_own_profile(p_email text, p_name text)
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
  v_unlinked_matches integer;
  v_profile_id uuid;
begin
  if v_auth_id is null then
    raise exception 'authenticated session required';
  end if;

  if v_auth_email = '' or v_email = '' or v_auth_email <> v_email then
    raise exception 'verified Auth email does not match the requested profile email';
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

  if v_profile_id is null then
    raise exception 'no invitation found for this email — contact the company commander'
      using errcode = 'P0002';
  end if;

  update public.users
     set auth_user_id = v_auth_id,
         name = coalesce(nullif(v_name, ''), name),
         has_completed_onboarding = true,
         last_login_at = now(),
         updated_at = now()
   where id = v_profile_id;

  return v_profile_id;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'profile claim conflict';
end;
$$;

revoke execute on function public.claim_own_profile(text, text) from public;
revoke execute on function public.claim_own_profile(text, text) from anon;
grant execute on function public.claim_own_profile(text, text) to authenticated;

-- ============================================================
-- C. rls_auto_enable — force RLS on for every future table
-- ============================================================

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public') then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (schema %)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  execute function public.rls_auto_enable();

-- Event trigger functions fire automatically regardless of EXECUTE grants —
-- direct RPC calls (e.g. /rest/v1/rpc/rls_auto_enable) serve no purpose and
-- would just error outside a real DDL event context. Close them off anyway.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
