# Rule: Frontend / UI

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->


- Preserve **Hebrew RTL** everywhere (layouts, forms, nav, mobile).
- Keep the **Light Gloss Operational** identity: light background `#F6F7F9`, orange brand `#FF6B02` (use the accessible `--action` token for interactive controls), teal `#0F766E`, dark text `#020108`. No dark/HUD/tactical/neon, no heavy glass/blur.
- Use the canonical design tokens in `src/app/globals.css` and the shared primitives in `src/components/ui/**`; don't hardcode new raw hex.
- Keep the accessibility baseline: 44px touch targets, 16px mobile inputs, `focus-visible`, labels on form controls, `prefers-reduced-motion`.
- Motion is minimal/purposeful (CSS + native View Transitions); no animation-library dependency.
- Do not swap frameworks or copy external component libraries as-is.

Canonical source: [`playbooks/ui-redesign-flow.md`](../../../playbooks/ui-redesign-flow.md), `AGENTS.md` guardrails.
