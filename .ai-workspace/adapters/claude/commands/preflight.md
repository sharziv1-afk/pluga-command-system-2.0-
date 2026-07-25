---
description: Run the local quality gate (tsc/lint/build) via the workspace runner
argument-hint: [quick|full|report-only]
---
Run **preflight** (do not delegate to a subagent — this is a local runner):

```
.\.ai-workspace\bin\ai.cmd preflight -Mode ${ARGUMENTS:-report-only}
```

- `report-only` (default) lists the gates without executing.
- `quick` runs `git diff --check` + `lint` + `tsc --noEmit`.
- `full` also runs `next build`.

Report results faithfully; separate project-source warnings from vendored-skill warnings. Do not claim a gate passed unless it actually ran.
