---
description: Draft a Notion update locally (never writes to Notion without explicit approval)
argument-hint: [what to update]
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run the **SYNC-NOTION** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/sync-notion.md` and `.ai-workspace/contracts/notion-sync-policy.md`.
2. Generate a local Notion-update draft only:

```
.\.ai-workspace\bin\ai.cmd sync-notion
```

3. Fill `.ai-workspace/templates/notion-update.md` with the proposed changes (07 Design System / 04 Roadmap / 09 Checkpoints etc.).
4. **Do NOT write to Notion** unless the user explicitly instructs it. The repo wins on "what is implemented"; Notion holds vision/roadmap/guardrails.
