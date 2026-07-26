# Next Security Batches Decision Pack

מסמך תכנון והחלטה עבור סבבי האבטחה הבאים. **תכנון בלבד — אין בו קוד ואין לגזור ממנו מימוש ללא אישור מפורש.**

---

## 1. Current review state

**בדיקות ה-staging הידניות A–J עברו, ו-PR #3 מוכן ל-Ready for review בלבד. הוא עדיין אינו מאושר למיזוג או לפריסה ל-production.**

הביקורת הסטטית של PR #3 הושלמה ועברה: migration 016 עטופה ב-`begin`/`commit`, אינה מוחקת נתונים, כל ה-policies הן `to authenticated` ואין `using(true)`, הטריגר מגן על שבעת השדות הרגישים בשני ענפיו, ו-`claim_own_profile` הוא `SECURITY DEFINER` עם `search_path` בטוח וממפה `unique_violation` להודעה נקייה.

ב-`hamifkad-staging` הוגדר SMTP ייעודי באמצעות Mailtrap ותבנית Confirm signup הכוללת `{{ .Token }}`. זרימת Email OTP code-only עבדה, ו-`claim_own_profile` והטריגר `guard_users_sensitive_fields` הוכחו ב-runtime.

עברו: הרשמה עם pending defaults, חסימת self-escalation, אישור מפקד דרך Admin UI, חסימת `/admin` למשתמש רגיל, profile claim תוך שמירת השדות הרגישים, linked-email conflict ללא כפילות או שגיאת DB גולמית, ועדכון `last_login_at`.

אין להשתמש ב-confirmation link כתחליף למסלול OTP. הקשחת callback/link flow נשארת follow-up מתועד, לא blocker ל-PR #3.

הצ'קליסט המלא נמצא ב-[`users-rls-auth-hardening-runbook.md`](users-rls-auth-hardening-runbook.md) סעיף 5.

---

## 2. Batch recommendation order

| # | Batch | למה בסדר הזה |
|---|---|---|
| 1 | **Configure staging Custom SMTP** | **DONE** — Mailtrap הוגדר ב-staging |
| 2 | **Update Confirm signup template to OTP Token** | **DONE** — התבנית כוללת `{{ .Token }}` |
| 3 | **Send a fresh test registration email with OTP** | **DONE** — קוד OTP התקבל ועבד |
| 4 | **Manual staging registration/security tests עבור PR #3** | **DONE** — בדיקות A–J עברו |
| 5 | **Minimal production-safe observability** | קטן, סיכון נמוך, ומאפשר לדבג כל מה שאחריו |
| 6 | **Proxy gating ל-pending/blocked** | נוגע בנתיב auth — רק אחרי ש-PR #3 הוכח |
| 7 | **Vercel Preview/Staging env separation** | חובה לפני כל deploy ציבורי |
| 8 | **Redirect URLs ל-staging/preview** | אחרת reset-password ו-magic-link נשברים |
| 9 | **אימות ניקוי dev credentials** | בדיקה, לא בהכרח שינוי קוד |
| 10 | **favicon / manifest** | פוליש; אחרון |

**הערה על סדר 5 לפני 6:** יש פיתוי להקדים את ה-proxy gating כי הוא "אבטחתי יותר". זו טעות — gating נוגע בנתיב ההתחברות, ואם הוא ישבור משהו בלי לוגים, הדיבוג יהיה בניחושים.

---

## 3. Observability batch spec

> תכנון בלבד. אין לממש ללא אישור.

**Goal:** להפוך את שכבת הלוגים לשימושית בפרודקשן, בלי להוסיף תלות ובלי לדלוף מידע.

**המצב היום (נמדד):**
- `logSupabaseError` — **77** אתרי קריאה
- `logDevelopmentError` — **10** אתרי קריאה
- שניהם מושתקים לחלוטין מחוץ ל-development (`src/lib/supabase/error.ts:23` — `if (process.env.NODE_ENV !== 'development') return;`)
- בנוסף: **15** `console.error` + **8** `console.warn` גולמיים ו**לא-מגודרים**, שכן רצים בפרודקשן

כלומר המצב אינו "אפס לוגים" אלא **לא-עקבי**: 87 האתרים המובנים שותקים, ו-23 הגולמיים עלולים להדפיס אובייקטי שגיאה שלמים.

**Files likely involved:**
- `src/lib/supabase/error.ts` (עיקרי)
- אתרי ה-`console.*` הגולמיים, להמרה ל-helper (אופציונלי, שלב ב')

**Constraints:**
- **ללא dependencies חדשות.** `console.error` נקלט אוטומטית ב-Vercel.
- Sentry — אופציונלי ומאוחר יותר בלבד; אינו נדרש כדי לקבל ערך.

**מה כן לרשום (sanitized):**
- `message`
- `code`
- `status`
- `name`
- `context` (מפתחות תיאוריים שהקוד מספק — לא תוכן שורות)

**מה אסור לרשום:**
- secrets, מפתחות API, ערכי env
- JWT או כל טוקן
- URLs מלאים של הפרויקט
- שורות DB גולמיות
- `details` / `hint` בפרודקשן — הם עלולים להכיל ערכים מתוך שורות שנכשלו

**Validation:**
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`
- שגיאת Supabase מאולצת ב-**staging** (למשל פעולה שנחסמת ב-RLS) כדי לוודא שהלוג מופיע ושאין בו מידע רגיש — **רק אחרי אישור**

**Size:** S · **Risk:** נמוך

---

## 4. Proxy gating decision spec

> תכנון בלבד. אין לממש ללא אישור ובמסגרת PR נפרד.

**המצב היום:** `src/proxy.ts` בודק **קיום session בלבד** (`if (!user)`), ללא בדיקת `status` או `role_approval_status`. לכן משתמש `pending`, `blocked` או `inactive` מקבל את כל ה-shell ואת כל חבילות ה-JS — כולל פאנל האדמין. רק אחר כך `src/app/(protected)/layout.tsx` מרנדר מסך הודעה במקום התוכן, על בסיס `authStatus`. `fetchCurrentProfile` כבר מסווג נכון לשבעה מצבים, כך שהמידע קיים — הוא פשוט לא נאכף בשרת.

**ההחלטות המוצעות:**

1. **`pending`** → הפניה ל-`/pending-approval` **לפני** ה-shell. אין סיבה לשלוח לו את חבילות הקוד.
2. **`blocked` / `inactive` / `rejected`** → הפניה ל-`/login` עם סיבה, או למסך blocked ייעודי. **לא** ל-`/pending-approval` — מסך שאומר לחסום "ממתין לאישור" הוא מטעה ונצחי.
3. **`/admin`** → commander-only **ברמת ה-proxy**, כך שכשל הוא הפניה בשרת ולא רכיב לקוח שבחר לא לרנדר.
4. **RLS נשאר השומר הסופי על הנתונים.** ה-proxy הוא שכבת הפניה ו-UX, לא תחליף.

**איפה לאכוף:** בשלוש השכבות — proxy (fail-closed לפני שליחת ה-bundle), AppContext/layout (חוויית משתמש), RLS (האמת). אין להסתפק בלקוח.

**סיכון שיש לתמחר:** בדיקה כזו מוסיפה **שאילתת פרופיל אחת בכל ניווט מוגן**. האינדקס `idx_users_auth_user_id` קיים מ-`001`, ובקנה מידה של פלוגה העלות זניחה — אבל היא אמיתית וצריכה להיאמד. חלופה ללא RTT: לשקף `status` ל-`app_metadata` של ה-JWT דרך Auth Hook. **עדיף כשלב מאוחר יותר**, לא בסבב הזה.

**המלצה:** בדיקות PR #3 עברו, אך יש לממש proxy gating רק בסבב נפרד ומאושר כדי לא לערב שני שינויי auth באותו PR.

**Size:** S–M · **Risk:** בינוני (נוגע בנתיב auth — דורש QA לכל אחד מהמצבים)

---

## 5. Deployment / env risks

| סיכון | מצב | פעולה נדרשת |
|---|---|---|
| **Confirm signup שולח link במקום OTP** | 🟢 נסגר ב-staging | Mailtrap ותבנית `{{ .Token }}` אומתו ב-`hamifkad-staging`. הדרישה חלה בנפרד על כל סביבת Supabase שמריצה את האפליקציה |
| **Vercel Preview יורש env של production** | 🔴 פתוח | כל PR preview עלול להתחבר ל-DB האמיתי. חובה להגדיר Preview scope נפרד עם פרטי staging. במערכת פיקודית — בלתי מתקבל |
| **Redirect URLs ל-staging/preview** | 🟠 חלקי | ב-staging הוגדר `localhost` בלבד. לפני deploy יש להוסיף את דומיין היעד, אחרת reset-password ו-magic-link נשברים |
| **service role בצד לקוח** | 🟢 נקי | אומת: אין `service_role` בשום מקום ב-`src/` וב-`.env.example`. **לשמר** |
| **שמות policies ב-production** | 🔴 לא מאומת | חייב snapshot טרי לפני החלת 016. ראה runbook סעיף 7 |
| **dev credentials בקוד** | 🟠 לבדיקה | צמד dev מקודד ב-`login/page.tsx`, מגודר נכון ב-`NODE_ENV` ונמחק ב-tree-shaking בבילד production. הסיכון אינו ה-UI אלא שהצמד ציבורי — יש **לאמת שהמשתמש הזה אינו קיים** בסביבת היעד |
| **נכסי public** | 🟡 פוליש | עדיין רק SVG של תבנית Next; אין favicon/app-icon/manifest |
| **ידע תפעולי מחוץ לגיט** | 🟢 נסגר | ה-runbook הועבר ל-`docs/deployment/` ומנוהל בגיט |

---

## 6. Exact next action

להעביר את PR #3 ל-Ready for review ולבצע final code/security review. אין למזג או לפרוס ל-production עדיין.

לפני production חובה לבצע snapshot טרי, לאמת את שמות ה-policies והפונקציות, ולהחיל migration 016 לפני code deploy. לאחר review, הסבבים הבאים נשארים proxy gating, production observability והקשחת callback/link flow — כל אחד ב-scope נפרד ומאושר.
