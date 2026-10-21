---
description: Assemble a handoff report + Notion-update draft (read-only, release-handoff-manager)
argument-hint: [batch name]
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run the **HANDOFF** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/handoff.md`, `.ai-workspace/contracts/definition-of-done.md`, `notion-sync-policy.md`.
2. Delegate to the **release-handoff-manager** subagent (read-only + safe git reads).
3. Produce a handoff report (`.ai-workspace/templates/handoff-report.md`) + a Notion-update **draft** (`templates/notion-update.md`, saved locally only), separating pre-existing changes from this batch.
4. **No commit/push/deploy. No Notion writes.** Wait for explicit human approval.
