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
