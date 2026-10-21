# Rule: Artifacts & Local Output

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


- Write run outputs, reports, screenshots and drafts to the git-ignored runtime dirs under `.ai-workspace/` (`runs/`, `artifacts/`, `screenshots/`, `logs/`, `tmp/`, `state/`).
- Do not create reports/memory/artifacts under `src/` or anywhere tracked as product code.
- Never publish sensitive/operational content to a public artifact service; this project is Restricted. Prefer local files.
- Screenshots must exclude personal/medical/operational data — use QA/demo data only.
- Temp/log files go under the workspace runtime dirs or the session scratchpad — outside the repo when the task requires "no repo artifacts".

Canonical source: [`contracts/artifact-policy.md`](../../../contracts/artifact-policy.md), [`contracts/context-policy.md`](../../../contracts/context-policy.md).
