-- 050_squad_commanders_edit_tracking.sql
-- מ״פ, 28.11.2026: the squad commanders (מ״כ) run the tracking for their
-- platoon, so each needs to mark cells (עבר / לא עבר / ציון / הערה) for the
-- soldiers of their own platoon. They could already see them
-- (current_tracking_unit_id); only a מ״מ could edit.
--
-- can_edit_tracking_unit() is replaced with the same body, except that a
-- מ״כ now passes exactly as a מ״מ does: for their own unit only
-- (coalesce(commanded_unit_id, unit_id) = the soldier's unit). Nothing else
-- changes: adding or removing soldiers, items and weeks stays as it was.

create or replace function public.can_edit_tracking_unit(target_unit_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text;
  v_approval text;
  v_unit_id uuid;
  v_commanded_unit_id uuid;
  v_normalized_role text;
begin
  if target_unit_id is null then
    return false;
  end if;

  if public.is_tracking_commander(auth.uid()) then
    return true;
  end if;

  select u.role, u.status, u.role_approval_status, u.unit_id, u.commanded_unit_id
    into v_role, v_status, v_approval, v_unit_id, v_commanded_unit_id
    from public.users u
   where u.auth_user_id = auth.uid()
   limit 1;

  if not found then
    return false;
  end if;

  if v_status <> 'active' or v_approval <> 'approved' then
    return false;
  end if;

  -- Normalize the quote variants seen in Hebrew role labels:
  -- Hebrew gershayim, Hebrew geresh, straight quotes, acute accent, and smart quotes.
  v_normalized_role := btrim(
    translate(
      coalesce(v_role, ''),
      chr(1524) || chr(1523) || chr(39) || chr(34) || chr(180) || chr(8220) || chr(8221),
      '"""""""'
    )
  );

  -- מ״מ (049 and before) or מ״כ (050), for their own platoon only.
  return
    (v_normalized_role like U&'\05DE"\05DE%' or v_normalized_role like U&'\05DE"\05DB%')
    and coalesce(v_commanded_unit_id, v_unit_id) = target_unit_id;
end;
$$;

revoke execute on function public.can_edit_tracking_unit(uuid) from public;
revoke execute on function public.can_edit_tracking_unit(uuid) from anon;
grant execute on function public.can_edit_tracking_unit(uuid) to authenticated;
