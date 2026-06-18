@AGENTS.md

Project-specific notes for Claude Code:

- Read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and this file before making changes.
- Current branch should be `main`.
- Latest expected commit after the profile lookup hotfixes:

```text
73ed3a5 Fix ambiguous user unit lookups across protected pages
717bcc9 Fix dashboard profile lookup and add password reset flow
96ae49b Remove orphaned legacy prototype shell and split session context
5b5adc5 Fix admin commanded unit mapping
7b8050f Add commanded unit assignment to admin panel
96dc36e Update project handoff after forum UX milestone
2dfcff7 Polish forum UX and update handoff docs
f5c1e40 Add hierarchical forum daily reports
f47812b Add Supabase-backed Forum Phase 1
```

## Non-negotiable Guardrails

- Use Next.js 16 `src/proxy.ts`, not `middleware.ts`.
- Keep Hebrew RTL intact.
- Keep the Light Gloss Command System as the primary design language.
- Do not run `npm audit fix --force`.
- Do not delete `AppContext` / localStorage demo state without dependency mapping.
- Tasks, Requests, Events, and Forum are Supabase-backed with real RLS. Do not bypass RLS or use service role in client code.
- SQL is manual only. Do not run SQL automatically.
- Prefer additive migrations. Do not rewrite old migrations that may have run.
- Migration 013 adds `users.commanded_unit_id` as foundation only. It was reportedly run manually; do not rerun without a direct reason.
- `users.unit_id` and `users.commanded_unit_id` both reference `units`; do not embed `units(...)` from `users`. Load units separately and map client-side.
- Do not touch Auth callback, proxy, Supabase schema, or migrations unless the task explicitly requires it.
- Audit actions are best-effort and must not block workflows.
- Commit and push only with explicit user approval.

## Current Product State

- Dashboard: Supabase summaries + Quick Create.
- Auth: existing login, OTP registration, Dev Login in development, Magic Link fallback, and Forgot Password through `/reset-password`.
- Admin: role/unit/permission management plus commanded-unit assignment through `commanded_unit_id`.
- Requests: full workflow, event link, edit Phase 1, closed deletion.
- Tasks: Supabase-backed, edit Phase 1, event link, closed deletion, quick filter chips.
- Schedule: events, timeline/week grid, auto-complete, edit Phase 1, linked tasks/requests, copy tomorrow schedule.
- Forum posts: `forum_posts`, create/edit/pin, RLS, audit.
- Forum daily reports: `forum_daily_reports`, fixed slots, read-view card, edit mode, date picker, safe draft creation, create-for-subordinate, submit/return/approve-close/reopen, reset, advanced delete, WhatsApp short/detailed.

## Forum Migrations

- `008_forum_rls.sql` - Forum Phase 1 posts.
- `009_forum_daily_summaries.sql` - legacy/prototype, do not build on it.
- `010_forum_hierarchical_daily_reports.sql` - current hierarchical forum model.
- `011_forum_daily_reports_commander_insert.sql` - commander create-for-subordinate.
- `012_forum_daily_reports_delete_policy.sql` - advanced delete policy.
- `013_add_commanded_unit_id.sql` - `users.commanded_unit_id` + index; foundation only.

## Forum Limitations

- Full MK -> MM -> MP flow requires real mapped users for every role/platoon/squad.
- Unit hierarchy mapping is not complete.
- Some forum visibility is UI-gated.
- Forum is not yet wired to `commanded_unit_id`.
- Real hierarchy RLS is a future phase.
- The reference demo `https://thepluton.vercel.app/` is UX inspiration only, not schema or permissions truth.

## Audit Actions Added by Forum Work

```text
forum_post_created
forum_post_updated
forum_daily_summary_created
forum_daily_summary_updated
forum_daily_summary_closed
forum_daily_report_created
forum_daily_report_updated
forum_daily_report_submitted
forum_daily_report_closed
forum_daily_report_reopened
forum_daily_report_deleted
forum_daily_report_reset
```

## Recommended Next Work

```text
Step 0 - Cleanup orphaned legacy prototype shell - DONE in 96ae49b
Hotfix A - Password reset + Dashboard profile lookup - DONE in 717bcc9
Hotfix B - Global users/units ambiguity fix - DONE in 73ed3a5
Step 1 - Sync docs with 013 + cleanup + hotfix milestones - CURRENT
Step 2 - Real Users QA setup
Step 3 - Forum wiring to commanded_unit_id
Step 4 - Hierarchical RLS policies
Step 5 - Full MK -> MM -> MP QA
Step 6 - UI/mobile conservative polish
Step 7 - dashboard / command center polish
```
