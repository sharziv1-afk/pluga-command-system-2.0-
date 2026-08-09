# Users RLS/Auth Hardening Runbook

מסמך מבצעי מנוהל בגיט עבור **PR #3** ו-**migration 016** (`016_users_rls_auth_hardening.sql`).

---

## 1. Purpose

Runbook זה מרכז את סדר הפעולות, בדיקות החובה וכללי העצירה עבור הקשחת ה-RLS/Auth של `public.users`.

**המסמך קיים כי הידע הזה לא יכול לחיות רק במחשב מקומי.** ה-runbook התפעולי המקורי נוצר תחת `.ai-workspace/runs/`, שמוחרג מגיט — ולכן סדר הפריסה, שהוא הסיכון המבצעי המרכזי כאן, לא היה מנוהל בבקרת גרסאות.

> **PR #3 מוכן ל-Ready for review בלבד.** הביקורת הסטטית ובדיקות ה-staging הידניות A–J עברו. הוא עדיין **אינו מאושר למיזוג או לפריסה ל-production**; לפני production נדרש snapshot טרי וסדר הפריסה המחייב בסעיפים 3 ו-7.

---

## 2. Current status

| פריט | מצב |
|---|---|
| PR #3 | **Ready for review; not approved for merge/deploy** |
| קבצים ב-PR | `supabase/migrations/016_users_rls_auth_hardening.sql`, `src/app/(auth)/login/page.tsx` |
| migration 016 ב-`hamifkad-staging` | **עברה** (מבנית) |
| post-snapshot אחרי 016 | **תקין** — ראה סעיף 4 |
| Email OTP ב-staging | **עבר** באמצעות SMTP ייעודי ותבנית `{{ .Token }}` |
| הוכחת runtime | **בדיקות A–J עברו** |

`claim_own_profile` והטריגר `guard_users_sensitive_fields` הופעלו בפועל ב-`hamifkad-staging`: הרשמה, חסימת self-escalation, אישור מפקד, profile claim, linked-email conflict ועדכון `last_login_at` עברו כמצופה.

---

## 3. Mandatory deployment order

> ## ⚠️ אזהרה מבצעית — סדר חובה, אין לסטות
>
> ```
> 1. apply migration 016 to target DB
> 2. verify snapshots
> 3. run manual staging / security tests
> 4. only then deploy / merge application code
> ```

**למה הסדר קריטי:**

`src/app/(auth)/login/page.tsx` קורא בהרשמה ל-RPC בשם `claim_own_profile`. הקריאה היא **מחרוזת** — TypeScript לא יכול לאמת שהפונקציה קיימת, ולכן `lint`, `tsc` ו-`build` **יעברו בירוק גם אם ה-RPC לא קיים ב-DB היעד**.

אם קוד האפליקציה ייפרס לפני שמיגרציה 016 הורצה באותה סביבה:

- כל הרשמה חדשה תיכשל (`PGRST202` — הפונקציה לא קיימת).
- המשתמש יראה הודעה גנרית בלבד.
- ב-production `logSupabaseError` אינו מדפיס דבר, ולכן **לא יהיה לוג לדבג לפיו**.

**המסקנה: DB תמיד לפני קוד. לעולם לא הפוך.**

---

## 4. Staging setup status

| פריט | מצב |
|---|---|
| פרויקט Supabase | `hamifkad-staging` (נוצר ידנית, נפרד מ-production) |
| Confirm email | **מופעל** — קריטי, ראה סעיף 6 |
| Redirect URL | `localhost` הוגדר |
| migrations 001–015 | הורצו |
| `seed_units_roles.sql` | הורץ |
| migration 016 | הורצה |

**Post-snapshot תקין — המצב הצפוי אחרי 016:**

- **5 policies** על `public.users`, בדיוק בשמות הבאים:
  - `users: insert own profile`
  - `users: select own profile`
  - `users: commander select all`
  - `users: update own profile`
  - `users: commander update all`
- `is_commander(auth_id uuid)` — `provolatile = s` (STABLE), `SECURITY DEFINER`, `search_path = public`
- הפונקציה `claim_own_profile` קיימת
- הפונקציה `guard_users_sensitive_fields` קיימת
- הטריגר `guard_users_sensitive_fields_before_write` קיים על `public.users`

> מסמך זה אינו כולל ואינו יכול לכלול: מפתחות, ערכי env, URLs מלאים, JWT או כל secret. שמות פרויקט ושמות אובייקטים ב-DB בלבד.

---

## 5. Manual staging test checklist

### Prerequisite: Email OTP Template Requirement

זרימת ההרשמה של "המפקד" היא **Email OTP code-only**. החלטת המוצר היא להשתמש
בקוד אימות שהמשתמש מזין באפליקציה, ולא ב-confirmation link כברירת מחדל.

`login/page.tsx` מפעיל `signInWithOtp`, מאמת את הקוד באמצעות `verifyOtp` עם
`token` ו-`type: 'email'`, ורק לאחר אימות מוצלח קורא ל-`claim_own_profile`.
`registrationDraft` נשמר ב-React state בלבד. ה-auth callback אינו קורא
ל-`claim_own_profile`, ולכן confirmation link אינו תחליף לבדיקה של מסלול
ההרשמה האמיתי ועלול להשאיר auth user ללא פרופיל מלא או עם פרופיל חלקי.

תבנית ברירת המחדל של Supabase Confirm signup שולחת `{{ .ConfirmationURL }}`.
בכל סביבת Supabase שמריצה את האפליקציה, תבנית Confirm signup חייבת לכלול
`{{ .Token }}` כדי שהמייל יספק קוד OTP, ולא רק confirmation link.

לפני תחילת בדיקות A–J חובה בכל סביבת staging חדשה:

1. להגדיר Custom SMTP בסביבת staging.
2. לעדכן את Confirm signup template כך שתציג `{{ .Token }}`.
3. לשלוח מייל הרשמה חדש ולוודא שהוא מכיל קוד OTP.
4. רק אז לבצע את בדיקות ההרשמה והאבטחה להלן.

ב-`hamifkad-staging` הוגדר SMTP ייעודי באמצעות Mailtrap ותבנית הכוללת
`{{ .Token }}`; קבלת OTP ובדיקת ההרשמה עברו. אין להשתמש ב-confirmation link
כתחליף, ואין ללחוץ על confirmation links שנשלחו במיילים קודמים.
הקשחת callback/link flow נשארת follow-up מתועד ואינה blocker ל-PR #3.

כל קטעי ה-SQL המודפסים להלן הם **read-only** ומיועדים ל-**staging בלבד**.
הצ'קליסט כולל גם פעולות כתיבה ידניות ומבוקרות ב-staging לצורכי בדיקת registration,
bootstrap ו-profile claim; הן מסומנות במפורש ואינן מורצות כחלק מהמסמך.
אין לבצע אף אחת מהפעולות על production.

### A. Register regular staging user
1. `npm run dev` → `/login` → לשונית **"הרשמה ראשונה"**.
2. למלא שם מלא, מייל אמיתי בשליטתך (מומלץ alias `+staging1`), סיסמה ≥ 8 תווים, תפקיד `מ״מ 1`.
3. "שלח קוד אימות" → להזין את הקוד מהמייל → "אמת קוד והמשך".
4. **צפוי:** ההרשמה מסתיימת ללא שגיאה, והמשתמש מגיע למסך "ממתין לאישור מ״פ".

```sql
select id, email, name, role, unit_id, permission_level,
       role_approval_status, status, has_completed_onboarding,
       auth_user_id is not null as is_linked
from public.users
order by created_at desc
limit 5;
```

### B. Verify pending defaults
בשורה החדשה חייב להתקיים:
- `status = 'pending'`
- `role_approval_status = 'pending'`
- `permission_level = 0`
- `is_linked = true`

### C. Self-escalation blocked
המטרה: להוכיח שהטריגר חוסם ניסיון של משתמש לקדם את עצמו.

**חשוב:** הבדיקה חייבת להתבצע **מתוך סשן הדפדפן של המשתמש הרגיל**, ולא מ-SQL editor. ב-SQL editor הערך `auth.uid()` הוא `null`, והטריגר מעביר במכוון (זהו נתיב התחזוקה המהימן) — ולכן בדיקה משם תיתן תוצאה מטעה.

**צפוי:** דחייה עם `users sensitive fields are managed by the approval flow`.

אימות אחרי הניסיון:
```sql
select email, role, permission_level, role_approval_status, status
from public.users
where lower(email) = lower('<המייל שנבדק>');
```
כל הערכים חייבים להישאר `0 / pending / pending`.

### D. Regular user cannot update sensitive fields
לוודא שגם ניסיון עדכון של `role`, `unit_id`, `commanded_unit_id` או `email` מהסשן של המשתמש הרגיל נדחה באותה הודעה. הטריגר מגן על שבעה שדות: `email`, `role`, `unit_id`, `commanded_unit_id`, `permission_level`, `role_approval_status`, `status`.

### E. Commander/admin approval works
1. **יצירת מפקד staging:** להירשם כמשתמש שני, ואז לקדם אותו **ידנית ב-SQL editor של staging** ל-`role = 'מ״פ'`, `status = 'active'`, `role_approval_status = 'approved'`, `permission_level = 100`. זהו נתיב ה-bootstrap הלגיטימי היחיד, כי `auth.uid()` הוא `null` שם.
2. להתחבר כמפקד → `/admin` → המשתמש מ-A מופיע ב"בקשות ממתינות".
3. "ערוך" → להגדיר תפקיד ומסגרת → "שמור שינויים" → "אשר מפקד".
4. **צפוי:** המשתמש עובר ל-`active` / `approved`.
5. **בדיקה נגדית:** להתחבר כמשתמש הרגיל → `/admin` → **צפוי מסך "אין לך הרשאות גישה"**, ואי אפשר לאשר אף אחד.

```sql
select email, role, permission_level, role_approval_status, status, updated_at
from public.users
order by updated_at desc
limit 5;
```

### F. Profile claim for verified email works
1. **ב-SQL editor של staging** ליצור שורה לא-מקושרת (`auth_user_id = null`) עם מייל שלישי בשליטתך.
2. לצלם את המצב לפני:
```sql
select id, email, role, unit_id, commanded_unit_id, permission_level,
       role_approval_status, status
from public.users
where auth_user_id is null;
```
3. להירשם באפליקציה עם **אותו מייל בדיוק**.
4. **צפוי:** ההרשמה מצליחה והשורה מתקשרת (`auth_user_id` מתמלא).

### G. Claim preserves sensitive fields — התנהגות מכוונת
להריץ שוב את השאילתה מ-F.2 (ללא תנאי `auth_user_id is null`) ולהשוות שדה-שדה.

**צפוי:** `role`, `unit_id`, `commanded_unit_id`, `permission_level`, `role_approval_status`, `status` — **נשארו בדיוק כפי שהיו**. ה-claim מעדכן רק `auth_user_id`, `name`, `has_completed_onboarding`, `last_login_at`, `updated_at`.

זו **התנהגות מכוונת**, לא באג. ראה סעיף 6 — יש לה משמעות אבטחתית.

### H. Conflict / linked email shows friendly error
1. להירשם עם מייל שכבר **מקושר** (מ-A).
2. **צפוי בממשק:** `כבר קיים פרופיל מקושר למייל הזה. פנה למנהל המערכת.`
3. לוודא שלא נוצרה כפילות:
```sql
select lower(email) as email_key, count(*)
from public.users
group by 1
having count(*) > 1;
```
צפוי: אפס שורות.

### I. last_login_at still updates
להתנתק ולהתחבר מחדש כמשתמש רגיל. הטריגר לא אמור לחסום עדכון של `last_login_at` בלבד.
```sql
select email, last_login_at from public.users order by last_login_at desc limit 5;
```
צפוי: הערך התעדכן.

### J. No raw DB errors in UI
לאורך כל הבדיקות: אף מסך לא מציג SQLSTATE, שם constraint, שם טבלה, hint או stack trace. רק הודעות בעברית מנוסחות מראש.

### Staging validation result — A–J passed

| בדיקה | תוצאה |
|---|---|
| A–B — OTP registration + pending defaults | **PASSED** — נוצר פרופיל מקושר עם `permission_level = 0`, `status = pending`, `role_approval_status = pending` |
| C–D — sensitive-field protection | **PASSED** — self-escalation נדחה עם `users sensitive fields are managed by the approval flow`; ערכי ה-pending לא השתנו |
| E — commander approval + regular-user denial | **PASSED** — אישור דרך Admin UI העביר מ״מ 1 ל-`active`/`approved` עם `permission_level = 70`; משתמש רגיל לא ראה Admin ונחסם ב-`/admin` |
| F–G — unlinked profile claim | **PASSED** — `auth_user_id` חובר, נשמרה שורה יחידה, והשדות הרגישים נשמרו (`permission_level = 70`, `active`, `approved`) |
| H — linked-email conflict | **PASSED** — הוצגה הודעת "המייל בשימוש" ידידותית ולא נוצרה כפילות |
| I — `last_login_at` | **PASSED** — הערך קיים והתעדכן לאחר התחברות |
| J — no raw DB errors | **PASSED** — לא הוצגו SQLSTATE, constraint או פרטי DB גולמיים |

הבדיקות בוצעו ב-`hamifkad-staging` בלבד. הן אינן אישור להריץ migration או לפרוס קוד ל-production.

---

## 6. Profile claim semantics — אזהרת invitation

הפונקציה `claim_own_profile`, כשהיא תובעת שורה **לא-מקושרת** (`auth_user_id is null`), **משמרת** את `role`, `unit_id`, `commanded_unit_id`, `permission_level`, `role_approval_status` ו-`status` של אותה שורה. היא מעדכנת רק את שדות הזהות והתצוגה.

**המשמעות:** זהו בפועל מנגנון **invitation / claim**. מי שמחזיק בשליטה על המייל המאומת, ותובע שורה לא-מקושרת שכבר מוגדרת כמאושרת — **מקבל את ההרשאות של אותה שורה מיד, בלי אישור נוסף**.

**כללי חובה:**

1. **כל פיצ׳ר עתידי שיוצר שורות לא-מקושרות הוא, בפועל, פיצ׳ר להענקת הרשאות** — ויש לתכנן אותו ככזה, כולל ביקורת ו-audit.
2. **רק מייל מאומת יהיה שער ה-claim.** לכן `Confirm email` ב-Supabase Auth חייב להישאר **מופעל**. אם יכובה, טענת ה-email ב-JWT מפסיקה להיות הוכחת בעלות, וה-claim נפרץ.
3. **אין ליצור שורה לא-מקושרת עם `role_approval_status = 'approved'` או `status = 'active'` או `permission_level` גבוה — בלי החלטת מוצר מפורשת ומתועדת.** במיוחד לא פרופיל מפקד.
4. אם/כאשר ייבנה זרימת הזמנות מלאה (ראה `MULTI_COMPANY_SCHEMA_RLS_DRAFT.md`), היא חייבת להתיישר עם הסמנטיקה הזו ולא ליצור מנגנון מקביל שני.

---

## 7. Production warnings

**אין להריץ 016 על production על סמך המסמך הזה בלבד.**

1. **snapshot טרי לפני כל דבר אחר.** המצב המתועד בסעיף 4 הוא של **staging**, שנבנה מאפס ממיגרציות הריפו. הוא **אינו** מעיד על production.
2. **שמות ה-policies ב-production עשויים להיות שונים** משמות הריפו ומ-staging. המיגרציה מוחקת רשימת שמות ידועה; **policy בשם שאינו ברשימה תשרוד**, ובפוסטגרס policies מתירניות **מתאחדות ב-OR** — כלומר ההקשחה תיכשל **בשקט, בלי שגיאה**.
3. לפני production יש להריץ ולהשוות:
```sql
select policyname, cmd, permissive, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'users'
order by cmd, policyname;
```
```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.provolatile, p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_commander','claim_own_profile','guard_users_sensitive_fields');
```
```sql
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.users'::regclass and not tgisinternal;
```
4. **backup / snapshot מלא לפני ההרצה.**
5. **אין למחוק נתונים.** המיגרציה עצמה אינה מוחקת דבר — רק policies וטריגר. אם מישהו מציע `delete`/`truncate` כחלק מהתהליך, זו סטייה מהתוכנית.
6. **אין rollback מאולתר.** אם משהו נכשל — לעצור, לצלם מצב, ולתכנן. הרצת SQL "לתקן מהר" על production היא הדרך המהירה ביותר להפוך תקלה לאירוע.

---

## 8. Stop rules

לעצור מיד, לא להמשיך לשלב הבא, ולדווח — אם מתרחש אחד מאלה:

- המיגרציה נכשלת או מסתיימת חלקית.
- policy ישנה שורדת אחרי ההרצה (מספר ה-policies אינו 5, או שם לא צפוי מופיע).
- ניסיון self-escalation **מצליח**.
- הרשמה תקינה נשברת.
- אישור מפקד (admin approval) נשבר.
- שגיאת DB גולמית מוצגת למשתמש קצה.
- קוד נפרס לפני שהמיגרציה הורצה באותה סביבה.
- `Confirm email` נמצא כבוי בסביבת היעד.

---

## 9. Ready for review criteria

PR #3 יכול לצאת מ-Draft ל-Ready for review לאחר עדכון המסמכים וגוף ה-PR, משום שכל התנאים הבאים התקיימו:

- [x] הרשמה רגילה עברה ב-staging (A).
- [x] ברירות המחדל pending תקינות (B).
- [x] self-escalation נחסם (C, D).
- [x] אישור מפקד עובד, ומשתמש רגיל נחסם מ-`/admin` (E).
- [x] profile claim עובד למייל מאומת (F).
- [x] ה-claim משמר את השדות הרגישים כמתועד (G).
- [x] זרימת conflict מציגה הודעה ידידותית (H).
- [x] `last_login_at` ממשיך להתעדכן (I).
- [x] אין שגיאות DB גולמיות בממשק (J).
- [x] **סדר הפריסה מסעיף 3 מתועד ב-PR body.**
- [x] לא נגעו ב-production, ולא נחשפו secrets.

Ready for review אינו אישור למיזוג או לפריסה.

---

## 10. Exact next action

לבצע final code/security review ל-PR #3 במצב Ready for review. אין למזג או לפרוס ל-production לפני אישור review מפורש, snapshot production טרי והרצת migration 016 לפני code deploy.
