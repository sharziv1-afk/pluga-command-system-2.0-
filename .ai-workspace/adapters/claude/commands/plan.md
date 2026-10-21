---
description: Plan a change — scoped brief + implementation plan (read-only, product-planner)
argument-hint: <what to plan>
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run the **PLAN** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/plan.md` and `.ai-workspace/contracts/definition-of-ready.md`.
2. Delegate to the **product-planner** subagent (read-only).
3. Output a task brief + implementation plan using `.ai-workspace/templates/task-brief.md` + `implementation-plan.md`.
4. Do NOT write code. Stop and present the plan for approval.
