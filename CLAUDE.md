@AGENTS.md

## Current State (2026-09-06)

- **In real daily use.** The מ״פ signs in from his phone daily against `vmfihyritfmjycrfpxjn`. Its data is production data.
- **`ENVIRONMENTS.md` decides which database is which — read it before touching either.** The Supabase project *names* are backwards: `hamifkad-staging` (`vmfihyritfmjycrfpxjn`) is the LIVE system, and `pluga-command-system` (`hjltpajvqhnygjybtivd`) is an empty abandoned shell being repurposed as the sandbox. Trust the ref, not the label.
- Never deployed to Vercel. A launch-readiness plan is approved and in progress.
- **Two standing approval gates set by the user:** any *design* change and any *Vercel* action must be presented and approved step by step, one screen / one step at a time. Everything else follows the normal loop (implement → `npm run check` → CRLF scan → browser QA → independent review → commit).
- `AI_HANDOFF_CHECKPOINT.md` is the most accurate doc here. `docs/archive/README_HISTORY.md`, `docs/archive/PROJECT_SUMMARY.md` and `docs/archive/PROJECT_HANDOFF_AI_CONTEXT.md` are retired checkpoint history — believe the checkpoint over them.
- Last completed work: **Phases 1-6 plus four audit cycles.** Phase 2 (design system: DESIGN.md, semantic tokens, type scale, every hand-rolled modal on `CommandOverlay`, shared status/priority labels), Phase 3 (iPhone: `viewport-fit: cover` + safe areas, real PNG icons, service-worker fixes, touch targets, bottom-sheet dialogs on phones, iOS install hint), Phase 4 (security headers + CSP, query ceilings with a visible truncation notice, `GapsPanel` code-split, forum's dead queries stopped), Phase 5 (one datetime module pinned to Asia/Jerusalem, one dbProfile adapter, dead files deleted, React compiler lint rules back on), Phase 6 (30 → 54 tests, each verified to fail on the bug it guards; CI now runs on push to main).
- Audit cycles after that found and fixed: ten writes that reported success without writing (RLS-denied `.delete()` returns HTTP 204 with no error — verified against the live API), no keyboard focus indicator anywhere in the app (Tailwind v4's ring utility only sets `--tw-ring-shadow` and nothing composed it into `box-shadow`, while `outline-none` had removed the browser default), 15 unlabelled form controls, and three findings from an independent Codex review (bulk-close reporting success on zero rows, a single-key in-flight guard in tracking, and date-key arithmetic that shifted a day below ~UTC-9).
- **Next: Phase 7 — Vercel.** Not started. This is one of the two standing approval gates: every step (project creation, env vars, first deploy, deployment protection, domain, monitoring) is presented and approved individually. The Staging-vs-Production decision is still open.
- Also open: eight iPhone/iPad checks that a desktop browser cannot make (`QA_CHECKLIST.md` §8.5) — `env(safe-area-inset-*)` is 0 in Chrome, so only the fallback was proven; three tables with RLS enabled and no policy (`approvals`, `feature_flags`, `onboarding_progress`), which need manual SQL; and the large-file splits, which wait on wider test coverage.

## Agentic Workspace (Claude Code)

1. Read `AGENTS.md` first; `.ai-workspace/` is the shared workflow source of truth (`ACTIONS.md`, `ROLE-MATRIX.md`, `WORKFLOW.md`, contracts, playbooks, templates).
2. The Claude config is canonical under `.ai-workspace/adapters/claude/` (tracked) and synced to the git-ignored `.claude/` via `.\.ai-workspace\bin\ai.cmd claude-sync` (`claude-status` / `claude-validate` / `claude-sync -DryRun`).
3. The **main session is the orchestrator**; use **Plan mode** for complex work and approve the plan before implementing.
4. Delegate isolated research, design, implementation, debugging, QA and independent review to the subagents in `.claude/agents/` (or `/plan`, `/design-audit`, `/implement`, `/debug`, `/qa`, `/review`, `/security-review`, `/performance-review`, `/preflight`, `/handoff`).
5. Never run two **writing** agents on the same files in parallel — isolate parallel writers in git worktrees (`/worktree`).
6. `/GOAL` and `/LOOP` are for long or complex tasks only.
7. **No commit/push without explicit approval.** **No Notion writes without an explicit instruction** (draft only).
8. Rules live in `.ai-workspace/adapters/claude/rules/`; end significant batches with independent review + handoff.

Project-specific notes for Claude Code:

- Read `AI_HANDOFF_CHECKPOINT.md` and `AGENTS.md` first. `docs/archive/` holds retired checkpoint history — use it for history, not for current state.
- Current branch should be `main`. Do not pin an "expected latest commit" here; it goes stale within a day. Run `git log --oneline -5`.
- The forum round's detail, invariants, QA checklist and risk matrix live in `FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`. Its six invariants still hold and are restated in `AGENTS.md`.

- Auth/Admin approval flow is OTP-code-only registration (no magic-link placeholders), `has_completed_onboarding=true` at registration, role→unit mapping at registration, pending users see "ממתין לאישור מ״פ", Admin prefills role (gershayim-normalized) and suggests מסגרת/יחידה בפיקוד/רמת הרשאה by role, and an Admin guardrail blocks approval without a valid role + unit.
- Migration `014_reference_data_read_policies.sql` adds `units: public read` + `roles: public read` SELECT policies. Applied manually in live Supabase on 2026-06-19 (the unit/role dropdowns were empty because RLS was enabled without a read policy). Recorded for sync; do not rerun blindly.
- Commit `650353f` closed small QA UI fixes: Dashboard activity translation keys, Tasks empty-state hiding while create form is open, and Forum regular post `ערוך` button min-width.
- Forum Daily owner mapping + scroll (2026-06-21, `1c7414c` + `62fd8fe`): the UI-only owner/slot matching layer is implemented. Structural platoon summary slots are enriched from active/approved owners (match requires role מ״מ N + unit מחלקה N); a matched slot gets `ownerUserId`/`unitId` and is filtered out of "דוחות קיימים", so סגן שולי / מ״מ 1 / מחלקה 1 now shows under "מחלקה 1 · סיכום מ״מ" only. Platoons 2-4 stay unmapped without a matching user; the "דוחות קיימים" fallback is preserved. Slot clicks scroll the report panel into view (`scrollIntoView({ block: 'nearest' })`) for sub-XL/single-column.
- Forum Daily Auto Carry Forward (2026-06-23, `c991be2`): closing a report (`status='closed'`) auto-creates a next-Jerusalem-day **draft** for the same owner/level/unit, copying `content` + `summary_text`, with `metadata.carried_forward_from_*` and audit action `forum_daily_report_carried_forward`. Plain `insert` (no upsert); duplicate `23505` skipped silently; rollover is fire-and-forget best-effort and never blocks/fails the close. The historical closed report is preserved (reopen still edits it, not tomorrow's draft). The native `window.confirm` was removed from report close only (delete/reset confirms unchanged). No DB/SQL/RLS changes — relies on existing 010 J2 + 011 insert policies; if `42501` ever appears on the rollover insert, stop and verify 011.
- Forum Daily Phase A — layout/density (2026-06-24, `1d37472`): UI-only, single file (`forum/page.tsx`). Manpower (`מצבת חיילים`) is a full-width central card; edit mode shows a live large `נוכחים/סד״כ` ratio above the same `present_count`/`total_count` inputs (placeholder `0`, no schema change). Primary fields are a 2-col desktop / 1-col mobile grid; secondary/reflection fields moved into a collapsible "פרטים נוספים ▾ / הסתר פרטים ▴" section, auto-open when it has content. Action bar wraps correctly to 390px. Lint/tsc/build green; Chrome-QA'd at 1117/768/500/390px, no blocking issues (minor non-blocking polish only: date input tight at 390px, disclosure glyph small). Did not touch rollover/carry-forward, WhatsApp generation, date navigation, slot matching, owner mapping, audit, or Supabase queries/mutations.
- **Tracking Module — Phase 1+2 IMPLEMENTED (2026-06-27, `f2be781` + `334fec7` + `16da109`):** the spreadsheet-style module is live. `/tracking` is a protected route with a "מעקב" nav item; tables `soldiers`/`tracking_items`/`tracking_records` exist in production with RLS (migration `015_tracking_mvp.sql`, applied manually). Helpers `current_app_user_id` / `current_tracking_unit_id` / `is_tracking_commander` / `can_edit_tracking_unit` use the real `public.users` columns (`role`/`name`/`status`/`role_approval_status`/`unit_id`/`commanded_unit_id`); ע. מ"פ gets Tracking-scoped full access via `is_tracking_commander` (the global `public.is_commander` was not changed). UI (`src/app/(protected)/tracking/page.tsx`): add soldier, add tracking item, soldiers×items spreadsheet, click-to-cycle cell status (`ריק → עבר → לא עבר → השלמה`; first click on an empty cell inserts a record with `status='passed'`), soft delete (`is_active=false`) for soldiers/items via an in-app confirm modal (no `window.confirm`). CSV export is a disabled placeholder; note editing and filters are not implemented. Audit actions `tracking_soldier_created/updated`, `tracking_item_created/updated`, `tracking_record_updated`, `tracking_exported_csv` (reserved) are in `src/lib/audit.ts`. QA: lint/tsc/build green; Claude reviews A; connected Browser QA A for CRUD Phase 1 and Phase 2 (after modal fix). **QA data left in production (do not delete without approval):** soldier `QA Cycling Test 001`, item `בוחן מסלול`, one `tracking_record` status `עבר`. **Tracking Phase 3 (CSV, note editing, filters, double-click/debounce, dbProfile attribution, write timeout, role-based UI gating, QA-data cleanup) is NOT started — do not start it without explicit approval.** Immediate next steps: verify Vercel deployment, decide on the QA data. Next recommended Forum tasks (UI/text polish, no DB/RLS, lower priority): remove dev-facing "UI-gated..." text; WhatsApp preview grammar + empty platoons; missing fields (לו״ז מחר, חריגים/פערים); labels/placeholders/lifecycle polish.
- **Forum Daily Structured Company Flow — COMPLETED (`cdcd99f`, round `c82492c`→`cdcd99f`, pushed):** the מ״פ report is now a **structured form** (not a free textarea) modeled on the מ״מ form (fields: מצבה, כוח אדם, כוננות, רפואה, ת״ש, בטיחות, משמעת, לוגיסטיקה, בקשות אישיות, רצוי/מצוי, רשת וידע, לקחים יומיים, פעולות להמשך, הערה אישית, דגשי מ״פ, לו״ז ודגשים להפצה). Aggregation is **deterministic** via `aggregateCompanyStructured()` in the pure module `src/lib/forum/companyReport.ts` (also `resolvePlatoonNumber`, `assignPlatoonReports`, `buildCompanyReport`); **no AI in the fixed flow** (AI only ever as an opt-in, explicitly-approved "improve wording" action). Platoon assignment is by `owner_user_id` + role/unit; `metadata.node_label` is a last-resort fallback only — **never by array index**. `created_by` (actor) is kept distinct from `owner_user_id` (report owner) on every insert. WhatsApp short/detailed previews (`generateWhatsappText` in `forum/page.tsx`) reuse the same `assignPlatoonReports`/`findPlatoonSummaryOwner` path so they cannot diverge from aggregation. `submitted`/`closed` are final; `draft`/`in_progress` enter aggregation tagged `[בטיפול — טרם הוגש סופית]`; missing = `[לא הוגש דוח]`. publish/close/reopen + read-only-after-close all work. New best-effort audit actions: `forum_company_report_saved`, `forum_daily_forum_published`, `forum_daily_report_carried_forward`. **QA passed (historical):** Full Structured Company Forum Flow QA on 2026-08-20 + Focused WhatsApp Preview QA after `cdcd99f` (aggregation 124/138 — **that fixture no longer exists in Staging; the current working baseline is `2026-09-08` = 128/138 from 34/36 + 31/34 + 30/33 + 33/35, and `tests/companyReport.test.mjs` now asserts it without needing live data**, מ״מ 3 tagged בטיפול, מ״מ 2 UPDATED after refresh, מחלקה 1/2/3/4 mapped, dashboard/tracking load, console clean, lint/tsc/build green). **Non-blocking open items:** (1) duplicate dynamic company node after saving the company report (`dailyNodes` filter at `forum/page.tsx:495–502` does not exclude `report_level==='company'`); (2) unsaved company draft resets on slot switch (`useEffect` at `forum/page.tsx:972–975`). Full detail + P0–P3 work plan + QA checklist + risk matrix: `FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`.

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
- **Forum Daily structured flow invariants (do not break without full QA — see `FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`):** the מ״פ report stays a structured form; aggregation stays deterministic (`aggregateCompanyStructured()`); no AI in the fixed flow (AI only as an opt-in, explicitly-approved action); platoon assignment is by `owner_user_id` + role/unit with `metadata.node_label` as last-resort fallback only and **never by array index**; `created_by` ≠ `owner_user_id`; WhatsApp preview must reuse the same `assignPlatoonReports` path as the aggregation; `submitted`/`closed` are final and read-only-after-close must hold.
- Audit actions are best-effort and must not block workflows.
- Commit and push only with explicit user approval.

## Current Product State

- Dashboard: Supabase summaries + Quick Create.
- **Auth: email OTP only — invite-only, no passwords.** No Dev Login, no Magic Link fallback, no `/reset-password`, no auth callback route. (Earlier revisions of this file claimed all four; none exist in `src/`.)
- Gaps (פערים): `gaps` table + `GapsPanel`, rendered as the second view mode inside `/requests`. Converts a gap to a logistics request.
- Mentoring (תיק חניכה): `mentoring_entries` + `/mentoring`, מ״פ only. Holds the commander's private notes on his direct reports — the most sensitive data in the app.
- Offline: read cache + author-locked write queue on `/tasks` and `/forum`, device PIN / biometric unlock. See `AGENTS.md` → "Write Conflicts & Offline".
- Admin: role/unit/permission management plus commanded-unit assignment through `commanded_unit_id`.
- Requests: full workflow, event link, edit Phase 1, closed deletion.
- Tasks: Supabase-backed, edit Phase 1, event link, closed deletion, quick filter chips.
- Schedule: events, timeline/week grid, auto-complete, edit Phase 1, linked tasks/requests, copy tomorrow schedule.
- Forum posts: `forum_posts`, create/edit/pin, RLS, audit.
- Forum daily reports: `forum_daily_reports`, fixed slots, read-view card, edit mode, date picker, safe draft creation, create-for-subordinate, submit/return/approve-close/reopen, reset, advanced delete, WhatsApp short/detailed.

## Migrations

There are **30** migrations. The forum-relevant ones:

- `008_forum_rls.sql` - Forum Phase 1 posts.
- `009_forum_daily_summaries.sql` - legacy/prototype, do not build on it (still RLS-active live).
- `010_forum_hierarchical_daily_reports.sql` - current hierarchical forum model.
- `011_forum_daily_reports_commander_insert.sql` - commander create-for-subordinate.
- `012_forum_daily_reports_delete_policy.sql` - advanced delete policy.
- `013_add_commanded_unit_id.sql` - `users.commanded_unit_id` + index; foundation only.

Later, and load-bearing: `017` rebuilt users/requests/tasks policies against verified live state (and records that `001`/`002` on disk had drifted from reality); `024` added blocked/rejected checks across ~15 policies; `027`–`030` are the write-conflict layer (`updated_by` column, `caller_outranks`, and the trigger that makes `updated_by` non-forgeable).

Nine migrations are annotated "run manually — do not run automatically". There is no `config.toml` and no drift check: **the migration files are a log of manual applications, not an automated chain.** Verify against the live database before trusting them.

## Forum Limitations

- Full MK -> MM -> MP flow requires real mapped users for every role/platoon/squad.
- Unit hierarchy mapping is not complete.
- Some forum visibility is UI-gated.
- Forum is not yet wired to `commanded_unit_id`.
- Forum daily structural slots now auto-match owners by `owner_user_id` + role/unit (resolved in the Structured Company Flow round); the "existing reports" fallback is preserved for unmatched/legacy reports.
- WhatsApp preview now maps platoons via the shared `assignPlatoonReports` path consistent with the aggregation (fixed in `cdcd99f`).
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
forum_daily_report_carried_forward
forum_company_report_saved
forum_daily_forum_published
```

## Recommended Next Work

```text
Step 0 - Cleanup orphaned legacy prototype shell - DONE in 96ae49b
Hotfix A - Dashboard profile lookup - DONE in 717bcc9  (this line used to say "Password reset"; there is no password flow in this system - see the Auth note above)
Hotfix B - Global users/units ambiguity fix - DONE in 73ed3a5
Step 1 - Sync docs with 013 + cleanup + hotfix milestones - DONE
Step 2 - Forum daily UI-only owner/slot matching layer - DONE in 1c7414c
Step 2b - Forum daily slot-click scroll-into-view (sub-XL panel visibility) - DONE in 62fd8fe
Step 2c - Carry Forward / Rollover ("create a new day based on yesterday") - DONE in c991be2
Step 2d - Forum Daily Phase A (layout/density, UI-only) - DONE in 1d37472
Step 2e - Forum Daily Structured Company Flow (structured מ״פ report, deterministic aggregation, owner mapping, created_by vs owner_user_id, publish/close/reopen, read-only after close) - DONE (round c82492c->cdcd99f)
Step 3 - WhatsApp preview from mapped slots/platoons - DONE in cdcd99f
Step 3a - Duplicate dynamic company node cleanup (forum/page.tsx:495-502) - NEXT (P1, see FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md)
Step 3b - Unsaved company draft protection on slot switch (forum/page.tsx:972-975) - NEXT (P1)
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
