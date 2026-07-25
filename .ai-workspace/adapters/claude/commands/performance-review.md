---
description: Performance review — waterfalls, N+1, render cost (read-only, security-performance-reviewer)
argument-hint: [route or flow]
---
Run the **PERFORMANCE** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/performance.md` and `.ai-workspace/playbooks/performance-flow.md`.
2. Delegate to the **security-performance-reviewer** subagent (read-only; Browser for evidence).
3. Identify client waterfalls, duplicate/sequential fetches, region latency, blur/compositing, render-blocking fonts — on **evidence** only; never present dev-mode timing as production.
4. Output a performance report (`.ai-workspace/templates/performance-report.md`). This is a track separate from UI work.
