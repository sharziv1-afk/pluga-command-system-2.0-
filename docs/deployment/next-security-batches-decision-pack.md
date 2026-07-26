# Next Security Batches Decision Pack

מסמך תכנון והחלטה עבור סבבי האבטחה הבאים. **תכנון בלבד — אין בו קוד ואין לגזור ממנו מימוש ללא אישור מפורש.**

---

## 1. Current blocking state

**PR #3 נשאר Draft עד שבדיקות ה-staging הידניות יעברו.**

הביקורת הסטטית של PR #3 הושלמה ועברה: migration 016 עטופה ב-`begin`/`commit`, אינה מוחקת נתונים, כל ה-policies הן `to authenticated` ואין `using(true)`, הטריגר מגן על שבעת השדות הרגישים בשני ענפיו, ו-`claim_own_profile` הוא `SECURITY DEFINER` עם `search_path` בטוח וממפה `unique_violation` להודעה נקייה.

**מה שחסר אינו איכות קוד אלא ראיה התנהגותית.** ב-`hamifkad-staging` יש `users = 0` ו-`auth.users = 0`, ולכן `claim_own_profile` מעולם לא הופעל ו-`guard_users_sensitive_fields` מעולם לא ירה. כל עוד זה המצב — אין ל-PR #3 הוכחת runtime.

בדיקת ההרשמה נעצרה לפני יצירת משתמש: תבנית ברירת המחדל של Confirm signup
שלחה `{{ .ConfirmationURL }}`, בעוד האפליקציה תומכת בזרימת Email OTP code-only.
נדרש Custom SMTP ותבנית הכוללת `{{ .Token }}` לפני שאפשר להמשיך בבדיקה.
אין להשתמש ב-confirmation link כתחליף למסלול שמפעיל `claim_own_profile`.

הצ'קליסט המלא נמצא ב-[`users-rls-auth-hardening-runbook.md`](users-rls-auth-hardening-runbook.md) סעיף 5.

---

## 2. Batch recommendation order

| # | Batch | למה בסדר הזה |
|---|---|---|
| 1 | **Configure staging Custom SMTP** | נדרש כדי לשלוט בתבנית Confirm signup ולשלוח OTP code |
| 2 | **Update Confirm signup template to OTP Token** | התבנית חייבת לכלול `{{ .Token }}`, לא רק `{{ .ConfirmationURL }}` |
| 3 | **Send a fresh test registration email with OTP** | מאמת שהגדרת המייל עובדת לפני יצירת משתמש בדיקה |
| 4 | **Manual staging registration/security tests עבור PR #3** | רק מסלול הקוד מפעיל את `claim_own_profile` שה-PR צריך להוכיח |
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

> תכנון בלבד. אין לממש ללא אישור, **ולא לפני** שבדיקות PR #3 עוברות.

**המצב היום:** `src/proxy.ts` בודק **קיום session בלבד** (`if (!user)`), ללא בדיקת `status` או `role_approval_status`. לכן משתמש `pending`, `blocked` או `inactive` מקבל את כל ה-shell ואת כל חבילות ה-JS — כולל פאנל האדמין. רק אחר כך `src/app/(protected)/layout.tsx` מרנדר מסך הודעה במקום התוכן, על בסיס `authStatus`. `fetchCurrentProfile` כבר מסווג נכון לשבעה מצבים, כך שהמידע קיים — הוא פשוט לא נאכף בשרת.

**ההחלטות המוצעות:**

1. **`pending`** → הפניה ל-`/pending-approval` **לפני** ה-shell. אין סיבה לשלוח לו את חבילות הקוד.
2. **`blocked` / `inactive` / `rejected`** → הפניה ל-`/login` עם סיבה, או למסך blocked ייעודי. **לא** ל-`/pending-approval` — מסך שאומר לחסום "ממתין לאישור" הוא מטעה ונצחי.
3. **`/admin`** → commander-only **ברמת ה-proxy**, כך שכשל הוא הפניה בשרת ולא רכיב לקוח שבחר לא לרנדר.
4. **RLS נשאר השומר הסופי על הנתונים.** ה-proxy הוא שכבת הפניה ו-UX, לא תחליף.

**איפה לאכוף:** בשלוש השכבות — proxy (fail-closed לפני שליחת ה-bundle), AppContext/layout (חוויית משתמש), RLS (האמת). אין להסתפק בלקוח.

**סיכון שיש לתמחר:** בדיקה כזו מוסיפה **שאילתת פרופיל אחת בכל ניווט מוגן**. האינדקס `idx_users_auth_user_id` קיים מ-`001`, ובקנה מידה של פלוגה העלות זניחה — אבל היא אמיתית וצריכה להיאמד. חלופה ללא RTT: לשקף `status` ל-`app_metadata` של ה-JWT דרך Auth Hook. **עדיף כשלב מאוחר יותר**, לא בסבב הזה.

**המלצה:** לא לממש לפני שבדיקות PR #3 הידניות עוברות. שני שינויים במקביל בנתיב ה-auth מקשים על בידוד תקלות.

**Size:** S–M · **Risk:** בינוני (נוגע בנתיב auth — דורש QA לכל אחד מהמצבים)

---

## 5. Deployment / env risks

| סיכון | מצב | פעולה נדרשת |
|---|---|---|
| **Confirm signup שולח link במקום OTP** | 🔴 פתוח | בכל סביבת Supabase שמריצה את האפליקציה יש להגדיר Custom SMTP ותבנית Confirm signup הכוללת `{{ .Token }}`, לא רק `{{ .ConfirmationURL }}` |
| **Vercel Preview יורש env של production** | 🔴 פתוח | כל PR preview עלול להתחבר ל-DB האמיתי. חובה להגדיר Preview scope נפרד עם פרטי staging. במערכת פיקודית — בלתי מתקבל |
| **Redirect URLs ל-staging/preview** | 🟠 חלקי | ב-staging הוגדר `localhost` בלבד. לפני deploy יש להוסיף את דומיין היעד, אחרת reset-password ו-magic-link נשברים |
| **service role בצד לקוח** | 🟢 נקי | אומת: אין `service_role` בשום מקום ב-`src/` וב-`.env.example`. **לשמר** |
| **שמות policies ב-production** | 🔴 לא מאומת | חייב snapshot טרי לפני החלת 016. ראה runbook סעיף 7 |
| **dev credentials בקוד** | 🟠 לבדיקה | צמד dev מקודד ב-`login/page.tsx`, מגודר נכון ב-`NODE_ENV` ונמחק ב-tree-shaking בבילד production. הסיכון אינו ה-UI אלא שהצמד ציבורי — יש **לאמת שהמשתמש הזה אינו קיים** בסביבת היעד |
| **נכסי public** | 🟡 פוליש | עדיין רק SVG של תבנית Next; אין favicon/app-icon/manifest |
| **ידע תפעולי מחוץ לגיט** | 🟢 נסגר | ה-runbook הועבר ל-`docs/deployment/` ומנוהל בגיט |

---

## 6. Exact next action

1. להגדיר Custom SMTP ב-`hamifkad-staging`.
2. לעדכן את Confirm signup template כך שתכלול `{{ .Token }}`.
3. לשלוח מייל הרשמה חדש ולוודא שהוא מכיל קוד OTP.
4. רק אז לבצע את בדיקה A ב-[`users-rls-auth-hardening-runbook.md`](users-rls-auth-hardening-runbook.md) סעיף 5.

בדיקת ההרשמה הידנית היא שמפעילה לראשונה את `claim_own_profile` ואת
`guard_users_sensitive_fields` יחד, ומכסה בבת אחת את A ו-B. אם היא עוברת —
שאר הצ'קליסט הוא הרחבה. אם היא נכשלת — נדע מיד מה לתקן, לפני שנוגעים בכל
דבר אחר.

**PR #3 נשאר Draft.**
