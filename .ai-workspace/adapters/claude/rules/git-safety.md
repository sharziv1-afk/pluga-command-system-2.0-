# Rule: Git Safety

<!-- Workspace guide: [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) describes the current active modules, deployment verification, QA limits, and safe reactivation procedure. This file remains a historical/process reference where applicable. -->


- **Never** `commit` or `push` without explicit human approval.
- Never `git reset --hard`, `git clean -fd`, force-push, or rewrite history.
- Do not change git configuration.
- Do product work on a feature branch, never directly on `main`.
- Preserve pre-existing uncommitted changes — never overwrite or "fix" another author's work-in-progress.
- The PreToolUse hook warns/blocks destructive git; treat a blocked call as a stop signal, not a retry.

Canonical source: [`contracts/git-safety.md`](../../../contracts/git-safety.md).
