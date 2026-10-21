---
description: Draft a Notion update locally (never writes to Notion without explicit approval)
argument-hint: [what to update]
---

<!-- Workspace guide: [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->

Run the **SYNC-NOTION** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/sync-notion.md` and `.ai-workspace/contracts/notion-sync-policy.md`.
2. Generate a local Notion-update draft only:

```
.\.ai-workspace\bin\ai.cmd sync-notion
```

3. Fill `.ai-workspace/templates/notion-update.md` with the proposed changes (07 Design System / 04 Roadmap / 09 Checkpoints etc.).
4. **Do NOT write to Notion** unless the user explicitly instructs it. The repo wins on "what is implemented"; Notion holds vision/roadmap/guardrails.
