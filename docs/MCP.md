# MCP — חיבור Claude / ChatGPT לאתר

עודכן 24.10.2026. שלב 1: **קריאה בלבד**.

## מה זה

נקודת קצה `https://pluga-command-system-2-0.vercel.app/api/mcp` (Streamable HTTP, `mcp-handler` 2.3 + MCP SDK v2). Claude או ChatGPT מתחברים אליה כמחבר (custom connector), ואז אפשר לשאול: "מי הגיש דוח היום?", "מה המצבה?", "אילו משימות באיחור?" וכדומה.

## אבטחה

- **אימות:** OAuth 2.1 של Supabase Auth (`https://vmfihyritfmjycrfpxjn.supabase.co/auth/v1`). המשתמש נכנס דרך מסך הכניסה הרגיל ומאשר ב־`/oauth/consent`. הלקוח מקבל access token **של המשתמש עצמו**.
- **הרשאות:** כל שאילתה נשלחת ל־PostgREST עם הטוקן הזה, ולכן ה־RLS קובע מה חוזר. מ״מ רואה את המחלקה שלו, ומ״פ רואה את הפלוגה. אין מפתח service-role.
- **סינון לפני כל קריאה:** `verifyMcpToken` מאמת את הטוקן מול Supabase Auth ודורש פרופיל מקושר, `active` ו־`approved`. אחרת התשובה היא 401.
- **מסך האישור:** פרופיל לא פעיל יכול רק לדחות.
- **אין כתיבה:** אין קריאות `insert`/`update`/`upsert`/`delete`/`rpc` בשכבת ה־MCP. כל כלי מסומן `readOnlyHint`, והמבחן `tests/mcpReadOnly.test.mjs` אוכף את זה.
- **פרטים מזהים:** `personal_number` של חיילים ומיילים לא נבחרים ולא מוחזרים.
- **פער ידוע:** ה־token עצמו הוא token מלא של המשתמש. מי שמחזיק בו יכול טכנית לכתוב ישירות ל־Supabase, מחוץ ל־MCP. לסגירה מלאה מוסיפים מדיניות RLS שחוסמת כתיבה כשב־JWT יש `client_id` של OAuth. זה SQL ידני ודורש אישור נפרד, כחלק משלב 2.
- **ביטול גישה:** ב־Supabase, Authentication → OAuth Apps, או בחסימת המשתמש ב־`/admin`.

## הכלים

| כלי | מה מחזיר |
|---|---|
| `whoami` | מי מחובר, תפקיד, מסגרת, היקף הרשאה |
| `get_daily_brief` | תמונת מצב להיום: פורום ומצבה, משימות פתוחות ובאיחור, דרישות, לו״ז היום ומחר, בדיקות חניכה (מ״פ) |
| `get_forum_status` | מי הגיש, מי בטיפול ומי חסר, לכל משבצת בתאריך. שיוך המחלקות לפי בעלים, כמו באתר |
| `get_manpower` | נוכחים/סד״כ לכל מחלקה, וסך פלוגתי |
| `get_forum_report` | הטקסט המלא של דוח: מחלקה 1–4, מפל״ג או פלוגתי |
| `list_tasks` | משימות, עם סינון פתוחות/שלי/באיחור |
| `list_requests` | דרישות פעילות או לפי סטטוס |
| `list_gaps` | פערים |
| `get_schedule` | לו״ז בטווח תאריכים, כולל עבר |
| `get_tracking` | מטריצת מעקב: פריטים, סטטוס לכל חייל, סיכומים, ו"רק לא עבר" |
| `list_mentoring` | יומן חניכה. מ״פ בלבד |
| `list_people` | סגל: תפקיד, מסגרת, האם התחבר |

תאריכים לפי Asia/Jerusalem. דוחות מ״כים מוסתרים, כמו בפורום המוביל.

## הגדרות Supabase (בוצעו 24.10.2026)

ב־Authentication:

1. **URL Configuration:** Site URL = `https://pluga-command-system-2-0.vercel.app`. ההגדרה לא משפיעה על קוד ה־OTP.
2. **OAuth Server:** פעיל, נתיב אישור `/oauth/consent`. Dynamic OAuth Apps **כבוי**: רק לקוח רשום יכול להתחבר.
3. **OAuth Apps:** לקוח "Claude"
   - Public client (PKCE, בלי secret).
   - Client ID: `c63b00ed-fe4f-4cff-ac90-67c3b752c649`.
   - Redirect URIs: `https://claude.ai/api/mcp/auth_callback` ו־`https://claude.com/api/mcp/auth_callback`.

ל־ChatGPT צריך לקוח נוסף עם ה־redirect URI שלו. אם ChatGPT דורש Dynamic Client Registration, צריך להחליט אם להפעיל אותו, כי הוא פותח רישום לכל לקוח. גם אז נדרשים כניסה ואישור במסך ההסכמה, ורק פרופיל פעיל ומאושר יכול לאשר.

## חיבור ב־Claude

1. Claude, Settings → Connectors → **Add custom connector**.
2. שם: `המפקד`. URL: `https://pluga-command-system-2-0.vercel.app/api/mcp`.
3. Advanced settings → OAuth Client ID: `c63b00ed-fe4f-4cff-ac90-67c3b752c649`. שדה ה־secret נשאר ריק.
4. Connect. נפתח מסך הכניסה של האתר, ואחריו מסך האישור. מאשרים.
5. בשיחה חדשה מפעילים את המחבר ושואלים, למשל: "מה תמונת המצב היום?"

הביטול נעשה ב־Claude (Disconnect), או ב־Supabase דרך OAuth Apps.

## אומת חי (24.10.2026, כמ״פ, דרך /api/mcp)

- **אבטחה:** בלי טוקן מתקבל 401 עם `WWW-Authenticate`, וטוקן מזויף מקבל 401.
- **מטא־דאטה:** `/.well-known/oauth-protected-resource` מצביע על Supabase.
- **זרימת OAuth:** `authorize` מפנה ל־`/oauth/consent`, והמסך מוצג תקין.
- **נתונים:**
  - `get_manpower 2026-10-21`: ‏107/117.
  - `get_forum_status`: ‏4/4 מחלקות, 4/4 מפל״ג, דוח פלוגתי בטיפול.
  - `list_tasks`: ‏3 פתוחות, 3 באיחור.
  - `get_tracking`: ‏31 עבר / 3 לא עבר / 2 השלמה.
- **פרטים מזהים:** אין מיילים בתשובות. `list_mentoring` מוחזר למ״פ בלבד.

## שלב 2 (לא נבנה)

פעולות כתיבה, כמו יצירת משימה או עדכון דוח. כל כלי כתיבה יעבור דרך אותם guardrails של האתר: `writeWithHierarchyResolution`, `.select()` ובדיקת שורות, audit. לפני כן נדרשת חסימת כתיבה ישירה מטוקני OAuth ב־RLS.
