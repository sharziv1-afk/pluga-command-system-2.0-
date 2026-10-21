---
description: Audit a screen/component and produce a design brief (read-only, ui-ux-designer)
argument-hint: <screen or component>
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run the **DESIGN** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/design.md` and `.ai-workspace/playbooks/ui-redesign-flow.md`.
2. Delegate to the **ui-ux-designer** subagent (read-only; Browser + design skills for research only).
3. Output a design brief (`.ai-workspace/templates/design-brief.md`) with a Preserve/Refine/Refactor/Redesign matrix, RTL/responsive/a11y notes, evidence-based.
4. Do NOT change code. Stop and present the brief.
