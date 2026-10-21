# Bug Flow

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


1. שחזר ותעד expected/actual.
2. מפה את הזרימה וכל callers של הנקודה החשודה.
3. הוכח root cause לפני edit.
4. תקן פעם אחת בנקודה המשותפת הקטנה ביותר.
5. השאר check קטן שנכשל לפני התיקון והריץ regression ממוקד.
6. REVIEW ו־HANDOFF.
