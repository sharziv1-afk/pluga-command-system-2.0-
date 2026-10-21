---
description: Implement an APPROVED plan — focused diff (write-enabled, implementation-engineer)
argument-hint: <approved plan reference>
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run the **IMPLEMENT** action for: $ARGUMENTS

1. Confirm an approved plan/brief exists. If not, stop and run `/plan` first.
2. Read `.ai-workspace/actions/implement.md` and `.ai-workspace/contracts/definition-of-done.md`.
3. Delegate to the **implementation-engineer** subagent (write-enabled, approved scope only; use a git worktree for parallel work).
4. Keep the diff minimal and within scope; preserve `AGENTS.md`/`CLAUDE.md` guardrails.
5. Run preflight (`tsc`/`lint`) and browser-verify UI changes. **No commit/push.** Stop and report the diff.
