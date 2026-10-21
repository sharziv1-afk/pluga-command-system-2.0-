---
description: Root-cause a runtime/build/env issue (read + diagnostics, runtime-debugger)
argument-hint: <symptom / repro>
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run the **DEBUG** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/run.md` and `.ai-workspace/playbooks/bug-flow.md`.
2. Delegate to the **runtime-debugger** subagent (Read + diagnostic Bash + Browser; no Write).
3. Reproduce, gather evidence (logs/console/network), prove the root cause, classify it, and propose a minimal fix.
4. Do NOT apply the fix. Stop and present the root-cause report; hand implementation to `/implement`.
