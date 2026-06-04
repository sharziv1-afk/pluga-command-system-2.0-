@AGENTS.md

Project-specific notes:

- Use Next.js 16 `src/proxy.ts`, not `middleware.ts`.
- Keep Hebrew RTL intact.
- Keep the Light Gloss Command System as the primary design language.
- Do not run `npm audit fix --force`.
- Do not delete `AppContext` / localStorage demo state without dependency mapping.
- Tasks, Requests, and Events are all Supabase-backed with real RLS. Do not bypass RLS or use service role in client code.
- Migrations 001–007 were all run manually in Supabase. Do not re-run automatically. Migration 007 adds `"requests: creator update own"` policy.
- Dashboard is connected to real Supabase data (requests, tasks, events, audit_logs, users). Quick Create uses a fixed floating popover — not a heavy modal overlay. Textareas use `command-input min-h-24 resize-none`.
- Request Editing Phase 1 is live: creator or commander can edit title, description, category, priority, event_id. Metadata merge preserves `creator_name`, `creator_role`, `creator_unit`. Audit: `request_updated`.
- Event Editing Phase 1 is live: creator or commander can edit title, description, event_type, starts_at, ends_at, location, responsible_user_id. Editing a `completed` event to a future time auto-reopens it to `scheduled`. Audit: `event_updated`.
- Audit trail has 14 action types (added `request_updated`, `event_updated` in editing milestone).
- Read README.md, PROJECT_HANDOFF_AI_CONTEXT.md, and PROJECT_SUMMARY.md at the start of any session involving Requests, Tasks, or Schedule changes.