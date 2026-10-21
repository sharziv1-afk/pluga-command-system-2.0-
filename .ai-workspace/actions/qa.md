# QA

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


מטרה: לאמת acceptance criteria ולחפש regression.

1. הרץ preflight במצב המתאים.
2. השתמש ב־[`../contracts/qa-gates.md`](../contracts/qa-gates.md).
3. בדוק flow, error states, permissions, RTL ו־responsive.
4. דווח pass/fail/not-run עם evidence; אל תציג emulation כמכשיר פיזי.
5. כתוב לפי [`../templates/qa-report.md`](../templates/qa-report.md).

אין Playwright בפרויקט כרגע; אין להתקינו אוטומטית.
