---
description: Browser QA of routes/flows (read-only, qa-browser)
argument-hint: <routes or flows to test>
---
Run the **QA** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/qa.md` and `.ai-workspace/contracts/qa-gates.md`.
2. Ensure the dev server is running; log in via **Dev Login** or an existing authorized session only.
3. Delegate to the **qa-browser** subagent (read-only; no data mutations — open/inspect/cancel only).
4. Test the required routes/viewports; check console/network, RTL, a11y, responsive.
5. Output a QA report (`.ai-workspace/templates/qa-report.md`) with findings by severity and pass/fail.
