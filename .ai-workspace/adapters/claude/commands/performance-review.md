---
description: Performance review — waterfalls, N+1, render cost (read-only, security-performance-reviewer)
argument-hint: [route or flow]
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run the **PERFORMANCE** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/performance.md` and `.ai-workspace/playbooks/performance-flow.md`.
2. Delegate to the **security-performance-reviewer** subagent (read-only; Browser for evidence).
3. Identify client waterfalls, duplicate/sequential fetches, region latency, blur/compositing, render-blocking fonts — on **evidence** only; never present dev-mode timing as production.
4. Output a performance report (`.ai-workspace/templates/performance-report.md`). This is a track separate from UI work.
