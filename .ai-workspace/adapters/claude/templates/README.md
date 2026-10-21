# Templates (pointer)

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


The Claude adapter does **not** duplicate output templates. All agents and commands
reference the shared, canonical templates in [`.ai-workspace/templates/`](../../../templates/):

- `task-brief.md`, `implementation-plan.md`
- `design-brief.md`
- `qa-report.md`, `review-report.md`
- `security-report.md`, `performance-report.md`
- `handoff-report.md`, `notion-update.md`

The `ai.cmd <action>` runner already copies the right template into each run directory
under `.ai-workspace/runs/` (git-ignored). Keeping one template set avoids drift.
