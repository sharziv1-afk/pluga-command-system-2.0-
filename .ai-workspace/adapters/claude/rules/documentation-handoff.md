# Rule: Documentation & Handoff

<!-- Workspace guide: [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


- End a significant batch with a handoff report (`.ai-workspace/templates/handoff-report.md`): what changed, what's verified, what remains, exact next step.
- Notion is for vision/roadmap/guardrails; the repo wins on "what is actually implemented". **Never write to Notion without an explicit instruction** — prepare a draft (`templates/notion-update.md`) only.
- Keep `CLAUDE.md` concise: it points to `AGENTS.md` and `.ai-workspace/`; it is not a dumping ground.
- Report outcomes faithfully — failing tests, skipped steps and unverified claims must be stated plainly.
- Separate, in every handoff: pre-existing changes vs. this batch's changes.

Canonical source: [`contracts/notion-sync-policy.md`](../../../contracts/notion-sync-policy.md), [`playbooks/release-flow.md`](../../../playbooks/release-flow.md).
