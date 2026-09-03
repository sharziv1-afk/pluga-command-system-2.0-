-- 022_merge_assistant_commander_into_mashad.sql
-- The commander confirmed ע. מ"פ and מש"ד are the same real position — the
-- assistant to the company commander. Consolidates onto מש"ד (the name he
-- gave explicitly), which 021 already added to the roles table.
--
-- Production has exactly one real user holding 'ע. מ"פ'; this migrates
-- that row's role rather than leaving it orphaned once the role is removed
-- from the picklist. permission_level stays 85 either way — the app code
-- (src/lib/permissions.ts, profile/admin/forum pages) was updated in the
-- same change to key off מש"ד instead of ע. מ"פ.

update public.users
set role = 'מש"ד'
where role = 'ע. מ״פ' or role = 'ע. מ"פ';

delete from public.roles
where name = 'ע. מ״פ' or name = 'ע. מ"פ';
