# Auth / RLS Flow

1. מפה actor → identity → resource → policy → operation.
2. בדוק unauthenticated, pending, approved, owner, commander ו־cross-unit/company.
3. ודא ש־UI gating אינו enforcement יחיד.
4. שמור `created_by` ו־`owner_user_id` נפרדים.
5. בצע leak-first review לפני happy path.
6. כל SQL מוצע בלבד וממתין לאישור.
