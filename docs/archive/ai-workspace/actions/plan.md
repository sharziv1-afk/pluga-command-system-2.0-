# PLAN

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


מטרה: להפוך דרישה ל־scope ולתכנית ניתנים לביקורת, בלי לשנות קוד.

1. הרץ context ו־preflight report-only.
2. קרא רק את הקבצים וה־callers הדרושים להבנת הזרימה.
3. תעד מצב קיים, acceptance criteria, סיכונים ו־stop conditions.
4. בחר playbook והפרד in-scope מ־out-of-scope.
5. כתוב לפי [`../templates/implementation-plan.md`](../templates/implementation-plan.md).

עצור אם נדרש שינוי מוצרי/DB/הרשאה שלא אושר או אם שינויים קיימים חופפים ל־scope.
