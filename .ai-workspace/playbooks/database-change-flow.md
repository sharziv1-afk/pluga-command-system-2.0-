# Database Change Flow

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


1. הגדר data invariant, owners, backfill ו־rollback.
2. צלם ואמת schema/RLS נוכחיים לפני הצעה.
3. כתוב migration additive חדשה בלבד; אל תשכתב migration היסטורית.
4. בצע review אבטחה ו־tenant leak analysis.
5. הצג SQL למשתמש והמתן להרצה ידנית מפורשת.
6. לאחר דיווח תוצאה, אמת app compatibility ו־handoff.

אין להריץ SQL או migration אוטומטית.
