# סיכום פרויקט - Pluga Command System

## 1. סקירת פרויקט

הפרויקט הוא אפליקציית Web לניהול פיקוד ובקרה פלוגתית. המערכת מיועדת לרכז במקום אחד משימות, בקשות לוגיסטיקה, פורום/עדכונים, אישור משתמשים, עזרה ומסכי ניהול בסיסיים.

הבעיה שהמערכת באה לפתור היא פיזור מידע וניהול ידני של משימות, בקשות, פערים ואישורי גישה בתוך מסגרת פלוגתית. המטרה היא לתת למפקדים וסגל דרך אחידה לעבוד, לעקוב, לאשר ולראות תמונת מצב.

משתמשים עיקריים:
- מפקד פלוגה.
- סגן מפקד פלוגה.
- מפקדי מחלקות.
- סמלים ומפקדי כיתות.
- בעלי תפקידים פלוגתיים כמו לוגיסטיקה, רפואה, קשר ורכב.

זרימת מערכת מרכזית:
1. משתמש נכנס למסך login.
2. המשתמש מזין דוא"ל ומבקש magic link דרך Supabase Auth.
3. אחרי אימות, callback בודק או יוצר רשומה בטבלת `users`.
4. המשתמש מנותב לפי מצב onboarding ואישור תפקיד.
5. משתמשים מאושרים אמורים להיכנס למסכי dashboard ועמודי המערכת המוגנים.

## 2. החלטות מוצר עיקריות עד עכשיו

מטרת המערכת:
- מערכת פיקוד פלוגתית שמרכזת תהליכי ניהול, משימות, אישורים ותקשורת פנימית.

מסכי ליבה:
- Login.
- Onboarding.
- Pending approval.
- Select role.
- Dashboard.
- Tasks.
- Requests.
- Forum.
- Admin / approval users.
- Help.

ממשק:
- עברית מלאה.
- כיוון RTL ברמת `html dir="rtl"`.
- ממשק מיועד למפקדים, לכן השפה צריכה להיות תפעולית וברורה.

כיוון עיצוב:
- עיצוב glass cards.
- כפתורי gloss.
- צבעי הדגשה cyan/orange.
- היה מעבר לעיצוב בהיר כללי בגווני לבן עם טקסט שחור, אבל מסך login נשאר בעיצוב כהה navy לפי דרישה נקודתית.
- sidebar ימני בדסקטופ.

Authentication ואישור משתמשים:
- נבחר Supabase Auth עם magic link / OTP בדוא"ל.
- משתנה סביבה נדרש:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- לאחר התחברות צריך להיות פרופיל בטבלת `users`.
- משתמש חדש נוצר כ-`pending`, עם `role_approval_status = pending` ו-`has_completed_onboarding = false`.
- routes מוגנים מנוהלים דרך `src/proxy.ts` לפי Next.js 16.

זרימות מפקדים/משתמשים:
- קיים עמוד אישור משתמשים תחת `/admin`.
- קיימת זרימת onboarding/pending approval בסיסית.
- קיימת מערכת demo/localStorage ישנה בתוך `AppContext`, שעדיין חיה לצד Supabase ודורשת יישור ארכיטקטוני.

## 3. פיצ'רים שמומשו עד עכשיו

### Login עם Supabase magic link
- מה עושה: מאפשר הזנת דוא"ל ושליחת magic link דרך Supabase Auth.
- איפה מופיע: `/login`.
- סטטוס: חלקית עובד.
- הערות: העמוד נטען. חיבור Supabase Auth נבדק מול endpoint. שליחת magic link אמיתית דורשת בדיקה עם דוא"ל תקין והגדרת redirect URLs ב-Supabase.

### Auth callback
- מה עושה: מקבל `code`, מחליף אותו ל-session, בודק/יוצר פרופיל בטבלת `users`, מעדכן `last_login_at`, ומנתב לפי מצב המשתמש.
- איפה מופיע: `src/app/auth/callback/route.ts`.
- סטטוס: דורש בדיקה.
- הערות: הלוגיקה קיימת, אבל צריך לבדוק end-to-end אחרי login אמיתי.

### הגנת routes
- מה עושה: חוסם routes מוגנים למשתמש לא מחובר ומפנה ל-`/login`.
- איפה מופיע: `src/proxy.ts`.
- סטטוס: עובד בבדיקת HTTP מקומית.
- הערות: נבנה לפי Next.js 16 `proxy.ts`, לא `middleware.ts`.

### Dashboard
- מה עושה: מציג עמוד בקרה ראשי.
- איפה מופיע: `/dashboard`.
- סטטוס: דורש בדיקה.
- הערות: העמוד קיים ונבנה בהצלחה, אבל צריך בדיקת UI/נתונים מלאה.

### Tasks
- מה עושה: מסך ניהול משימות ובקרה.
- איפה מופיע: `/tasks`.
- סטטוס: דורש בדיקה.
- הערות: קיימים רכיבים ונתוני localStorage/seed, אך לא ברור שהכול מחובר ל-Supabase.

### Requests / Logistics
- מה עושה: ניהול בקשות לוגיסטיות.
- איפה מופיע: `/requests`.
- סטטוס: דורש בדיקה.
- הערות: קיים UI, חיבור למסד אמיתי דורש בדיקה/השלמה.

### Forum
- מה עושה: מסך פורום/עדכונים.
- איפה מופיע: `/forum`.
- סטטוס: דורש בדיקה.
- הערות: קיים רכיב `ForumTab`.

### Admin / אישור משתמשים
- מה עושה: מסך לאישור/דחיית משתמשים.
- איפה מופיע: `/admin`.
- סטטוס: חלקית עובד / דורש בדיקה.
- הערות: ה-UI קיים. צריך לוודא שהוא עובד מול טבלת `users` ולא רק מול state/demo.

### Supabase schema
- מה עושה: מגדיר טבלאות MVP ועתידיות.
- איפה מופיע: `supabase/migrations/001_mvp_schema.sql`.
- סטטוס: עובד לפי בדיקות קודמות שהראו שהטבלאות נוצרו ב-Supabase.
- הערות: RLS/policies דורשים בדיקה והקשחה.

## 4. עמודים/מסכים שנוצרו

### `/login`
- מטרה: כניסה באמצעות דוא"ל ו-magic link.
- רכיבים מרכזיים: `GlassCard`, `GlossyButton`, Supabase browser client.
- סטטוס: נטען ועובד חלקית.
- בעיות ידועות: magic link דורש בדיקת שליחה אמיתית והגדרות Supabase redirect.

### `/onboarding`
- מטרה: רישום/השלמת התחלה למשתמש.
- רכיבים מרכזיים: דורש בדיקה בקובץ העמוד.
- סטטוס: דורש בדיקה.
- בעיות ידועות: לא אומת end-to-end מול Supabase.

### `/pending-approval`
- מטרה: הצגת מצב המתנה לאישור תפקיד/משתמש.
- רכיבים מרכזיים: דורש בדיקה בקובץ העמוד.
- סטטוס: דורש בדיקה.
- בעיות ידועות: לא אומת מול נתוני `users` אמיתיים.

### `/select-role`
- מטרה: בחירת/הדמיית תפקידים.
- רכיבים מרכזיים: Role simulation/localStorage.
- סטטוס: דורש בדיקה.
- בעיות ידועות: קשור למנגנון demo ישן ולא בהכרח ל-Supabase.

### `/dashboard`
- מטרה: לוח בקרה ראשי.
- רכיבים מרכזיים: `DashboardTab`, layout מוגן, sidebar.
- סטטוס: דורש בדיקה.
- בעיות ידועות: צריך לוודא הרשאות ונתונים.

### `/tasks`
- מטרה: משימות ובקרה.
- רכיבים מרכזיים: `TasksTab`.
- סטטוס: דורש בדיקה.
- בעיות ידועות: ייתכן שמבוסס localStorage ולא Supabase.

### `/requests`
- מטרה: דרישות לוגיסטיקה.
- רכיבים מרכזיים: `LogisticsTab`.
- סטטוס: דורש בדיקה.
- בעיות ידועות: חיבור למסד אמיתי לא ברור.

### `/forum`
- מטרה: פורום/עדכונים.
- רכיבים מרכזיים: `ForumTab`.
- סטטוס: דורש בדיקה.
- בעיות ידועות: חיבור למסד אמיתי לא ברור.

### `/admin`
- מטרה: אישור משתמשים והרשאות.
- רכיבים מרכזיים: `AdminTab` או קוד page מקומי.
- סטטוס: חלקית עובד / דורש בדיקה.
- בעיות ידועות: צריך לוודא התאמה ל-Supabase `users`.

### `/help`
- מטרה: עזרה ומדריך.
- רכיבים מרכזיים: דורש בדיקה בקובץ העמוד.
- סטטוס: דורש בדיקה.
- בעיות ידועות: לא נבדק ידנית.

### `/auth/callback`
- מטרה: route handler להשלמת login.
- רכיבים מרכזיים: Supabase server client.
- סטטוס: דורש בדיקת end-to-end.
- בעיות ידועות: תלוי בהגדרות redirect ב-Supabase וב-schema פעיל.

## 5. שינויים טכניים מרכזיים

Layout:
- `src/app/layout.tsx` מגדיר HTML בעברית RTL ומטעין `Providers`.
- `src/app/(protected)/layout.tsx` מגדיר shell לעמודים מוגנים עם sidebar ימני ו-main content.
- נוסף CSS ייעודי לייצוב layout: `.protected-layout-shell` ו-`.protected-content-shell`.

Sidebar/navigation:
- `src/components/layout/AppSidebar.tsx` מציג sidebar קבוע מימין בדסקטופ.
- `src/components/layout/MobileHeader.tsx` מספק header/drawer במובייל.
- `src/data/navigation.ts` מגדיר את קישורי הניווט.

Authentication:
- Supabase browser client: `src/lib/supabase/browser.ts`.
- Supabase server client: `src/lib/supabase/server.ts`.
- קריאת env: `src/lib/supabase/env.ts`.
- callback: `src/app/auth/callback/route.ts`.
- route protection: `src/proxy.ts`.

User approval:
- טבלת `users` כוללת `role_approval_status`, `status`, `has_completed_onboarding`.
- UI לאישור משתמשים קיים ב-`/admin`.
- החיבור המלא בין UI האישור לבין Supabase דורש בדיקה.

Dashboard:
- עמודים מוגנים תחת `src/app/(protected)`.
- יש רכיבי tab רבים תחת `src/components`.

Styling/design system:
- Tailwind CSS 4.
- CSS גלובלי ב-`src/app/globals.css`.
- רכיבי UI מרכזיים: `GlassCard`, `GlossyButton`, `StatusBadge`, `EmptyState`.
- ספריית אייקונים: `lucide-react`.

Libraries/frameworks:
- Next.js 16.2.6 App Router.
- React 19.2.4.
- Supabase JS ו-Supabase SSR.
- Tailwind CSS 4.
- TypeScript.

## 6. באגים/בעיות שנתקלנו בהם

### Desktop layout alignment issue
- מה קרה: בדסקטופ התוכן זז ולא התיישר נכון מול sidebar ימני.
- סיבה סבירה: שימוש ב-RTL עם `pe-64` ו/או חישובי רוחב לא יציבים סביב sidebar fixed.
- האם תוקן: כן, בוצע תיקון layout.
- מה עדיין צריך לבדוק: בדיקה ויזואלית ב-1366, 1440, 1536 ו-1920 פיקסלים, כולל שאין horizontal scroll.

### Magic-link login failure
- מה קרה: login page נטען, אבל שליחת magic link נכשלה בבדיקות קודמות.
- סיבה סבירה: ייתכן דוא"ל בדיקה לא תקין, redirect URL חסר ב-Supabase, או הגדרת Auth לא מלאה.
- האם תוקן: חלקית. החיבור ל-Supabase Auth endpoint נבדק, אך שליחה אמיתית דורשת בדיקה.
- מה עדיין צריך לבדוק: שליחת magic link לדוא"ל אמיתי, callback, יצירת רשומת `users`, וניתוב אחרי login.

### Current app not loading at all
- מה קרה: דווח שהאפליקציה לא עולה וגם login לא מופיע.
- ממצא בפועל: `npm run build` עבר, `npm run dev` עלה, ו-`/login` החזיר `200 OK` בבדיקת HTTP.
- סיבה סבירה: לא נמצאה קריסת startup בקוד בזמן הבדיקה. כן נמצא שחסרה הגנת routes יציבה.
- האם תוקן: נוסף `src/proxy.ts` להגנת routes.
- מה עדיין צריך לבדוק: בדיקת דפדפן ידנית עם console/network בסביבה של המשתמש.

### Protected routes accessible without auth
- מה קרה: `/dashboard` ו-`/admin` נטענו גם ללא session.
- סיבה סבירה: לא היה `proxy.ts`/middleware להגנת routes.
- האם תוקן: כן, נוסף `src/proxy.ts`.
- מה עדיין צריך לבדוק: משתמש מחובר אמיתי עם session יכול להגיע ל-dashboard.

### ערבוב Supabase עם localStorage demo
- מה קרה: יש `AppContext` שמנהל משתמשים, משימות ונתונים דרך localStorage/seed data, לצד Supabase Auth ו-schema אמיתי.
- סיבה סבירה: מעבר הדרגתי מ-demo app לתשתית אמיתית.
- האם תוקן: לא.
- מה עדיין צריך לבדוק: החלטה האם להעביר את כל ה-state ל-Supabase או להשאיר demo mode מבודד.

### טקסט עברי מוצג לעיתים כ-mojibake בכלי terminal
- מה קרה: חלק מהקבצים מוצגים בטרמינל עם תווים משובשים.
- סיבה סבירה: encoding/console rendering ב-Windows.
- האם תוקן: לא.
- מה עדיין צריך לבדוק: שהקבצים עצמם נשמרים UTF-8 ושהדפדפן מציג עברית תקינה.

## 7. ארכיטקטורה נוכחית

מבנה תיקיות מרכזי:
- `src/app` - App Router routes, layouts, pages ו-route handlers.
- `src/app/(auth)` - מסכי login/onboarding/pending/select-role.
- `src/app/(protected)` - עמודים מוגנים עם sidebar/layout משותף.
- `src/app/auth/callback` - callback של Supabase Auth.
- `src/components` - רכיבי UI, layout, dashboard, tasks, forum, admin ועוד.
- `src/lib` - context, permissions, Supabase helpers, types.
- `src/data` - נתוני navigation.
- `supabase/migrations` - SQL schema.

קבצי כניסה מרכזיים:
- `src/app/layout.tsx` - root layout.
- `src/app/page.tsx` - redirect ל-`/login`.
- `src/app/providers.tsx` - עטיפת `AppProvider`.
- `src/proxy.ts` - הגנת routes לפי Supabase session.

קבצי layout:
- `src/app/layout.tsx`.
- `src/app/(protected)/layout.tsx`.
- `src/components/layout/AppSidebar.tsx`.
- `src/components/layout/MobileHeader.tsx`.

קבצי auth:
- `src/app/(auth)/login/page.tsx`.
- `src/app/auth/callback/route.ts`.
- `src/lib/supabase/browser.ts`.
- `src/lib/supabase/server.ts`.
- `src/lib/supabase/env.ts`.

קבצי UI עיקריים:
- `src/components/ui/GlassCard.tsx`.
- `src/components/ui/GlossyButton.tsx`.
- `src/components/ui/StatusBadge.tsx`.
- `src/components/ui/EmptyState.tsx`.

Database/Auth provider:
- Supabase משמש ל-Auth ול-schema PostgreSQL.
- קיימת migration מקומית ל-MVP schema.
- עדיין יש state מקומי ב-localStorage ב-`AppContext`.

## 8. מה חסר כרגע

- Login/auth flow יציב ומאומת end-to-end.
- בדיקת magic link אמיתית עם דוא"ל ו-callback.
- ניהול משתמשים מאושרים מול Supabase בפועל.
- חיבור מלא של dashboard/tasks/requests/forum למסד נתונים אמיתי.
- הודעות שגיאה טובות יותר במסך login לפי query params.
- loading states, empty states ו-error states עקביים בכל העמודים.
- בדיקת responsive מלאה לדסקטופ, טאבלט ומובייל.
- בדיקת permissions/user roles מלאה.
- בדיקת RLS ו-policies ב-Supabase.
- תיעוד env vars.
- deployment production.
- QA checklist מסודר לפני העלאה.
- החלטה לגבי localStorage demo מול Supabase production.
- בדיקת encoding עברית בקבצים ובדפדפן.

## 9. צעדים מומלצים להמשך

### Step 1: Stabilize app loading
- להריץ `npm install` אם צריך.
- להריץ `npm run dev`.
- לפתוח `/login`, `/dashboard`, `/admin`.
- לבדוק console/network בדפדפן.

### Step 2: Stabilize authentication
- לוודא redirect URLs ב-Supabase.
- לשלוח magic link לדוא"ל אמיתי.
- לבדוק callback.
- לוודא שנוצרת רשומת `users`.

### Step 3: Verify approved-user logic
- ליצור משתמש pending.
- לאשר אותו דרך Supabase או admin UI.
- לוודא ניתוב ל-`/onboarding`, `/pending-approval`, או `/dashboard` לפי מצב.

### Step 4: Fix layout/responsiveness
- לבדוק דסקטופ ב-1366, 1440, 1536, 1920.
- לבדוק שאין horizontal scroll.
- לבדוק mobile drawer.

### Step 5: Test all main pages
- Dashboard.
- Tasks.
- Requests.
- Forum.
- Admin.
- Help.
- Onboarding.

### Step 6: Prepare deployment
- להגדיר env vars בסביבת production.
- להגדיר Supabase redirect URLs ל-production.
- לבדוק build production.

### Step 7: Add documentation
- README מעודכן.
- תיעוד env.
- תיעוד Supabase setup.
- QA checklist.
- הסבר roles/permissions.

## 10. הערות למפתחים

- יש להיזהר משינויים ב-`src/app/globals.css`, כי הוא כולל overrides גלובליים שמשפיעים על הרבה רכיבים.
- יש להיזהר משינויים ב-`src/app/(protected)/layout.tsx`, כי זה משפיע על כל העמודים המוגנים.
- `src/proxy.ts` הוא קריטי לאבטחת routes מוגנים ב-Next.js 16.
- `src/lib/context/AppContext.tsx` עדיין מכיל הרבה לוגיקה מבוססת localStorage. שינוי בו עלול להשפיע על dashboard, tasks, requests, forum ו-admin.
- `src/app/auth/callback/route.ts` תלוי ישירות ב-schema של טבלת `users`.
- לפני שינוי schema, צריך לוודא התאמה לקוד callback ולמסכי admin/onboarding.
- הנחת עבודה: Supabase schema כבר הורץ בסביבת Supabase של הפרויקט. אם לא, יש להריץ את migration ידנית דרך SQL Editor או CLI.
- הנחת עבודה: `.env.local` קיים מקומית, אבל אינו אמור להיכנס ל-Git.
- דורש בדיקה: האם כל הטקסטים בעברית נשמרים ומוצגים כ-UTF-8 תקין בכל הסביבות.
- דורש בדיקה: האם admin UI עובד מול Supabase או רק מול localStorage/demo data.
