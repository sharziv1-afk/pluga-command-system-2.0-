# Multi-Company Schema / RLS / RPC Draft

**Product:** `pluga-command-system` / "המפקד"  
**Batch:** 4C  
**Status:** Draft only - not approved for implementation  
**Purpose:** תכנון מעבר עתידי ממערכת פלוגה יחידה למערכת Multi-Company עם הזמנות משתמשים על ידי מ״פ.

## 1. Scope and execution guardrails

מסמך זה הוא תכנון בלבד.

- אין להריץ את התוכן כ-SQL.
- אין ליצור או להריץ migration.
- אין לבצע שינוי DB, RLS או Auth.
- אין לשנות קוד ב-`src`.
- אין ליצור פלוגה שנייה לפני RLS hardening ו-leak QA.
- אין commit, push או `git add`.
- כל implementation דורש batch ואישור מפורשים ונפרדים.

## 2. Locked product decisions

- tenant הוא פלוגה.
- משתמש יכול להשתייך לפלוגה אחת בלבד.
- `users.company_id` יחיד; אין `company_members` בשלב 1.
- מ״פ מזמין משתמש לפי email, role ו-unit.
- מ״פ אינו יוצר סיסמה עבור משתמש.
- הזמנה תואמת למייל מאומת משמשת pre-approval.
- אין invite link או token בשלב 1.
- אין company switcher או super admin בשלב 1.
- משתמש ללא הזמנה אינו מקבל company, role או unit.
- פתיחת פלוגה מוגבלת בתחילה באמצעות allowlist/feature flag.
- אין פלוגה שנייה לפני company-scoped RLS ו-leak QA.

## 3. Schema draft

### 3.1 `companies`

Tenant root חדש.

שדות מוצעים:

- `id uuid` - primary key.
- `name text` - חובה.
- `slug text` - optional; אינו נדרש כרגע לפונקציונליות Phase 1.
- `created_by uuid` - FK ל-`users.id`.
- `status text` - `active | suspended | archived`.
- `metadata jsonb`.
- `created_at timestamptz`.
- `updated_at timestamptz`.

החלטות:

- `created_by` נשאר nullable לצורך bootstrap/backfill.
- אם `slug` ייכלל, הוא יהיה nullable עם unique index על `lower(slug)`.
- אין להוסיף שימוש ב-slug עד שקיים צורך במוצר או ב-URL ציבורי.
- אין hard delete של פלוגה בתכנון Phase 1.

### 3.2 `company_invitations`

שדות מוצעים:

- `id uuid` - primary key.
- `company_id uuid` - tenant, חובה.
- `email text` - חובה, normalized באמצעות `lower(btrim(email))`.
- `full_name text` - optional.
- `role text` - חובה.
- `unit_id uuid` - optional לפי role.
- `commanded_unit_id uuid` - optional.
- `permission_level integer`.
- `invited_by uuid`.
- `status text`.
- `expires_at timestamptz`.
- `accepted_at timestamptz`.
- `accepted_user_id uuid`.
- `revoked_at timestamptz`.
- `metadata jsonb`.
- `created_at timestamptz`.
- `updated_at timestamptz`.

Statuses:

- `invited`
- `accepted`
- `expired`
- `revoked`

Constraints:

- expiry ברירת מחדל: 14 יום ממועד ההזמנה.
- אין token fields ואין invite link בשלב 1.
- partial unique בתוך פלוגה: `(company_id, lower(email)) where status = 'invited'`.
- `unit_id` ו-`commanded_unit_id` חייבים להשתייך לאותה פלוגה.
- הזמנה שפגה אינה מתקבלת גם אם status טרם עודכן ל-`expired`.

### 3.3 Global active invitation decision

במודל email-match only אין token, invite link או company selector. לכן שתי הזמנות פעילות לאותו מייל בשתי פלוגות יוצרות קבלה עמומה.

החלטה טכנית מומלצת:

`unique active invitation globally per lower(email)`.

יצירת הזמנה פעילה שנייה לאותו normalized email תיחסם ותוחזר למ״פ כתוצאת conflict כללית, ללא חשיפת פרטי הפלוגה האחרת.

אם בעתיד יתווספו invite link, token או company selector, ניתן יהיה להסיר מגבלה זו בבאצ׳ נפרד לאחר תכנון אבטחה ו-migration ייעודי.

### 3.4 `users.company_id`

- `users.company_id` הוא FK ל-`companies.id`.
- השדה נשאר nullable גם לאחר backfill.
- `null` מייצג משתמש שממתין להזמנה או טרם פתח פלוגה מאושרת.
- משתמש ללא הזמנה אינו מקבל company, role או unit.
- אין לחזור למסלול self-select role הישן.
- משתמש אינו רשאי לשנות בעצמו company, role, unit או status מהלקוח.

### 3.5 Scoped tables

`company_id` יתווסף לטבלאות הבאות:

- `users`
- `units`
- `tasks`
- `requests`
- `events`
- `comments`
- `approvals`
- `forum_posts`
- `forum_daily_reports`
- `soldiers`
- `tracking_items`
- `tracking_records`
- `audit_logs`
- `onboarding_progress`

גם `forum_daily_summaries` מ-migration 009 חייבת להיכלל בבדיקה. למרות שהיא legacy/prototype, כל עוד היא קיימת יש לבחור אחת מהאפשרויות:

1. להוסיף לה `company_id` ו-company-scoped RLS.
2. לחסום את הגישה אליה במפורש ולתכנן retirement נפרד.

אין להשאיר אותה עם policy גלובלי של active/approved users.

### 3.6 Global tables

- `roles` נשארת global reference data.
- `feature_flags` נשארת global configuration.
- abuse control ראשוני יכול להשתמש ב-feature flag מסוג default-deny וברשימת approved emails בתוך `rollout_rules`.
- אין צורך בטבלת allowlist חדשה עד שהיקף השימוש מצדיק אותה.

### 3.7 Indexes and relational constraints

- החלפת unique גלובלי של `units.code` ב-`(company_id, code)`.
- הוספת indexes על `company_id` בכל טבלה scoped.
- indexes משולבים לפי query paths, לדוגמה `(company_id, status)`.
- ייחודיות מספר אישי ב-Tracking הופכת לפלוגתית: `(company_id, lower(btrim(personal_number)))`.
- composite FKs ימנעו קשרים בין rows מפלוגות שונות.
- parent unit חייב להשתייך לאותה פלוגה.
- task/request ו-event מקושר חייבים להשתייך לאותה פלוגה.
- forum parent report חייב להשתייך לאותה פלוגה.
- tracking record, soldier ו-tracking item חייבים להשתייך לאותה פלוגה.
- `users.email` נשאר unique גלובלי בהתאם ל-one company per user.

## 4. Naming boundary

`forum_daily_reports.company_unit_id` הוא שדה היררכיית דיווח פנימית:

`squad -> platoon -> company -> staff`.

הוא אינו tenant ואינו תחליף ל-`company_id`.

ה-tenant החדש הוא:

`forum_daily_reports.company_id`.

אין לשנות את שם `company_unit_id` ב-Batch 4C. rename עתידי, אם יאושר, יבוצע בבאצ׳ נפרד.

## 5. RLS helper draft

### 5.1 Existing helper

`current_app_user_id()` כבר קיים ב-migration 015. יש למחזר את הפונקציה והסמנטיקה שלה ולא ליצור helper מתחרה.

### 5.2 Proposed helpers

- `current_company_id()`
- `is_member_of_company(target_company_id uuid)`
- `is_commander_of(target_company_id uuid)`
- `can_manage_company_users(target_company_id uuid)`

התנהגות מוצעת:

- `current_company_id()` מחזיר company רק למשתמש active+approved.
- `is_member_of_company()` דורש התאמה ל-`current_company_id()`.
- `is_commander_of()` דורש משתמש active+approved, פלוגה תואמת ותפקיד/permission מאושר של מפקד.
- `can_manage_company_users()` נשען בשלב 1 על `is_commander_of()`.
- אין bypass של super admin.

הפונקציות מיועדות להיות:

- `STABLE`
- `SECURITY DEFINER`
- עם `search_path = public`
- זמינות ל-authenticated בלבד
- ללא קבלת `auth_id` נשלט מהלקוח כאשר ניתן להשתמש ב-`auth.uid()`

### 5.3 Unsafe global helpers

כל שימוש ב-`is_commander(auth.uid())` גלובלי מסוכן ב-multi-company, מפני שהוא בודק תפקיד/permission ללא tenant.

גם `is_tracking_commander()`, `current_tracking_unit_id()`, `can_edit_tracking_unit()` ו-client-side `canSeeAll` דורשים סקירת company scope לפני הכנסת פלוגה שנייה.

## 6. RLS policy strategy

כל policy בטבלה scoped מתחילה בתנאי tenant:

`row.company_id = current_company_id()`.

כל `INSERT` דורש:

`new.company_id = current_company_id()`.

עדכון אינו רשאי לשנות `company_id`.

אסטרטגיה לפי entity:

- `companies`: member קורא את פלוגתו; create רק דרך RPC; commander מעדכן רק את פלוגתו.
- `users`: משתמש קורא את עצמו; commander מנהל משתמשים רק בפלוגתו; provisioning ושינוי role/unit דרך RPC.
- `units`: קריאה וניהול רק בתוך הפלוגה.
- `tasks`, `requests`, `events`: tenant scope ובתוכו כללי creator/assigned/unit/commander הקיימים.
- `comments`, `approvals`: tenant scope וגם אימות שה-entity הפולימורפי שייך לאותה פלוגה.
- `forum_posts`: חברי הפלוגה קוראים; creator עורך את שלו; commander עורך רק בתוך פלוגתו.
- `forum_daily_reports`: owner/commander בתוך הפלוגה. מ״מ יקבל platoon scope רק לאחר hierarchy mapping מאומת.
- `soldiers`: visibility לפי יחידה בתוך הפלוגה.
- `tracking_items`: definitions פלוגתיים; commander מנהל.
- `tracking_records`: הרשאות נגזרות מ-soldier ובתוך אותה פלוגה.
- `audit_logs`: משתמש קורא את שלו; commander קורא את פלוגתו.
- `company_invitations`: commander יוצר, קורא ומבטל בפלוגתו; acceptance רק דרך RPC.
- `onboarding_progress`: משתמש ללא פלוגה רשאי לקרוא רק את רשומת ההמתנה שלו עם `company_id = null`.

UI gating אינו תחליף ל-RLS.

## 7. RPC drafts

כל ה-RPCs בסעיף זה הם draft בלבד ואינם מאושרים ליישום.

### 7.1 `create_company(...)`

- דורש משתמש authenticated ומייל מאומת.
- דורש שלמשתמש אין company קיים.
- בודק allowlist/feature flag/approved email.
- נועל את שורת המשתמש למניעת יצירה מקבילה.
- יוצר company.
- יוצר default units לפי seed המאושר.
- משייך את היוצר כמ״פ active+approved.
- אינו משתמש ב-service role מהלקוח.
- מנסה לכתוב audit בהתאם למדיניות audit שתאושר.

### 7.2 `accept_invitation()`

- קורא `auth.uid()` ואת המייל המאומת ממקור trusted.
- מנרמל את המייל באמצעות `lower(btrim(email))`.
- נועל את שורת המשתמש ואת ההזמנה.
- מחפש הזמנה פעילה, לא revoked ולא expired.
- חוסם משתמש שכבר שייך לפלוגה אחרת.
- מעתיק company, role, unit, commanded unit ו-permission מההזמנה.
- מסמן את המשתמש active+approved.
- מסמן את ההזמנה accepted.
- ללא הזמנה תואמת המשתמש נשאר ללא company ומוצג לו waiting screen.
- אין client-controlled role/company/status.

### 7.3 `revoke_invitation(invitation_id)`

- רק commander של אותה פלוגה.
- מבטל רק הזמנה פתוחה.
- מסמן status כ-`revoked` ומעדכן `revoked_at`.
- אינו מוחק היסטוריה.

### 7.4 `resend_invitation(invitation_id)`

- אין שליחת מייל אמיתית בשלב 1.
- אין יצירת token.
- להזמנה פתוחה ניתן לחדש `expires_at` ל-14 יום.
- להזמנה expired/revoked נוצרת הזמנה חדשה, כדי לשמור היסטוריה.
- הזמנה accepted אינה ניתנת לחידוש.

### 7.5 `change_user_role_unit(...)`

- רק commander של אותה פלוגה.
- target user חייב להשתייך לאותה פלוגה.
- role/unit/commanded unit חייבים להיות תקפים באותה פלוגה.
- אין שינוי `company_id`.
- אין העברת משתמש בין פלוגות.
- יש לחסום self-demotion והסרת המפקד האחרון ללא transfer flow.
- כל שינוי חייב לייצר ניסיון audit.

## 8. Backfill and migration outline

שלבים עתידיים בלבד:

1. ליצור `companies`.
2. ליצור default company אחת עבור כל הנתונים הקיימים.
3. לאפשר `created_by = null` בזמן bootstrap.
4. להוסיף `company_id` nullable לכל הטבלאות scoped.
5. לבצע backfill ל-units ול-users.
6. לבצע backfill לשאר הטבלאות.
7. לאמת שאין nulls לא צפויים, orphan rows או קשרים חוצי tenant.
8. להוסיף indexes, unique constraints ו-composite FKs.
9. להגדיר `NOT NULL` רק לאחר validation.
10. לא להגדיר `NOT NULL` על `users.company_id`.
11. לפרוס RLS helpers ו-policies בשלבים.
12. להחליף global commander checks ו-`canSeeAll`.
13. לבצע regression QA של הפלוגה הקיימת.
14. לבצע leak QA ב-staging מבודד.
15. לא להכניס פלוגה שנייה לייצור לפני מעבר מלא של leak QA.

אין default אוטומטי של `company_id` ברמת schema, מפני שהוא עלול להסתיר insert לא משויך או לשייך נתון ל-tenant שגוי.

## 9. Leak QA matrix

הבדיקות יבוצעו ב-staging עם:

- פלוגה A: מ״פ A, מ״מ A ומשתמש A.
- פלוגה B: מ״פ B, מ״מ B ומשתמש B.

בדיקות חובה:

- מ״פ A אינו קורא נתוני B.
- מ״פ A אינו יוצר, משנה או מוחק נתוני B.
- מ״מ A אינו קורא או משנה נתוני B.
- dashboard של A אינו כולל counts או activity של B.
- tasks, requests ו-events של A מבודדים מ-B.
- forum posts ודוחות יומיים של A מבודדים מ-B.
- publish/close forum של A אינו סוגר דוחות B באותו תאריך.
- Tracking של A אינו מחזיר soldiers/items/records של B.
- audit logs של B אינם מוצגים למ״פ A.
- invitation של A אינה מתקבלת או מנוהלת על ידי B.
- expired invitation נחסמת.
- revoked invitation נחסמת.
- invitation conflict למשתמש שכבר שייך לפלוגה נחסם.
- שתי הזמנות פעילות לאותו normalized email נחסמות.
- role/unit changes אינם חוצים פלוגות.
- ניסיון לשלוח `company_id` זר או `null` מהלקוח נחסם.
- direct table writes אינם עוקפים את RPCs.
- הבדיקות חוזרות לאחר refresh, logout/login והחלפת משתמשים.

## 10. Risks and prerequisites

### Critical prerequisites

- BUG-AUTH-008: logout ב-AppSidebar אינו קורא `signOut()`.
- BUG-CONTEXT-009: AppContext עלול לטעון demo commander לאחר כשל profile.
- `canSeeAll` ו-`is_commander()` עדיין גלובליים.
- אין להכניס פלוגה שנייה לפני תיקון נקודות אלו ו-RLS hardening.

### Module risks

- BUG-FORUM-010: `publishAndCloseForum` מסנן bulk close רק לפי `report_date`; בעתיד חייב גם `company_id`.
- `forum_daily_summaries` היא legacy עם policy רחב מדי.
- BUG-TRACK-003: Tracking UI מציג פעולות שחלקן נחסמות על ידי RLS.
- Tracking helpers הנוכחיים אינם company-scoped.
- BUG-REQ-008: Requests specialist/status UI אינו מיושר עם RLS.
- `company_unit_id` עלול להתפרש בטעות כ-tenant.

### Audit risk

החלטת המוצר דורשת audit לכל שינוי role/unit. מדיניות הפרויקט הקיימת מגדירה audit כ-best-effort ולא blocking.

Batch 4C אינו משנה מדיניות זו. לפני Batch 4F יש להחליט כיצד לספק trace אמין לשינויים רגישים בלי להפוך כשל audit לכשל בפעולת המוצר.

## 11. Deferred work

- אין invite link או token.
- אין company selector.
- אין company switcher.
- אין super admin.
- אין rename של `company_unit_id`.
- אין מעבר משתמש בין פלוגות.
- אין hierarchy RLS חדש ללא mapping מאומת.
- אין cleanup של legacy tables בתוך Batch 4C.

כל אחד מהנושאים האלו דורש batch נפרד ואישור מפורש.

## 12. Review checklist

- [ ] כל טבלה scoped נמצאת במפת `company_id`.
- [ ] `users.company_id` נשאר nullable.
- [ ] משתמש ללא הזמנה אינו מקבל role/unit/company.
- [ ] units והקשרים הפנימיים אינם חוצים פלוגות.
- [ ] invitations הן email-match only וללא token.
- [ ] קיימת מגבלת active invitation גלובלית לפי normalized email.
- [ ] כל commander policy כולל company scope.
- [ ] אין שימוש security-sensitive ב-client-side `canSeeAll`.
- [ ] Forum bulk close כולל tenant scope.
- [ ] Tracking ו-Requests mismatches מטופלים לפני multi-company QA.
- [ ] logout ו-demo fallback מטופלים לפני פלוגה שנייה.
- [ ] leak QA עבר במלואו לפני שינוי production.

## 13. Approval boundary

מסמך זה אינו migration ואינו implementation.

אישור למסמך אינו מהווה אישור:

- ליצור SQL migration.
- להריץ SQL.
- לשנות RLS.
- לשנות Auth.
- לשנות application code.
- ליצור פלוגה שנייה.

כל פעולה כזו דורשת אישור נפרד ומפורש.
