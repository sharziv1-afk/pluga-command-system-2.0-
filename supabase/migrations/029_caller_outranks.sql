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
