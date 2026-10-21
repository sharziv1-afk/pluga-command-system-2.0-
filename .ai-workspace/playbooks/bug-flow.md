# Bug Flow

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


1. שחזר ותעד expected/actual.
2. מפה את הזרימה וכל callers של הנקודה החשודה.
3. הוכח root cause לפני edit.
4. תקן פעם אחת בנקודה המשותפת הקטנה ביותר.
5. השאר check קטן שנכשל לפני התיקון והריץ regression ממוקד.
6. REVIEW ו־HANDOFF.
