---
description: Plan a change — scoped brief + implementation plan (read-only, product-planner)
argument-hint: <what to plan>
---

<!-- Workspace guide: [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->

Run the **PLAN** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/plan.md` and `.ai-workspace/contracts/definition-of-ready.md`.
2. Delegate to the **product-planner** subagent (read-only).
3. Output a task brief + implementation plan using `.ai-workspace/templates/task-brief.md` + `implementation-plan.md`.
4. Do NOT write code. Stop and present the plan for approval.
