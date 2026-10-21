# Rule: Testing & Preflight

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


- No test framework is installed; do not add one as a side effect of a task.
- The quality gate is **preflight**: `tsc --noEmit`, `eslint`, and (for report/full) `next build`.
  Run it via `.\.ai-workspace\bin\ai.cmd preflight -Mode <quick|full|report-only>`.
- Separate project-source lint warnings from vendored-skill warnings (e.g. `impeccable/.../modern-screenshot.umd.js`).
- For UI-observable changes, verify in the browser (Dev Login) before claiming done.
- Never present a build/test as passing unless it was actually run.

Canonical source: [`contracts/qa-gates.md`](../../../contracts/qa-gates.md), [`playbooks/qa-flow.md`](../../../playbooks/qa-flow.md).
