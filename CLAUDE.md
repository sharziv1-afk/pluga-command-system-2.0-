@AGENTS.md

Project-specific notes for Claude Code:

- Read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and this file before making changes.
- Current branch should be `main`.
- Latest expected commit after the 2026-06-27 Tracking Module Phase 1+2 checkpoint:

```text
16da109 Add Tracking status cycling and soft delete controls
334fec7 Add Tracking CRUD phase one
f2be781 Add Tracking module schema, RLS, and read-only skeleton page
a35ec03 Document forum daily layout checkpoint and tracking next steps
1d37472 Simplify forum daily report layout and density
788cd0d Polish interface density and dashboard command brief
890da65 Polish user-facing empty states and system copy
d6e5932 Document forum daily carry forward
c991be2 Carry forward closed forum daily reports
813ef48 Document forum daily scroll checkpoint
62fd8fe Scroll forum daily slot selections into view
1c7414c Map forum daily platoon owners to structural slots
9c49135 Document forum daily mapping diagnosis
650353f Polish small dashboard forum and task UI issues
```

(A docs-only checkpoint commit "Document Tracking checkpoint and restart handoff" may sit on top of `16da109` once this checkpoint is committed; the latest *code* commit stays `16da109`.)

- Auth/Admin approval flow is OTP-code-only registration (no magic-link placeholders), `has_completed_onboarding=true` at registration, role→unit mapping at registration, pending users see "ממתין לאישור מ״פ", Admin prefills role (gershayim-normalized) and suggests מסגרת/יחידה בפיקוד/רמת הרשאה by role, and an Admin guardrail blocks approval without a valid role + unit.
- Migration `014_reference_data_read_policies.sql` adds `units: public read` + `roles: public read` SELECT policies. Applied manually in live Supabase on 2026-06-19 (the unit/role dropdowns were empty because RLS was enabled without a read policy). Recorded for sync; do not rerun blindly.
- Commit `650353f` closed small QA UI fixes: Dashboard activity translation keys, Tasks empty-state hiding while create form is open, and Forum regular post `ערוך` button min-width.
- Forum Daily owner mapping + scroll (2026-06-21, `1c7414c` + `62fd8fe`): the UI-only owner/slot matching layer is implemented. Structural platoon summary slots are enriched from active/approved owners (match requires role מ״מ N + unit מחלקה N); a matched slot gets `ownerUserId`/`unitId` and is filtered out of "דוחות קיימים", so סגן שולי / מ״מ 1 / מחלקה 1 now shows under "מחלקה 1 · סיכום מ״מ" only. Platoons 2-4 stay unmapped without a matching user; the "דוחות קיימים" fallback is preserved. Slot clicks scroll the report panel into view (`scrollIntoView({ block: 'nearest' })`) for sub-XL/single-column.
- Forum Daily Auto Carry Forward (2026-06-23, `c991be2`): closing a report (`status='closed'`) auto-creates a next-Jerusalem-day **draft** for the same owner/level/unit, copying `content` + `summary_text`, with `metadata.carried_forward_from_*` and audit action `forum_daily_report_carried_forward`. Plain `insert` (no upsert); duplicate `23505` skipped silently; rollover is fire-and-forget best-effort and never blocks/fails the close. The historical closed report is preserved (reopen still edits it, not tomorrow's draft). The native `window.confirm` was removed from report close only (delete/reset confirms unchanged). No DB/SQL/RLS changes — relies on existing 010 J2 + 011 insert policies; if `42501` ever appears on the rollover insert, stop and verify 011.
- Forum Daily Phase A — layout/density (2026-06-24, `1d37472`): UI-only, single file (`forum/page.tsx`). Manpower (`מצבת חיילים`) is a full-width central card; edit mode shows a live large `נוכחים/סד״כ` ratio above the same `present_count`/`total_count` inputs (placeholder `0`, no schema change). Primary fields are a 2-col desktop / 1-col mobile grid; secondary/reflection fields moved into a collapsible "פרטים נוספים ▾ / הסתר פרטים ▴" section, auto-open when it has content. Action bar wraps correctly to 390px. Lint/tsc/build green; Chrome-QA'd at 1117/768/500/390px, no blocking issues (minor non-blocking polish only: date input tight at 390px, disclosure glyph small). Did not touch rollover/carry-forward, WhatsApp generation, date navigation, slot matching, owner mapping, audit, or Supabase queries/mutations.
- **Tracking Module — Phase 1+2 IMPLEMENTED (2026-06-27, `f2be781` + `334fec7` + `16da109`):** the spreadsheet-style module is live. `/tracking` is a protected route with a "מעקב" nav item; tables `soldiers`/`tracking_items`/`tracking_records` exist in production with RLS (migration `015_tracking_mvp.sql`, applied manually). Helpers `current_app_user_id` / `current_tracking_unit_id` / `is_tracking_commander` / `can_edit_tracking_unit` use the real `public.users` columns (`role`/`name`/`status`/`role_approval_status`/`unit_id`/`commanded_unit_id`); ע. מ"פ gets Tracking-scoped full access via `is_tracking_commander` (the global `public.is_commander` was not changed). UI (`src/app/(protected)/tracking/page.tsx`): add soldier, add tracking item, soldiers×items spreadsheet, click-to-cycle cell status (`ריק → עבר → לא עבר → השלמה`; first click on an empty cell inserts a record with `status='passed'`), soft delete (`is_active=false`) for soldiers/items via an in-app confirm modal (no `window.confirm`). CSV export is a disabled placeholder; note editing and filters are not implemented. Audit actions `tracking_soldier_created/updated`, `tracking_item_created/updated`, `tracking_record_updated`, `tracking_exported_csv` (reserved) are in `src/lib/audit.ts`. QA: lint/tsc/build green; Claude reviews A; connected Browser QA A for CRUD Phase 1 and Phase 2 (after modal fix). **QA data left in production (do not delete without approval):** soldier `QA Cycling Test 001`, item `בוחן מסלול`, one `tracking_record` status `עבר`. **Tracking Phase 3 (CSV, note editing, filters, double-click/debounce, dbProfile attribution, write timeout, role-based UI gating, QA-data cleanup) is NOT started — do not start it without explicit approval.** Immediate next steps: verify Vercel deployment, decide on the QA data. Next recommended Forum tasks (UI/text polish, no DB/RLS, lower priority): remove dev-facing "UI-gated..." text; WhatsApp preview grammar + empty platoons; missing fields (לו״ז מחר, חריגים/פערים); labels/placeholders/lifecycle polish.

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
Step 2 - Forum daily UI-only owner/slot matching layer - DONE in 1c7414c
Step 2b - Forum daily slot-click scroll-into-view (sub-XL panel visibility) - DONE in 62fd8fe
Step 2c - Carry Forward / Rollover ("create a new day based on yesterday") - DONE in c991be2
Step 2d - Forum Daily Phase A (layout/density, UI-only) - DONE in 1d37472
Step 3 - WhatsApp preview from mapped slots/platoons
Step 4 - Remove dev-facing daily forum text + confirm destructive delete
Step 5 - Real Users QA setup
Step 6 - Forum wiring to commanded_unit_id
Step 7 - Hierarchical RLS policies
Step 8 - Full MK -> MM -> MP QA
Step 9 - UI/mobile conservative polish
```

## Tracking Module Roadmap

```text
Tracking Phase A - Product decisions locked (spreadsheet style, dedicated soldiers table, CSV-first export, initial status set) - DONE
Tracking Phase B - Technical Execution Plan (data model + RLS plan + open decisions) - DONE
Tracking Phase C - MVP implementation - DONE
  - C1 Schema + RLS + read-only skeleton - DONE in f2be781 (migration 015_tracking_mvp.sql)
  - C2 CRUD Phase 1 (add soldier, add tracking item, table) - DONE in 334fec7
  - C3 Phase 2 (cell status cycling + soft delete + in-app confirm modal) - DONE in 16da109
Tracking Phase 3 - candidates (NOT started, require approval): CSV export, cell note editing, filters,
  double-click/debounce, dbProfile attribution, write timeout, role-based UI gating, QA-data cleanup
```
