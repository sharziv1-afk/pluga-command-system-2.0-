-- 047_squad_roles_acd.sql
-- The company's squads are א, ג, ד in every platoon (roster of 16.11.2026),
-- not א-ג as migration 021 set. Roles מ״כ 1ד…4ד are added and מ״כ 1ב…4ב are
-- removed, but only once no profile holds them (the 12 squad-commander
-- profiles were renamed to the real people on 16.11.2026).
--
-- Reference data only: no schema, no policy, no user row. Already applied to
-- LIVE by hand on 16.11.2026; written idempotent so running it again (or on
-- the sandbox) changes nothing that is already right.

insert into public.roles (name, description, permission_level)
select 'מ״כ ' || n || 'ד', 'מפקד כיתה ' || n || 'ד', 50
from generate_series(1, 4) as n
on conflict (name) do nothing;

delete from public.roles r
where r.name ~ '^מ.כ [1-4]ב$'
  and not exists (select 1 from public.users u where u.role = r.name);
