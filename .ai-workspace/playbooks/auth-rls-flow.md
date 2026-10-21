# Auth / RLS Flow

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


1. מפה actor → identity → resource → policy → operation.
2. בדוק unauthenticated, pending, approved, owner, commander ו־cross-unit/company.
3. ודא ש־UI gating אינו enforcement יחיד.
4. שמור `created_by` ו־`owner_user_id` נפרדים.
5. בצע leak-first review לפני happy path.
6. כל SQL מוצע בלבד וממתין לאישור.
