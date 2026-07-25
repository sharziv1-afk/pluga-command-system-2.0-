---
description: Root-cause a runtime/build/env issue (read + diagnostics, runtime-debugger)
argument-hint: <symptom / repro>
---
Run the **DEBUG** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/run.md` and `.ai-workspace/playbooks/bug-flow.md`.
2. Delegate to the **runtime-debugger** subagent (Read + diagnostic Bash + Browser; no Write).
3. Reproduce, gather evidence (logs/console/network), prove the root cause, classify it, and propose a minimal fix.
4. Do NOT apply the fix. Stop and present the root-cause report; hand implementation to `/implement`.
