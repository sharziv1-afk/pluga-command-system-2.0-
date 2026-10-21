---
description: Security review — Auth/RLS/ownership/tenant (read-only, security-performance-reviewer)
argument-hint: [scope]
---

<!-- Current project state (2026-10-21): production is on cb8458e4dcb9f7f8cfb50d4726b423792e990fce (Ready); active modules are /dashboard and /forum. This file is a historical/process reference where applicable. See [../../../../WORKSPACE_MODE.md](../../../../WORKSPACE_MODE.md) for the current state and safe reactivation procedure. -->

Run the **SECURITY** action for: $ARGUMENTS

1. Read `.ai-workspace/actions/security.md`, `.ai-workspace/contracts/security-policy.md`, `.ai-workspace/playbooks/auth-rls-flow.md`.
2. Delegate to the **security-performance-reviewer** subagent (read-only; Supabase read-only inspection; never run SQL/migrations; never print secrets).
3. Review RLS gaps, ownership leaks (`created_by`≠`owner_user_id`), service-role misuse, `src/proxy.ts` gate.
4. Output a security report (`.ai-workspace/templates/security-report.md`) with evidence + impact.
