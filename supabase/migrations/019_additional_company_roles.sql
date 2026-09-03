-- 019_additional_company_roles.sql
-- Adds company roles that exist in the real chain of command (per תפקידי
-- הפלוגה-פיש, the commander's own role-definition document) but were never
-- seeded: סרס"פ, קמב"צ, משק"ש, קשפ"ל, מש"ק ארמו"ן. Purely additive — does
-- not touch existing roles or any user row. `roles.name` is unique, so this
-- is idempotent.

insert into public.roles (name, description, permission_level)
values
  ('סרס"פ', 'סגן רס"פ — מחליף בהעדרו, מסייע באכיפת משמעת ונהלים וניהול המפל"ג', 70),
  ('קמב"צ', 'עוזרו הישיר של המ"פ — ניהול כוח אדם, טפסולוגיה, דו"ח 1 פלוגתי וניהול משרד', 75),
  ('משק"ש', 'אחראי צפנים פלוגתיים — מעקב, אפסון, תיקון וניפוק', 60),
  ('קשפ"ל', 'מסייע למשק"ש בתפעול וביצוע משימות התקשוב בפלוגה', 55),
  ('מש"ק ארמו"ן', 'אחראי צל"מ פלוגתי — מעקב, אפסון וניפוק', 60)
on conflict (name) do nothing;
