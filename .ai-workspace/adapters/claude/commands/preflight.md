---
description: Run the local quality gate (tsc/lint/build) via the workspace runner
argument-hint: [quick|full|report-only]
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run **preflight** (do not delegate to a subagent — this is a local runner):

```
.\.ai-workspace\bin\ai.cmd preflight -Mode ${ARGUMENTS:-report-only}
```

- `report-only` (default) lists the gates without executing.
- `quick` runs `git diff --check` + `lint` + `tsc --noEmit`.
- `full` also runs `next build`.

Report results faithfully; separate project-source warnings from vendored-skill warnings. Do not claim a gate passed unless it actually ran.
