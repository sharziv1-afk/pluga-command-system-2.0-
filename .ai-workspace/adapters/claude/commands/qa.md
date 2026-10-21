---
description: Browser QA of routes/flows (read-only, qa-browser)
argument-hint: <routes or flows to test>
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run the **QA** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/qa.md` and `.ai-workspace/contracts/qa-gates.md`.
2. Ensure the dev server is running; log in via **Dev Login** or an existing authorized session only.
3. Delegate to the **qa-browser** subagent (read-only; no data mutations — open/inspect/cancel only).
4. Test the required routes/viewports; check console/network, RTL, a11y, responsive.
5. Output a QA report (`.ai-workspace/templates/qa-report.md`) with findings by severity and pass/fail.
