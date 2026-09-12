-- 034_sandbox_is_commander_parity.sql
--
-- Closes a drift found on 2026-09-13 by comparing ELEVEN catalog signatures
-- between the two projects instead of the previous three. Ten matched exactly.
-- `functions` did not:
--
--   LIVE     vmfihyritfmjycrfpxjn  is_commander  985 chars
--   SANDBOX  hjltpajvqhnygjybtivd  is_commander  426 chars
--
-- The sandbox was still running a pre-002 version:
--
--   return exists (
--     select 1 from public.users
--     where auth_user_id = auth_id
--       and (role in ('מ״פ','מ"פ','סמ״פ','סמ"פ') or permission_level >= 90)
--       and status = 'active' and role_approval_status = 'approved');
--
-- In practice the two agree on every role string that exists today — the live
-- version normalizes gershayim (U+05F4) to a straight quote and so matches the
-- same four spellings the old one enumerated. The divergence that matters is
-- not the role matching, it is `exists(...)` over every matching row versus
-- `limit 1` into locals: given two rows sharing an auth_user_id, the old one
-- returns true if ANY row qualifies, the new one judges whichever row the
-- planner happens to return. They cannot be assumed to agree.
--
-- That difference is small. The problem it represents is not: the sandbox
-- exists so that a policy change can be rehearsed somewhere harmless, and a
-- rehearsal is worthless if the stand-in is running different code. This is
-- the third audit cycle in which the two projects were called "twins" on the
-- strength of three signatures that never covered function bodies.
--
-- LIVE already matches 002_rls_policies.sql exactly, so running this there is
-- a no-op that rewrites the function with the identical definition. Run it on
-- BOTH anyway - the point is that afterwards both are provably the repo's
-- version rather than assumed to be.
--
-- Deliberately no `drop function` first: five RLS policies depend on this
-- function and a drop would be refused. `create or replace` keeps the same
-- signature, so the dependencies ride through untouched.
--
-- Run manually in the SQL editor. Sandbox first, then live.
--
-- Verify afterwards - this must return the same md5 in both projects:
--   select md5(pg_get_functiondef(p.oid))
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'is_commander';
-- Expected: 0e87e1a51bc39b27ddb4303876c81cf8 (live's value before this ran).

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
