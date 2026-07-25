---
description: Independent code review of the diff (read-only, code-reviewer)
argument-hint: [diff scope]
---
Run the **REVIEW** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/review.md` and `.ai-workspace/contracts/definition-of-done.md`.
2. Delegate to the **code-reviewer** subagent (read-only; `git diff` inspection).
3. Review for correctness, security, performance and guardrail compliance; rank findings by severity with file:line evidence and a concrete failure scenario.
4. Do NOT fix the findings. Output a review report (`.ai-workspace/templates/review-report.md`).
