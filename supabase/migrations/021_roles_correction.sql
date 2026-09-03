-- 021_roles_correction.sql
-- Corrects 019's role additions and a pre-existing seeding error, per the
-- commander's direct confirmation of the real chain of command:
--   מ"פ, סמ"פ, 4×מ"מ, 12×מ"כ (3 squads per platoon — not 4), and in the
--   מפל"ג: מש"ד, רס"פ, סרס"פ, ב.קוד, חופ"ל.
--
-- A. Removes the 4 roles from 019 that turned out not to be part of the
--    real structure (קמב"צ, משק"ש, קשפ"ל, מש"ק ארמו"ן). סרס"פ stays —
--    it's on the confirmed list. Verified zero users hold any of these
--    roles before deleting.
-- B. Removes the 4th squad (א-ד) from every platoon's מ"כ list — the
--    original seed_units_roles.sql seeded 4 squads/platoon; the real
--    structure is 3 (א-ג), matching the squad labels used everywhere
--    else in the app (e.g. "כיתה 1/א"). Verified zero users hold these.
-- C. Adds מש"ד — עוזר המ"פ ומפקד שאינו קצין האחראי על ההדרכה בפלוגה —
--    sourced from the commander directly (role definition lives in a
--    company-file document not covered by the migration this reverses).

delete from public.roles
where name in ('קמב"צ', 'משק"ש', 'קשפ"ל', 'מש"ק ארמו"ן');

-- Matched by suffix, not exact string: seed_units_roles.sql stored these
-- with the Hebrew gershayim character (״, U+05F4), not a straight quote,
-- so an exact `in (...)` match against straight-quoted literals silently
-- deletes nothing. `like` on the trailing squad letter is quote-agnostic.
delete from public.roles
where name like '%1ד' or name like '%2ד' or name like '%3ד' or name like '%4ד';

insert into public.roles (name, description, permission_level)
values ('מש"ד', 'עוזר המ"פ ומפקד שאינו קצין — אחראי על ההדרכה בפלוגה.', 70)
on conflict (name) do nothing;
