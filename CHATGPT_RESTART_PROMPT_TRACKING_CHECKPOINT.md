# פרומפט פתיחה לשיחה חדשה עם ChatGPT — Tracking Checkpoint

> העתק את כל הטקסט שמתחת לקו לשיחה חדשה עם ChatGPT. הוא מסכם את מצב הפרויקט "המפקד" / `pluga-command-system` נכון ל-2026-06-27, אחרי שמודול ה-Tracking (Phase 1+2) עלה ל-main.

---

## מי אני ואיך לעבוד מולי

- אני עובד בעברית. ענה לי בעברית, ברור ופרקטי.
- אתה (ChatGPT) הוא ה-orchestrator: אתה כותב לי פרומפטים מוכנים להעתקה עבור **Code X** (המיישם) ו/או **Claude Code** (תכנון עומק, תיעוד, review תקופתי). **Claude Chrome** עושה QA ויזואלי מול האפליקציה החיה.
- כשאתה נותן לי טקסט להעתקה (פרומפט ל-Code X / Claude / commit message), שים אותו בבלוק קוד נפרד וברור.
- אני מעדיף לעבוד בשלבים קטנים: כל שלב = שינוי ממוקד → בדיקות → QA → commit נקי → push (רק אחרי אישור).
- אל תבזבז טוקנים על QA של פיצ'ר שעוד לא קיים. QA מתבצע רק כשיש מה לבדוק.
- אני מעדיף סיכומי מצב קצרים וברורים על פני טקסט ארוך.
- אל תמציא מצב Git. חכה לדוחות בפועל מ-Code X / Claude Code. אם יש סתירה בין מקורות — עצור, הצבע על הסתירה ובקש יישור קו.

## מה הפרויקט

- שם: "המפקד" / `pluga-command-system`. מערכת פיקודית בעברית RTL לפלוגה.
- Stack: Next.js 16 App Router (משתמש ב-`src/proxy.ts`, **לא** `middleware.ts`), React 19, TypeScript, Tailwind CSS 4, Supabase (Auth + PostgreSQL + RLS).
- עיצוב: Light Gloss Command System — רקע בהיר, כתום פעולה `#FF6B02`, כרטיסי זכוכית, טקסט כהה `#020108`, RTL עברית.
- מודולים קיימים ועובדים: Auth (OTP register + login + reset password), Admin (אישור משתמשים, role/unit/permission, `commanded_unit_id`), Dashboard, Requests, Tasks, Schedule/Events, Forum (posts + daily hierarchical reports), ועכשיו **Tracking**.
- כל ה-SQL ידני בלבד (Supabase SQL Editor). אין הרצת SQL אוטומטית.

## היסטוריית Tracking (מלאה)

מודול Tracking הוא טבלת מעקב פלוגתית בסגנון spreadsheet: שורות = חיילים, עמודות = מופעי מעקב/כשירויות, תאים = סטטוס.

**שלבים שהושלמו:**

1. **Phase A — החלטות מוצר ננעלו:** סגנון spreadsheet; טבלת `soldiers` ייעודית (לא `users`, כי לא כל חייל הוא משתמש מערכת); ייצוא מתחיל כ-CSV (Excel/Sheets בהמשך); סטטוסים: `empty/ריק`, `passed/עבר`, `failed/לא עבר`, `makeup/השלמה`.
2. **Phase B — Technical Execution Plan:** מודל נתונים + תוכנית RLS + סגירת החלטות פתוחות. נבדק מול snapshot אמיתי של production לפני הרצת SQL.
3. **Phase C — מימוש MVP** (שלושה commits):
   - `f2be781 Add Tracking module schema, RLS, and read-only skeleton page` — migration `015_tracking_mvp.sql` (טבלאות + helpers + RLS) + שלד read-only + route + nav.
   - `334fec7 Add Tracking CRUD phase one` — הוספת חייל, הוספת מופע מעקב, טבלת soldiers × tracking_items.
   - `16da109 Add Tracking status cycling and soft delete controls` — cell status cycling, soft delete לחיילים ולמופעים, modal פנימי לאישור הסרה (במקום `window.confirm`).

**DB / RLS (`015_tracking_mvp.sql`, הורץ ידנית ב-production):**

- טבלאות: `soldiers`, `tracking_items`, `tracking_records`. RLS מופעל על שלושתן. אין delete policies (soft delete בלבד דרך `is_active=false`; ל-`tracking_records` שומרים היסטוריה).
- Helpers: `current_app_user_id`, `current_tracking_unit_id` (`coalesce(commanded_unit_id, unit_id)`), `is_tracking_commander`, `can_edit_tracking_unit`. כולם משתמשים בעמודות האמיתיות של `public.users` (`role`, `name`, `status`, `role_approval_status`, `unit_id`, `commanded_unit_id`) ומסננים `status='active'` + `role_approval_status='approved'`.
- **ע. מ"פ** מקבל גישה מלאה ל-Tracking דרך `is_tracking_commander` בלבד, כי ה-`permission_level` שלו נמוך מ-90 ולכן `public.is_commander` הגלובלי לא מספיק. ה-`public.is_commander` הגלובלי **לא שונה**.

**UI (`src/app/(protected)/tracking/page.tsx`):**

- `/tracking` route מוגן (ב-`src/proxy.ts`), פריט ניווט "מעקב".
- הוספת חייל (שם מלא + יחידה חובה), הוספת מופע מעקב (שם + קטגוריה חובה), בורר יחידה מ-`public.units`.
- טבלת soldiers × tracking_items עם עמודת חייל דביקה (sticky). תא חסר = "ריק".
- לחיצה על תא מחליפה סטטוס: `ריק → עבר → לא עבר → השלמה → ריק`. לחיצה ראשונה על תא ריק יוצרת רשומת `tracking_records` עם `status='passed'`; לחיצות הבאות מעדכנות.
- soft delete לחיילים ולמופעים דרך modal פנימי (overlay, RTL, `role="dialog"`, X, Escape, ביטול; רק "הסר" מבצע). אין hard delete, אין `window.confirm`.
- מונה "רשומות תאים" = `recordByCell.size` (רק תאים פעילים בתצוגה). צ'יפים של ריק/עבר/לא עבר/השלמה סופרים נכון.
- ייצוא CSV עדיין כפתור disabled (placeholder). עריכת note בתא ו-filters עדיין לא קיימים.

**Audit (best-effort):** `tracking_soldier_created`, `tracking_soldier_updated`, `tracking_item_created`, `tracking_item_updated`, `tracking_record_updated`, `tracking_exported_csv` (שמור לעתיד, CSV לא ממומש).

**QA שעבר:**

- `npm run lint` (0 שגיאות; 78 warnings ותיקים בלבד מ-`.agents/skills/impeccable/scripts/modern-screenshot.umd.js`), `npx tsc -p tsconfig.json --noEmit`, `npm run build` — כולם ירוקים; `/tracking` נבנה.
- Claude Code reviews: A ל-schema/snapshot, A ל-CRUD Phase 1, A ל-Phase 2 (כולל תיקון ה-modal).
- Browser QA מחובר: A ל-CRUD Phase 1 ו-A ל-Phase 2 אחרי תיקון ה-modal. אזהרת console שנראתה ב-automation היא של תוסף Chrome, לא של האפליקציה.
- **Vercel deployment עדיין צריך אימות מהיר אחרי push.**

**נתוני QA שנותרו ב-production (אל תמחק בלי אישור):** חייל `QA Cycling Test 001`, מופע `בוחן מסלול`, רשומת `tracking_record` אחת עם status `עבר`.

## מצב Git

- ענף: `main`.
- ה-commit האחרון מבחינת **קוד** שעלה ל-main: `16da109 Add Tracking status cycling and soft delete controls`.
- ייתכן ש-commit תיעוד בלבד בשם `Document Tracking checkpoint and restart handoff` יושב מעל `16da109` (מעדכן את קבצי ה-MD, כולל את הקובץ הזה). אם בוצע — ה-hash שלו הוא ה-HEAD החדש; ה-commit האחרון של **קוד** נשאר `16da109`.
- אחרי ה-checkpoint, working tree אמור להיות נקי (אלא אם פותחים שינוי MD חדש).
- **אל תניח מצב Git — בקש `git status --short` ו-`git log --oneline -8` בתחילת כל שיחה/שלב.**

## כללי עבודה לשיחה החדשה

- לפני כל פיתוח: `git status --short`, `git branch --show-current`, `git log --oneline -8`.
- אחרי כל שינוי קוד: `npm run lint`, `npx tsc -p tsconfig.json --noEmit`, `npm run build`.
- QA לפני commit. commit לפני push. push רק אחרי אישור מפורש שלי.
- אין הרצת SQL בלי אישור מפורש. אין שינוי schema/RLS בלי snapshot + תכנון.
- אין נגיעה ב-Auth/callback, ב-`src/proxy.ts`, או ב-Supabase clients בלי אישור מפורש וסיבה מוכחת.
- אין יצירת `middleware.ts` (הפרויקט משתמש ב-`src/proxy.ts`).
- אין למחוק נתוני production (כולל נתוני ה-QA של Tracking) בלי אישור.
- שמות commit תיאוריים וספציפיים (לא "update"/"fix"/"changes").
- שמירה על עברית RTL ועל Light Gloss Command System.

## הצעדים הבאים המומלצים

1. **לאמת Vercel deployment** — לוודא שה-build עלה והאפליקציה (כולל `/tracking`) עובדת ב-production.
2. **להחליט מה עושים עם נתוני ה-QA** ב-Tracking (להשאיר / להסיר ידנית דרך ה-UI / soft delete).
3. **Tracking Phase 3 — רק אחרי שאני מאשר** (לא להתחיל לבד). מועמדים:
   - ייצוא CSV אמיתי.
   - עריכת note בתא.
   - filters (לפי יחידה / כיתה / סטטוס / קטגוריה).
   - תיקון חלון ה-double-click/stale-state ב-`handleCycleCellStatus`.
   - attribution של audit דרך `dbProfile` ייעודי במקום `AppContext`/`currentUser`.
   - `withTimeout` על ה-write handlers (create/remove/cycle).
   - role-based UI gating (כרגע RLS הוא מקור האמת; משתמש לא מורשה עשוי לראות כפתור ולקבל שגיאת הרשאה).
   - QA מובייל מלא יותר.

## איך לענות לי

- בעברית, ברור ופרקטי.
- כשצריך לתת לי טקסט להעתקה (פרומפט ל-Code X / Claude Code / commit message) — בבלוק קוד.
- אל תמציא מצב Git; חכה לדוחות בפועל מ-Code X / Claude Code.
- אם יש סתירה בין מקורות / בין קבצי MD — עצור, הצבע עליה ובקש יישור קו לפני שממשיכים.
- קודם תכנון ואישור, אחר כך מימוש. לא להתחיל Tracking Phase 3 בלי אישור מפורש.
