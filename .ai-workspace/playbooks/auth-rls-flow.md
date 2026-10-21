# Auth / RLS Flow

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


1. מפה actor → identity → resource → policy → operation.
2. בדוק unauthenticated, pending, approved, owner, commander ו־cross-unit/company.
3. ודא ש־UI gating אינו enforcement יחיד.
4. שמור `created_by` ו־`owner_user_id` נפרדים.
5. בצע leak-first review לפני happy path.
6. כל SQL מוצע בלבד וממתין לאישור.
