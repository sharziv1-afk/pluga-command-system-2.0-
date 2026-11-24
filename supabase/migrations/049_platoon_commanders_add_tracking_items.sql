-- 049_platoon_commanders_add_tracking_items.sql
-- מ״פ, 24.11.2026: a platoon commander (מ״מ) may add tracking items
-- (מופעי מעקב) inside a week, including company-wide ones — until now only
-- the tracking commanders (מ״פ, סמ״פ, ע.מ״פ, level ≥ 90) could, and a מ״מ who
-- tried got "אין לך הרשאה".
--
-- Added, alongside the existing policies (permissive, so they OR):
--   * insert: a מ״מ may add an item, recorded as created by them;
--   * update: a מ״מ may edit or remove (is_active = false) an item they added
--     themselves — not anyone else's.
-- Weeks stay with the tracking commanders. The OAuth (MCP) limits of 035/046
-- are restrictive policies and still apply on top. No table or column change.

-- An active, approved user whose role is מ״מ (any quote variant, any number).
create or replace function public.is_platoon_commander(auth_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.users u
     where u.auth_user_id = auth_id
       and u.status = 'active'
       and u.role_approval_status = 'approved'
       and replace(
             btrim(translate(coalesce(u.role, ''),
               chr(1524) || chr(1523) || chr(39) || chr(34) || chr(180) || chr(8220) || chr(8221),
               '"""""""')),
             ' ', '') like U&'\05DE"\05DE%'
  )
$$;

revoke execute on function public.is_platoon_commander(uuid) from public;
revoke execute on function public.is_platoon_commander(uuid) from anon;
grant execute on function public.is_platoon_commander(uuid) to authenticated;

drop policy if exists "tracking_items: platoon commander insert" on public.tracking_items;
create policy "tracking_items: platoon commander insert"
  on public.tracking_items for insert to authenticated
  with check (
    public.is_platoon_commander((select auth.uid()))
    and created_by = public.current_app_user_id()
  );

drop policy if exists "tracking_items: platoon commander update own" on public.tracking_items;
create policy "tracking_items: platoon commander update own"
  on public.tracking_items for update to authenticated
  using (
    public.is_platoon_commander((select auth.uid()))
    and created_by = public.current_app_user_id()
  )
  with check (
    public.is_platoon_commander((select auth.uid()))
    and created_by = public.current_app_user_id()
  );
