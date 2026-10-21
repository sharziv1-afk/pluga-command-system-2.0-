---
description: Independent code review of the diff (read-only, code-reviewer)
argument-hint: [diff scope]
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run the **REVIEW** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/review.md` and `.ai-workspace/contracts/definition-of-done.md`.
2. Delegate to the **code-reviewer** subagent (read-only; `git diff` inspection).
3. Review for correctness, security, performance and guardrail compliance; rank findings by severity with file:line evidence and a concrete failure scenario.
4. Do NOT fix the findings. Output a review report (`.ai-workspace/templates/review-report.md`).
