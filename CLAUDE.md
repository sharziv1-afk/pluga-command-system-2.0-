@AGENTS.md

Project-specific notes for Claude Code:

- Read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and this file before making changes.
- Current branch should be `main`.
- Latest expected commit after the 2026-06-21 UI polish checkpoint:

```text
650353f Polish small dashboard forum and task UI issues
d33c401 Remove decorative empty state skeletons
2cb5f4e Ignore local Claude tooling in ESLint
f364cdf Show admin reference data load warning
0d967cd Sync auth admin approval checkpoint docs
9acd397 Prefill admin edit form from role with suggestions
7d52c40 Require real unit id during registration
f1a2d33 Block approving users without valid role and unit
c7b8cf1 Use OTP code flow for registration
21123d6 Fix magic link registration redirect
6996160 Fix registration role unit mapping
c03db56 Fix has_completed_onboarding after registration
c8c5884 Sync project docs after profile lookup hotfixes
73ed3a5 Fix ambiguous user unit lookups across protected pages
```

- Auth/Admin approval flow is OTP-code-only registration (no magic-link placeholders), `has_completed_onboarding=true` at registration, role→unit mapping at registration, pending users see "ממתין לאישור מ״פ", Admin prefills role (gershayim-normalized) and suggests מסגרת/יחידה בפיקוד/רמת הרשאה by role, and an Admin guardrail blocks approval without a valid role + unit.
- Migration `014_reference_data_read_policies.sql` adds `units: public read` + `roles: public read` SELECT policies. Applied manually in live Supabase on 2026-06-19 (the unit/role dropdowns were empty because RLS was enabled without a read policy). Recorded for sync; do not rerun blindly.
- Commit `650353f` closed small QA UI fixes: Dashboard activity translation keys, Tasks empty-state hiding while create form is open, and Forum regular post `ערוך` button min-width.
- Forum Daily Owner Mapping Diagnosis (2026-06-21): structural platoon slots are static placeholders without `ownerUserId`/`unitId`; existing reports fall under "existing reports". The next recommended fix is a UI-only owner/slot matching layer before DB/RLS work.

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
- Do not remove the Forum daily "existing reports" fallback until legacy/unmatched reports are understood.
- Do not start Forum daily repair with DB population/RLS. First implement slot matching in UI and verify with Chrome QA.
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
- Forum daily structural slots do not yet auto-match existing reports by owner/unit; Sgan Shuli / MM 1 / Platoon 1 currently appears under "existing reports" instead of the Platoon 1 summary slot.
- WhatsApp preview is generated from `dailyReports`, not the full mapped slot list, so empty platoons may be omitted.
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
Step 1 - Sync docs with 013 + cleanup + hotfix milestones - DONE
Step 2 - Forum daily UI-only owner/slot matching layer - NEXT
Step 3 - WhatsApp preview from mapped slots/platoons
Step 4 - Remove dev-facing daily forum text + confirm destructive delete
Step 5 - Real Users QA setup
Step 6 - Forum wiring to commanded_unit_id
Step 7 - Hierarchical RLS policies
Step 8 - Full MK -> MM -> MP QA
Step 9 - UI/mobile conservative polish
```
