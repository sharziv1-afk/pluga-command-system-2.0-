# SECURITY

מטרה: לבדוק Auth, RLS, secrets, tenant boundaries והרשאות.

1. מפה actor, resource, action ו־trust boundary.
2. בדוק client gating מול enforcement בשרת/DB.
3. אמת `created_by` מול `owner_user_id`, unit/company scope ונתיבי privileged.
4. חפש חשיפת secrets בשמות קבצים/קוד בלבד; אל תדפיס ערכי env.
5. כתוב לפי [`../templates/security-report.md`](../templates/security-report.md).

SQL הוא הצעה בלבד. אין להריץ migration או לשנות RLS ללא snapshot, תכנון ואישור.
