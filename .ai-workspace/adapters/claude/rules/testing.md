# Rule: Testing & Preflight

- No test framework is installed; do not add one as a side effect of a task.
- The quality gate is **preflight**: `tsc --noEmit`, `eslint`, and (for report/full) `next build`.
  Run it via `.\.ai-workspace\bin\ai.cmd preflight -Mode <quick|full|report-only>`.
- Separate project-source lint warnings from vendored-skill warnings (e.g. `impeccable/.../modern-screenshot.umd.js`).
- For UI-observable changes, verify in the browser (Dev Login) before claiming done.
- Never present a build/test as passing unless it was actually run.

Canonical source: [`contracts/qa-gates.md`](../../../contracts/qa-gates.md), [`playbooks/qa-flow.md`](../../../playbooks/qa-flow.md).
