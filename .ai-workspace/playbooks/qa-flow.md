# QA Flow

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


1. קרא acceptance criteria ו־changed files.
2. הרץ quick/focused gates; full לפני release.
3. בצע smoke לפי [`../contracts/qa-gates.md`](../contracts/qa-gates.md).
4. בדוק RTL, responsive, keyboard, errors והרשאות.
5. דווח pass/fail/not-run עם evidence.

אין Playwright בפרויקט כרגע; השתמש ב־checklist ידני ובכלי הדפדפן הזמינים.
