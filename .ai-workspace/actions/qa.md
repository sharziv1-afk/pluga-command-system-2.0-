# QA

<!-- Workspace guide: [../../WORKSPACE_MODE.md](../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


מטרה: לאמת acceptance criteria ולחפש regression.

1. הרץ preflight במצב המתאים.
2. השתמש ב־[`../contracts/qa-gates.md`](../contracts/qa-gates.md).
3. בדוק flow, error states, permissions, RTL ו־responsive.
4. דווח pass/fail/not-run עם evidence; אל תציג emulation כמכשיר פיזי.
5. כתוב לפי [`../templates/qa-report.md`](../templates/qa-report.md).

אין Playwright בפרויקט כרגע; אין להתקינו אוטומטית.
