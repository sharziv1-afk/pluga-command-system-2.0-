@AGENTS.md

Project-specific notes for Claude Code:

- Read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and this file before making changes.
- Current branch should be `main`.
- Latest expected commit after the forum UX milestone:

```text
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
- Do not touch Auth callback, proxy, Supabase schema, or migrations unless the task explicitly requires it.
- Audit actions are best-effort and must not block workflows.
- Commit and push only with explicit user approval.

## Current Product State

- Dashboard: Supabase summaries + Quick Create.
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

## Forum Limitations

- Full MK -> MM -> MP flow requires real mapped users for every role/platoon/squad.
- Unit hierarchy mapping is not complete.
- Some forum visibility is UI-gated.
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

1. Real users QA setup for MK/MM/MP/staff roles.
2. DB hierarchy mapping design.
3. Additive RLS migration for real hierarchy visibility.
4. Full operational QA.
5. Product expansion: notifications/SLA, attachments, calendar/recurring events, deployment hardening.
