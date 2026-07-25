# Database Change Flow

1. הגדר data invariant, owners, backfill ו־rollback.
2. צלם ואמת schema/RLS נוכחיים לפני הצעה.
3. כתוב migration additive חדשה בלבד; אל תשכתב migration היסטורית.
4. בצע review אבטחה ו־tenant leak analysis.
5. הצג SQL למשתמש והמתן להרצה ידנית מפורשת.
6. לאחר דיווח תוצאה, אמת app compatibility ו־handoff.

אין להריץ SQL או migration אוטומטית.
