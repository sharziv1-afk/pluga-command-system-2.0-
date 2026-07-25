# Rule: Supabase & Security

- **SQL is manual-only.** Propose SQL/migrations; never auto-run them. Prefer additive migrations; do not rerun 013/014/015.
- Do not change schema, RLS, Auth behavior, or the `src/proxy.ts` gate without explicit planning + a snapshot.
- Never put a service-role key in client code; never expose secrets/keys/tokens.
- Preserve ownership invariants: `created_by` (actor) ≠ `owner_user_id` (owner); forum platoon assignment by owner/role/unit, never by array index.
- `users.unit_id` and `users.commanded_unit_id` both reference `units` — load units separately, don't embed.
- Audit actions are best-effort (`void createAuditLog(...)`) — never blocking.
- Supabase MCP is **read-only inspection** for agents; no mutations/migrations.

Canonical source: [`contracts/security-policy.md`](../../../contracts/security-policy.md), [`playbooks/auth-rls-flow.md`](../../../playbooks/auth-rls-flow.md), `AGENTS.md`.
