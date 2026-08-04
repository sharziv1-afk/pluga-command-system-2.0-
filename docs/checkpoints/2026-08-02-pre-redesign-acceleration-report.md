# Pre-Redesign Acceleration Checkpoint — 2026-08-02

## 1. מטרת המסמך והחלטת הסקופ

מסמך זה הוא נקודת ההמשך היחידה לתוכנית ה־Nightly Pre-Redesign Acceleration. העבודה בוצעה בענף מבודד שנוצר ישירות מ־`main`, בלי לשלב את PR #3 או PR #5. נבחרו רק שלושה batches קטנים, עצמאיים וללא תלות ב־Supabase:

1. CI לקריאות Pull Request בלבד, ללא repository/environment secrets וללא deployment.
2. נעילת quick-create ב־Dashboard שמשתחררת גם ב־exception ומונעת submit כפול.
3. הסרת בקשת Auth כפולה מטעינת Tracking.

לא בוצעו redesign, שינוי dependency, SQL, migration, שינוי RLS/Auth, שינוי נתונים, merge או deployment.

## 2. מצב Git

| פריט | מצב מאומת |
| --- | --- |
| `main` בתחילת העבודה | `adc54530b4f7ff6c06edea3409ec687b42fa4aaf` |
| `origin/main` בתחילת העבודה | `adc54530b4f7ff6c06edea3409ec687b42fa4aaf` |
| בסיס הענף החדש | `adc54530b4f7ff6c06edea3409ec687b42fa4aaf` |
| ענף העבודה | `chore/pre-redesign-quality-foundation` |
| HEAD קוד לפני commit התיעוד | `9c6dd990a36180e1cc380c9d853e13b25f821d78` |
| PR #5 branch | `fix/forum-daily-draft-protection` |
| PR #5 HEAD | `190f0602afc1ddf7e076ed1e4f1cb109899d1a1d` |
| PR #3 HEAD ידוע | `03d36ee9cd79016741f85f96aa4c533a0931ef82` |
| בידוד | worktree נפרד תחת `.ai-workspace/runs/quality-foundation-worktree` |

Commits של היישום:

- `0d21955 Add non-deploying pull request validation`
- `fc36d2c Make Dashboard quick-create locks exception-safe`
- `243b80b Remove redundant Tracking auth request`
- `9c6dd99 Harden CI pins and Dashboard retry guidance`

ה־checkout המקורי נשאר על ענף PR #5, נקי ומסונכרן. לא בוצעו reset, rebase, force-push או שינוי ב־`main`.

## 3. מפת מערכת

### נתיב Auth → Profile → Protected Page

1. `src/proxy.ts` מגן על routes תפעוליים באמצעות `supabase.auth.getUser()` ומפנה ל־`/login?next=...` כשאין user.
2. ה־protected layout מרנדר בתוך `AppProvider`.
3. `AppProvider` טוען profile יחיד דרך `fetchCurrentProfile`, מסווג `authStatus`, מגן מפני תוצאה ישנה באמצעות version ומגביל טעינה ל־15 שניות.
4. `refreshProfile` שומר את ה־protected tree כשהמצב כבר ready; דפי התוכן מגיבים רק ל־profile מאומת.
5. כל עמוד טוען את נתוני התחום שלו ישירות דרך Supabase browser client. אין data cache גלובלי.

### נתיבי קריאה, כתיבה ו־audit

- קריאה: Page effect/callback → Supabase query → מיפוי state מקומי → loading/error UI.
- כתיבה: handler מקומי → בדיקת הרשאה/UI → Supabase mutation → `void createAuditLog(...)` best-effort → רענון נתוני העמוד.
- גבול אבטחה: כל בדיקת הרשאה בצד הלקוח היא UX בלבד; RLS וה־grants ב־Supabase הם גבול ההרשאה האמיתי.
- יחידות ובעלות: העמודים מסננים לפי profile, owner ו־unit; `users.unit_id` ו־`users.commanded_unit_id` נטענים בלי embedded `units(...)`.
- שגיאות: AppContext מטפל ב־auth/profile timeout וב־stale result; דפי התחום מנהלים loading/error מקומיים. אין מנגנון cancellation אחיד לכל שאילתות העמודים.

### מודולים עיקריים

| אזור | אחריות |
| --- | --- |
| `src/proxy.ts` | session guard ל־routes מוגנים |
| `src/lib/context/AppContext.tsx` | profile, auth status ו־refreshProfile |
| `src/lib/permissions.ts` | normalizeRole, רמות הרשאה וכללי UI |
| Dashboard | snapshot תפעולי ו־quick-create |
| Requests / Tasks / Schedule | נתוני תחום, linked data ומוטציות מקומיות |
| Forum | posts ו־Forum Daily; PR #5 מטפל בנפרד בהגנת טיוטות |
| Tracking | soldiers × items × records עם RLS קיים |
| Admin / Onboarding | lifecycle של profile ואישור משתמש |
| `src/lib/audit.ts` | audit best-effort; אינו רשאי לחסום פעולה עסקית |

## 4. מטריצת תפקידים כפי שהיא בקוד

| תפקיד מנורמל | רמת הרשאה מחושבת |
| --- | ---: |
| מ״פ | 100 |
| סמ״פ | 90 |
| ע. מ״פ | 85 |
| רס״פ / לוגיסטיקה או רס״פ | 75 |
| מ״מ* | 70 |
| חובש פלוגתי | 70 |
| קשר פלוגתי | 70 |
| ב.קוד / נהג | 60 |
| סמל* | 60 |
| מ״כ* | 50 |
| כל ערך אחר | 0 |

`hasAdminAccess` נותן UI admin רק למ״פ ולסמ״פ לאחר normalization. `hasCompanyWideUiAccess` כולל רמה שמורה או מחושבת של 90 ומעלה וגם תפקידים שמכילים מ״פ/סמ״פ. אלה כללי תצוגה בלבד; אין להסיק מהם הרשאת DB.

## 5. System X-Ray — סוכנים ומסקנות

| Agent | תחום | ממצאים מרכזיים | החלטה |
| --- | --- | --- | --- |
| A | Architecture/Data flow | AppProvider מרכז profile אך דפי התחום טוענים ישירות; פערי onboarding/admin ותלות בלוגיקה בתוך components | תועד; לא לערבב עם PR #3 או redesign |
| B | Performance/Network | Tracking ביצע Auth נוסף לפני 4 קריאות מקבילות; waterfalls ושאילתות רחבות קיימים גם בדפים אחרים | Tracking תוקן; היתר backlog |
| C | Async reliability | quick-create ב־Dashboard היה עלול להישאר loading לאחר exception; נמצאו locks/races נוספים מחוץ לסקופ | Dashboard תוקן; היתר backlog |
| D | Security boundary | UI אינו גבול הרשאה; audit client-side אינו הוכחת actor; נמצאו Advisor warnings חיים | אין DB write; הועבר ל־Supabase reconciliation |
| E | Testing/CI | לא היה workflow; `npm test` הריץ קובץ יחיד; חלק מהבדיקות source-shape | נוסף CI וגילוי tests; נוספו behavioral tests |
| F | UX/RTL/a11y | dialog/focus/accessible-name/aria-live ו־contrast דורשים טיפול; אין regression חזותי במשטח הציבורי שנבדק | backlog ל־Pre-Marvie; ללא redesign כעת |
| G | Hygiene/dependencies | אין deploy coupling; Next 16.2.6 נמצא בטווחי advisories רשמיים רלוונטיים; git objects מקומיים גדולים | dependency הוא חסם release נפרד; לא בוצע upgrade/GC |

Reviewer ממוקד של batch ה־Dashboard העלה תחילה שני ממצאי P2: ניסוח transport שעלול לעודד retry כפול, ובדיקה שלא בחנה את lifecycle המשותף. הניסוח שונה להודעה אמביוולנטית והבדיקות מפעילות את ה־helper האמיתי. verification review הסתיים ללא finding פתוח.

| Reviewer | תחום | תוצאה |
| --- | --- | --- |
| Final 1 | Architecture/Regression | לא נמצא finding מעשי או blocker ב־diff של הקוד |
| Final 2 | Security/Deployment | נמצאו pinning של Actions וניסוח “ללא secrets”; שני הממצאים אומתו ותוקנו |
| Final 3 | Tests/Maintainability | נמצא שמוטציית POST יכולה להחזיר fetch failure כ־`error` עם `status: 0`, וכן indentation לא ברור; שניהם תוקנו |
| Verification | תיקוני reviewers בלבד | 5/5 focused tests; כל findings סומנו resolved וללא blocker חדש |

מספר ערוצי reviewer ראשוניים נותקו ברמת תשתית ולא נספרו כתוצאת review. שלוש התוצאות המופיעות לעיל הן הביקורות שהושלמו בפועל.

## 6. Findings מאומתים ומדורגים

| ID | Severity | תחום | ממצא והוכחה | החלטה |
| --- | --- | --- | --- | --- |
| F-01 | P1 | Dependencies | `next@16.2.6` נמצא בטווח גרסאות שפורסם עבור advisories של Next.js. exploitability של כל advisory תלויה בתצורה ולא הוכחה במלואה בפרויקט | חסם release: upgrade ממוקד ובדיקת regression במשימה נפרדת; נאסר upgrade כאן |
| F-02 | P1 | Supabase | Security Advisors מציגים mutable `search_path`, הרשאות execute ל־Security Definer functions והגנת leaked-password כבויה; ב־Production branch status מופיע `MIGRATIONS_FAILED` | Reconciliation נפרד, snapshot ו־SQL מאושר בלבד |
| F-03 | P1 | Auth/Profile | lifecycle של pending approval/onboarding והקשחת users חופפים ל־PR #3 ואינם פתרון בטוח בענף זה | לא נגע; review ממוקד של PR #3 לפני שילוב |
| F-04 | P1 | Async | שלושת quick-create handlers הגדירו loading ידנית ולא הבטיחו cleanup כאשר client/network נכשל; Supabase גם אורז fetch failure כ־`error` עם `status: 0` | תוקן ב־`runWithInFlightLock`, `finally` יחיד ואזהרת retry אמביוולנטית ל־status חסר/אפס |
| F-05 | P2 | Network | Tracking קרא `auth.getUser()` אחרי שה־proxy וה־protected tree כבר אימתו session, ואז התחיל ארבע קריאות data | תוקן: 5→4 קריאות client ו־2→1 waves |
| F-06 | P2 | Testing | לא היה PR CI ו־`npm test` גילה רק `stability.test.mjs` | תוקן: discovery לכל Node tests + workflow read-only |
| F-07 | P2 | Data loading | Requests/Tasks/Schedule כוללים waterfalls וטעינות linked-data רחבות; Dashboard קורא חלון events היסטורי גדול | backlog; נדרש measurement לפני שינוי behavior |
| F-08 | P2 | Async | Tracking מכיל races אפשריים במוטציות/filters שכבר סווגו כחלק מ־Phase 3 | לא נגע; מחוץ לסקופ המוצהר |
| F-09 | P2 | Security/Audit | audit שנוצר מהלקוח הוא best-effort ויכול לשקף metadata שסופק מהלקוח; אינו מקור סמכות לזהות actor | תועד; דורש תכנון DB/RLS, לא תיקון UI |
| F-10 | P2 | UX/A11y | מספר modals/help flows חסרים focus management, semantics מלאים או הודעות live | Pre-Marvie backlog; לא לבצע שינוי רוחבי לפני redesign |
| F-11 | P2 | Auth UX | sign-out/reset-password/pending flows כוללים cleanup ו־feedback שאינם אחידים | backlog ממוקד; לא לערבב עם batch זה |
| F-12 | P3 | Hygiene | clone מקומי מכיל כ־1.53GiB Git objects בלתי נגישים | תחזוקה מקומית מאושרת בנפרד; לא בוצע GC |
| F-13 | Info | Deployment | לא נמצאו Vercel config, deploy scripts, deploy hooks או GitHub workflow קיים שמבצע deployment | ה־workflow החדש אינו מוסיף deployment |

אין ראיה ל־RLS bypass מתוך הקוד בלבד, ואין להציג UI gating כהוכחת אבטחה. אין גם ראיה שה־Next advisories ניתנים לניצול בכל route; הממצא הוא התאמת גרסה לטווח רשמי ולכן מחייב upgrade/verification לפני release.

## 7. שלושת ה־Implementation Batches

### Batch 1 — Pull Request CI שאינו deploy

- לפני: לא היה `.github/workflows`; `npm test` הריץ קובץ test אחד בלבד.
- שינוי: workflow מופעל רק על `pull_request` אל `main`, עם `contents: read`, ללא repository/environment secrets, credentials נשמרים כבויים וערכי Supabase ציבוריים הם placeholders לא־חיים לצורך build בלבד. GitHub מספק `GITHUB_TOKEN` מובנה עם ההרשאה המינימלית שהוגדרה.
- scripts: נוספו `typecheck`, `check`; test עבר ל־Node test discovery.
- סיכון שנמנע: אין `push`, אין `workflow_dispatch`, אין Supabase CLI, אין Vercel ואין פקודת deploy.

### Batch 2 — Dashboard quick-create exception safety

- לפני: `isQuickCreateSubmitting` שוחרר ידנית במסלולים מסוימים; exception יכול היה להשאיר UI נעול, ולחיצה כפולה לפני React render לא נחסמה סינכרונית.
- שינוי: ref משותף + helper קטן `runWithInFlightLock`; Request, Task ו־Event עוברים דרך אותו `finally`.
- אחרי returned error או thrown exception: ה־form נשאר, ה־lock משתחרר, וניתן לנסות שוב. כשל עם `status: 0` או status חסר מסווג כאישור transport אמביוולנטי, וההודעה מבקשת לבדוק אם הרשומה נוצרה לפני retry כדי לא לייצר duplicate.
- audit נשאר fire-and-forget ואינו משנה תוצאת mutation.

### Batch 3 — Tracking request reduction

- לפני: `loadTrackingData` ביצע `auth.getUser()` ואז ארבע שאילתות נתונים מקבילות — 5 קריאות client בשתי waves.
- שינוי: הוסר auth round-trip וה־router redirect המקומי. ה־proxy וה־protected layout נשארו שכבות auth קיימות.
- אחרי: ארבע שאילתות data באותה `Promise.all` — 4 קריאות client ב־wave אחת; fields, filters, mutations ו־RLS לא השתנו.

## 8. CI ובדיקות

ה־workflow משתמש ב־Node 24, `npm ci`, test, lint, typecheck ו־production build. ה־permissions מינימליים (`contents: read`), `persist-credentials: false`, ושני ה־Actions הרשמיים pinned ל־commit SHA מלא.

הבדיקות החדשות כוללות behavior אמיתי עבור lifecycle של lock:

- duplicate work נדחה בזמן פעולה פעילה.
- lock ו־busy משתחררים לאחר success.
- exception משתחרר ו־retry אפשרי.
- status חסר/אפס מזוהה כאמביוולנטי, בעוד ש־HTTP error רגיל אינו מסווג כך.

Source-shape guards משניים בלבד מוודאים שכל שלושת Dashboard handlers משתמשים ב־helper וש־Tracking אינו מחזיר את `auth.getUser()` או יותר מארבע queries. אין dependency חדשה ואין test framework חדש.

מגבלה: אין עדיין component/integration harness שמרנדר את כל ה־Dashboard מול Supabase fake. ה־behavior הקריטי נבדק ב־pure helper, והחיבור לשלושת ה־handlers נשמר באמצעות guard משני.

## 9. PR #5 — אימות מבודד

- GitHub: PR #5 פתוח, Draft, לא מוזג, head `190f0602afc1ddf7e076ed1e4f1cb109899d1a1d` בזמן ה־preflight.
- branch נקי ומסונכרן; body/commits לא שונו במסגרת תוכנית זו.
- validation מקומי על PR #5 עבר: 12/12 tests, lint, `tsc --noEmit`, build ו־diff-check.
- Desktop ‏1366×768 ו־Mobile ‏390×844: `/forum` הפנה נכון ל־`/login?next=%2Fforum`, `dir=rtl`, ללא overflow וללא console warnings/errors.
- לא היה session מאומת. לכן לא נטען Forum Daily מחובר ולא בוצעו typing/refresh/date transition/save מול backend.
- מסלולי dirty draft, stale response ו־save/submit exception/retry מכוסים בקוד ובבדיקות של PR #5, אך Connected Smoke QA נשאר חסום עד session קיים ובטוח.
- לא נעשה שימוש בחשבון QA שנמחק, לא הוזנו credentials ולא בוצעה mutation.

## 10. Runtime QA של הענף החדש

האפליקציה הורצה מקומית עם placeholder Supabase לא־חי. נבדקו `/dashboard` ו־`/tracking` ב־1366×768 וב־390×844:

| מסך | Desktop | Mobile | Console/overflow |
| --- | --- | --- | --- |
| Dashboard ללא session | redirect ל־`/login?next=%2Fdashboard` | אותו redirect | נקי; RTL; אין overflow |
| Tracking ללא session | redirect ל־`/login?next=%2Ftracking` | אותו redirect | נקי; RTL; אין overflow |

לא היה session, ולכן modal quick-create ו־Network מחובר של Tracking לא נבדקו בדפדפן. אין לייצג אותם כ־QA שעבר; ההוכחה עבורם היא test + diff review בלבד. לא נוצרו נתונים.

## 11. Supabase ו־Production Freeze

- Production: `hjltpajvqhnygjybtivd`, `ACTIVE_HEALTHY` בזמן הבדיקה.
- Staging: `vmfihyritfmjycrfpxjn`, `ACTIVE_HEALTHY` בזמן הבדיקה.
- Production branch listing הציג branch יחיד `main` עם `MIGRATIONS_FAILED`; לא נוצר preview branch.
- קריאת branch listing ב־Staging נכשלה במגבלת connector; לא בוצעו retries כותבים או עקיפה.
- כלי ה־MCP הזמין אינו חושף ישירות את toggle `Deploy to production`. לפי מצב הפתיחה המאומת שסיפק המשתמש הוא כבוי, והוא נשאר ללא שינוי; אין לטעון שה־toggle עצמו נקרא דרך MCP.
- Automatic Branching ו־Preview Branches לא הופעלו במסגרת העבודה.
- לא בוצעו SQL, migration, schema, RLS, policy, grant, function, trigger, Auth, Storage או data writes.
- 11 ה־profiles הלא־מקושרים הידועים ב־Production לא נגעו ולא נספרו מחדש.
- אין Vercel project מחובר לפי מצב הפתיחה וסריקת ה־repository; לא בוצע deployment.

## 12. Backlog מדורג לבוקר

### P0/P1

1. להשלים Connected Smoke QA ל־PR #5 באמצעות session קיים ובטוח בלבד; אין ליצור חשבון או mutation ללא cleanup בטוח.
2. לפתוח משימת dependency security ממוקדת ל־Next.js, לעדכן לגרסה מתוקנת נתמכת ולהריץ regression מלא. אין לשלב זאת אוטומטית בענף זה.
3. לבצע Supabase reconciliation נפרד: Advisor findings, מצב `MIGRATIONS_FAILED`, snapshot של functions/grants/RLS ותוכנית SQL שמחכה לאישור מפורש.
4. לסקור את PR #3 מול `main` ו־PR #5 לפני כל החלטת Auth/RLS; אין cherry-pick או merge אוטומטי.

### P2 — אמינות, ביצועים ותשתית

1. למדוד ולקצר waterfalls ב־Requests/Tasks/Schedule בלי לשנות visibility או ownership.
2. לטפל ב־Tracking Phase 3 races רק תחת המשימה שכבר הוגדרה לכך.
3. לאחד exception-safe loading/lock במסלולי sign-out, reset-password ו־Admin רק לאחר reproduction.
4. להרחיב behavioral tests מעבר ל־source guards, תחילה למסלולי writes קריטיים.
5. לבדוק stale Dashboard event window וסטטוס מערכת שמוצג כקבוע לפני שינוי UI.

### Pre-Marvie

1. לקבוע baseline נגישות ל־dialogs: focus trap/return, labels ו־aria-live.
2. לשמר RTL, Light Gloss, mobile drawers ו־protected redirects בבדיקות redesign.
3. להגדיר contract למסכי loading/error/empty לפני שינוי רכיבים.

### Marvie Planning

1. לתכנן hierarchy, offline, multi-company ופיצ׳רים חדשים כמסלולים נפרדים — לא להכניס אותם ל־stabilization.
2. למפות ownership ו־RLS לפני כל UI שמציג הרשאות היררכיות חדשות.

### Supabase Reconciliation

1. mutable `search_path` ו־function execute grants לפי Advisor, בנפרד ל־Production ול־Staging.
2. Leaked Password Protection והשלכות Auth configuration.
3. migration registry מול schema בפועל; אין rerun עיוור של migrations.
4. actor integrity של audit logs.
5. ה־profiles הלא־מקושרים נשארים read-only עד תוכנית cleanup מאושרת.

## 13. רצף המשך מומלץ

1. לסיים review אנושי ו־Connected Smoke של PR #5; להשאיר Draft עד שיש הוכחת runtime מחוברת.
2. לסקור את Draft PR של quality foundation ולהמתין ל־CI.
3. לפני release כלשהו, לטפל בחסם dependency security ולבצע Supabase reconciliation נפרד.
4. רק לאחר סגירת חסמי P1 להתחיל Product/Marvie planning; אין להתחיל implementation עיצובי מתוך checkpoint זה.

## 14. נקודת פתיחה לסוכן הבא

- קרא מסמך זה ואת `AGENTS.md`; אין צורך לפתוח System X-Ray מחדש.
- אמת remote heads ו־checks חיים לפני כל פעולה.
- אל תשנה PR #3, PR #5, Supabase או deployment בלי אישור מפורש.
- אם מטפלים ב־PR #5: Connected Smoke בלבד עם session קיים; אין credentials בצ׳אט ואין mutation ללא cleanup בטוח.
- אם מטפלים בענף האיכות: התחל ב־review של `origin/main...chore/pre-redesign-quality-foundation`, לא ב־refactor חדש.
- אם מטפלים ב־P1 security: פתח תוכנית נפרדת; שינוי DB מחייב snapshot, SQL מדויק ואישור נוסף.

## 15. קבצי הסקופ

השינויים המתוכננים בענף זה בלבד:

- `.github/workflows/ci.yml`
- `package.json`
- `src/app/(protected)/dashboard/page.tsx`
- `src/app/(protected)/tracking/page.tsx`
- `src/lib/inFlightLock.ts`
- `tests/quality-foundation.test.mjs`
- `docs/checkpoints/2026-08-02-pre-redesign-acceleration-report.md`

אין שינוי ב־`package-lock.json`, migrations, SQL, `supabase/`, Auth, RLS, Vercel, Forum Daily, PR #3 או PR #5.

## 16. Validation סופי לפני push

| בדיקה | תוצאה | הערה |
| --- | --- | --- |
| `npm test` | עבר | 15/15 |
| `npm run lint` | עבר | ללא warnings/errors |
| `npx tsc --noEmit` | עבר | ללא output |
| `npm run build` | עבר | production build עם Supabase placeholders לא־חיים |
| `git diff --check` | עבר | ללא whitespace errors |
| Workflow YAML | עבר | parse תקין, Actions pinned, PR trigger בלבד וללא deploy command |
| Secret scan | עבר | לא נמצאו private keys, service-role tokens, JWTs או connection strings בדיפ |
| Dependency diff | עבר | scripts בלבד; `package-lock.json` וגרסאות dependencies לא השתנו |
| Scope | עבר | שבעת הקבצים המתועדים בלבד; אין SQL/migrations/Supabase/Vercel/Forum/PR #3/PR #5 |
| Browser QA | עבר חלקית | redirects/RTL/overflow/console עברו; QA מחובר חסום ללא session |
| Independent reviews | עבר | שלושה reviewers; findings תוקנו; verification ללא blocker |

GitHub Actions run יתועד בדוח המסירה לאחר ה־push ופתיחת ה־Draft PR.

## 17. החלטה חד־משמעית

הצעד הבא הוא review אנושי של PR #5 וה־Draft PR החדש, תוך השארת שניהם Draft. אין להתחיל redesign ואין לאשר release לפני טיפול נפרד בחסם Next.js וב־Supabase reconciliation. אין merge ואין deployment מתוך תוכנית זו.
