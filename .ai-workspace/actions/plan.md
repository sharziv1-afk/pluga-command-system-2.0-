# PLAN

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


מטרה: להפוך דרישה ל־scope ולתכנית ניתנים לביקורת, בלי לשנות קוד.

1. הרץ context ו־preflight report-only.
2. קרא רק את הקבצים וה־callers הדרושים להבנת הזרימה.
3. תעד מצב קיים, acceptance criteria, סיכונים ו־stop conditions.
4. בחר playbook והפרד in-scope מ־out-of-scope.
5. כתוב לפי [`../templates/implementation-plan.md`](../templates/implementation-plan.md).

עצור אם נדרש שינוי מוצרי/DB/הרשאה שלא אושר או אם שינויים קיימים חופפים ל־scope.
