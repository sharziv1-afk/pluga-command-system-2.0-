# Rule: Git Safety

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


- **Never** `commit` or `push` without explicit human approval.
- Never `git reset --hard`, `git clean -fd`, force-push, or rewrite history.
- Do not change git configuration.
- Do product work on a feature branch, never directly on `main`.
- Preserve pre-existing uncommitted changes — never overwrite or "fix" another author's work-in-progress.
- The PreToolUse hook warns/blocks destructive git; treat a blocked call as a stop signal, not a retry.

Canonical source: [`contracts/git-safety.md`](../../../contracts/git-safety.md).
