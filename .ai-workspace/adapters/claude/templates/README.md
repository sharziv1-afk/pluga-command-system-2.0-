# Templates (pointer)

The Claude adapter does **not** duplicate output templates. All agents and commands
reference the shared, canonical templates in [`.ai-workspace/templates/`](../../../templates/):

- `task-brief.md`, `implementation-plan.md`
- `design-brief.md`
- `qa-report.md`, `review-report.md`
- `security-report.md`, `performance-report.md`
- `handoff-report.md`, `notion-update.md`

The `ai.cmd <action>` runner already copies the right template into each run directory
under `.ai-workspace/runs/` (git-ignored). Keeping one template set avoids drift.
