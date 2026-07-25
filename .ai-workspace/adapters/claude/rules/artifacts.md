# Rule: Artifacts & Local Output

- Write run outputs, reports, screenshots and drafts to the git-ignored runtime dirs under `.ai-workspace/` (`runs/`, `artifacts/`, `screenshots/`, `logs/`, `tmp/`, `state/`).
- Do not create reports/memory/artifacts under `src/` or anywhere tracked as product code.
- Never publish sensitive/operational content to a public artifact service; this project is Restricted. Prefer local files.
- Screenshots must exclude personal/medical/operational data — use QA/demo data only.
- Temp/log files go under the workspace runtime dirs or the session scratchpad — outside the repo when the task requires "no repo artifacts".

Canonical source: [`contracts/artifact-policy.md`](../../../contracts/artifact-policy.md), [`contracts/context-policy.md`](../../../contracts/context-policy.md).
