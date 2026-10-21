# Rule: Performance

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


- Treat performance as a **separate track** from visual/UI work — don't bundle risky perf refactors into a UI batch.
- Root causes to watch: client-side data waterfalls (all-client pages), duplicate/sequential Supabase fetches, DB region latency, blocking profile/auth chains, heavy blur/compositing, render-blocking fonts.
- Optimize on **evidence** (network waterfall, Performance API, render cost) — never speculatively.
- Never present dev-mode timing (StrictMode double-invoke, uncached compiles) as production truth.
- Keep skeletons/perceived-speed affordances; move blocking work server-side (RSC/Server Actions) only via an approved plan.

Canonical source: [`playbooks/performance-flow.md`](../../../playbooks/performance-flow.md).
