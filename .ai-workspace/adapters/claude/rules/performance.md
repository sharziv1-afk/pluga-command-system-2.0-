# Rule: Performance

- Treat performance as a **separate track** from visual/UI work — don't bundle risky perf refactors into a UI batch.
- Root causes to watch: client-side data waterfalls (all-client pages), duplicate/sequential Supabase fetches, DB region latency, blocking profile/auth chains, heavy blur/compositing, render-blocking fonts.
- Optimize on **evidence** (network waterfall, Performance API, render cost) — never speculatively.
- Never present dev-mode timing (StrictMode double-invoke, uncached compiles) as production truth.
- Keep skeletons/perceived-speed affordances; move blocking work server-side (RSC/Server Actions) only via an approved plan.

Canonical source: [`playbooks/performance-flow.md`](../../../playbooks/performance-flow.md).
