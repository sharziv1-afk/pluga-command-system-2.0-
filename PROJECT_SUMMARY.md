# Project Summary - pluga-command-system

## Current Snapshot - Forum Daily Collapsed Hierarchy (pushed)

**Product:** `pluga-command-system` / "המפקד"  
**Working path:** `C:\dev\pluga-command-system` (never from the retired OneDrive path `C:\Users\Maltak 123\Desktop\pluga-command-system`)  
**Branch:** `main`  
**Latest commit:** `273e49b Add collapsed hierarchy to forum daily list`  
**Git state:** `main = origin/main`, working tree clean. No deployment/Vercel yet.  
**Full Forum round detail / work plan / QA checklist / risk matrix:** [`FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`](FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md)

**Forum Daily Collapsed Hierarchy (`273e49b`, 1 file `src/app/(protected)/forum/page.tsx`, UI/presentation only — no logic, schema, RLS, Auth, proxy, migrations, owner mapping, aggregation, or WhatsApp logic):**

Forum Daily node list redesigned from a flat list with inline group labels to a collapsed/accordion hierarchy:

- New type `DailyNodeGroupView` and memo `dailyNodeGroups` built as a pure presentation layer over the existing `dailyNodes` — no new DB queries.
- State `groupToggles: Record<string, boolean>` records per-group user overrides within a session.
- Top-level groups: מחלקה 1, מחלקה 2, מחלקה 3, מחלקה 4, מפל״ג, פלוגה, דוחות קיימים (when present).
- Each group is a button with `aria-expanded`, a rotating chevron, and a submission counter badge (הוגשו X/Y, N בטיפול).
- Default: מ״פ (canSeeAll) starts with only the selected group expanded; non-commanders start fully expanded.
- Child node JSX is structurally identical to the original flat list — only the grouping/toggle wrapper was added.
- `Fragment` import removed (unused); `ChevronDown` added to Lucide imports.

**Validated (Code X QA + מ״פ live session):** lint 0 errors, tsc clean, build 19 pages; browser QA at 390/430/768/1366 — expand/collapse correct, no overflow; date `2026-08-20` → 7 groups all הוגשו X/X; WhatsApp `124/138`, platoon counts `32/35 / 30/34 / 28/33 / 34/36`, UPDATED marker, no swap; all lifecycle buttons visible; touch targets ≥44px; console clean.  
**Caveat:** מ״מ role not live-tested — static review shows the non-canSeeAll `dailyNodes` branch was not changed; live QA with מ״מ recommended when credentials are available.

**Open next items:**

- Live QA with מ״מ role.
- `backdrop-filter` prefix/minifier fix (mobile blur Safari/iOS only, inert on Chrome — separate decision).
- Data/render optimization.
- Skeleton/loading UX.
- Supabase fetch duplication review.
- Physical-device mobile QA.

**Recent important commits (newest -> oldest):**

```text
273e49b Add collapsed hierarchy to forum daily list
b403691 Document CSS smoothness checkpoint
2127e79 Improve mobile CSS smoothness
75fb9ae Fix remaining mobile touch targets
6a41df9 Document mobile release readiness checkpoint
8422726 Fix mobile release readiness QA follow-up
1f09c50 Polish mobile release readiness batch 1
53d4856 Document forum daily structured flow checkpoint
cdcd99f Fix forum WhatsApp preview platoon mapping
acd2345 Fix forum report ownership for commander-created slot reports
996bccb Make company report a structured מ״מ-style form
16da109 Add Tracking status cycling and soft delete controls
```

This snapshot supersedes the CSS Smoothness Batch 1 snapshot, the Recovery + Mobile Release Readiness snapshot, the Forum Daily Structured Company Flow snapshot, the 2026-06-27 Tracking snapshot, and older snapshots below.

## Tracking Module - Phase 1+2 Implemented (2026-06-27)

The Tracking Module moved from planning to a live MVP across three commits:

```text
f2be781 Add Tracking module schema, RLS, and read-only skeleton page
334fec7 Add Tracking CRUD phase one
16da109 Add Tracking status cycling and soft delete controls
```

**DB / RLS (`015_tracking_mvp.sql`, applied manually in production):**

- Tables: `soldiers`, `tracking_items`, `tracking_records` (RLS enabled on all three).
- Helpers: `current_app_user_id`, `current_tracking_unit_id`, `is_tracking_commander`, `can_edit_tracking_unit`.
- Policies: commander insert/select/update on `soldiers`; active+approved select + commander insert/update on `tracking_items`; select-visible-soldiers + tracking-unit-editor insert/update on `tracking_records`. No delete policies (soft delete via `is_active=false`; tracking_records keep history).
- ע. מ"פ (assistant company commander) gets full Tracking access through `is_tracking_commander`, because their `permission_level` is below 90 so `public.is_commander` alone is not enough. `public.is_commander` was **not** modified.

**UI (`src/app/(protected)/tracking/page.tsx`):**

- `/tracking` protected route + "מעקב" nav item.
- Add soldier (full name + unit required), add tracking item (title + category required), unit picker from `public.units`.
- Spreadsheet `soldiers × tracking_items` with a sticky soldier column; missing cells render as "ריק".
- Cell status cycling: `empty/ריק → passed/עבר → failed/לא עבר → makeup/השלמה → empty/ריק`. First click on an empty cell inserts a `tracking_records` row with `status='passed'`; later clicks update to the next status.
- Soft delete soldiers/items via an **in-app confirm modal** (no `window.confirm`; cancel/X/Escape/overlay-click dismiss; only "הסר" performs the soft delete).
- "רשומות תאים" counter uses `recordByCell.size` (active visible cells only); status chips count empty/passed/failed/makeup with no double-counting.
- CSV export remains a disabled placeholder; note editing and filters are not implemented.

**Audit (best-effort):** `tracking_soldier_created`, `tracking_soldier_updated`, `tracking_item_created`, `tracking_item_updated`, `tracking_record_updated`, `tracking_exported_csv` (reserved). `audit_logs.action_type`/`entity_type` are `text` with no CHECK, so the new values are safe with no schema change.

**QA:** lint (0 errors; only 78 pre-existing vendor warnings), tsc, and build all pass; `/tracking` builds. Claude Code reviews A for schema/snapshot, CRUD Phase 1, and Phase 2 (incl. modal fix). Connected Browser QA A for CRUD Phase 1 and for Phase 2 after the modal fix. Vercel deployment still needs a quick verification after push.

**QA data left in production (do not auto-delete):** soldier `QA Cycling Test 001`, tracking item `בוחן מסלול`, one `tracking_record` with status `עבר`.

**Technical debt / Phase 3 candidates:** CSV export; cell note editing; filters; `handleCycleCellStatus` double-click/stale-state window; `dbProfile`-based audit attribution instead of `AppContext`; `withTimeout` on write handlers; role-based UI gating; mobile QA; QA-data cleanup.

## Forum Daily Phase A - Layout & Density (2026-06-24)

`1d37472`. UI-only redesign of the daily report form, single file changed: `src/app/(protected)/forum/page.tsx`.

- Manpower card is full-width and central; edit mode shows a live large `נוכחים/סד״כ` ratio above the two underlying inputs (placeholder `0`); same `present_count`/`total_count` fields, no schema change.
- Primary fields: 2-column grid on desktop, 1 column on mobile.
- Secondary/reflection fields: collapsible "פרטים נוספים / הסתר פרטים" section, auto-open when it already has content, collapsed when empty.
- Action bar verified to wrap correctly down to 390px; locked/closed state, WhatsApp preview, and date navigation unchanged.
- QA: Chrome at 1117px / 768px / 500px / 390px — no blocking issues. Minor non-blocking polish left: date input slightly tight at 390px, `▾` glyph small.
- Validation: lint/tsc/build all green.
- Not touched: DB/RLS/SQL, Auth, proxy, rollover/carry-forward, WhatsApp generation, date navigation, slot matching, owner mapping, audit, Supabase queries/mutations.

## Tracking Module - Roadmap Reset (2026-06-24)

Next major product work is the **Tracking Module**, but only **Phase B (Technical Execution Plan)** starts now — no Tracking code, DB, RLS, or migration yet.

**Collaboration model going forward:**

- ChatGPT - orchestrator / writes prompts / commander role.
- Code X - primary implementer once a plan is approved.
- Claude Code - deep technical planning, documentation, periodic review.
- Claude Chrome - visual QA against the live app and the reference demo.

**Decisions already locked:**

- Tracking is a core module, spreadsheet-style: rows = soldiers, columns = exercises/qualifications/checks, cells = status.
- Soldiers come from a dedicated `soldiers`/personnel table — **not** `users` (not every soldier is a system user).
- Export starts as CSV; real Excel (xlsx) and Google Sheets API are later, not MVP.
- Initial status set (per demo): `empty/ריק`, `passed/עבר`, `failed/לא עבר`, `makeup/השלמה`.

**Open decisions (must close in Phase B, before any migration draft):**

- Does מ״כ edit their own squad's tracking, or view-only at first?
- Is "squad" (כיתה) a free-text `squad_label`, or a dedicated `squads` table?
- Is מספר אישי (personal number) required?
- Are soldiers hard-deleted or marked inactive?
- Is Tracking one company-wide board, or multiple boards?
- Is CSV export always the full dataset, or only the currently filtered view?

**Phase B must finish before code:**

1. Re-verify existing schema/migrations/RLS patterns (`units`, `roles`, `is_commander()`, `audit_logs`).
2. Propose a data model (`soldiers`, `tracking_items`, `tracking_records`, and decide on `tracking_boards`).
3. Propose an RLS plan mirroring `002_rls_policies.sql` patterns (draft only, not applied).
4. Resolve the open decisions above.
5. Only then prepare a migration draft for review — still not auto-run.

See `PROJECT_HANDOFF_AI_CONTEXT.md` for the full technical version of this plan.

## Current Snapshot - 2026-06-21

**Product:** `pluga-command-system` / "המפקד"  
**Branch:** `main`  
**Latest commit:** `c991be2 Carry forward closed forum daily reports`  
**Git state:** `origin/main` up to date, working tree clean

**Recent important commits:**

```text
c991be2 Carry forward closed forum daily reports
813ef48 Document forum daily scroll checkpoint
62fd8fe Scroll forum daily slot selections into view
1c7414c Map forum daily platoon owners to structural slots
9c49135 Document forum daily mapping diagnosis
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

This snapshot supersedes the older 2026-06-19 / 2026-06-18 / 2026-06-10 snapshots below.

## Forum Daily Auto Carry Forward - 2026-06-23

`c991be2`: closing a forum daily report (`status='closed'`) auto-creates a next-Jerusalem-day **draft** for the same owner/level/unit.

- Copies `content` (+`summary_text`); `metadata.carried_forward_from_*` links to the source.
- Historical closed report preserved (no overwrite/move/delete); no `upsert`; duplicate `23505` skipped silently.
- Fire-and-forget best-effort: rollover never blocks or fails the close.
- Audit action `forum_daily_report_carried_forward`. Close UX dropped the native `window.confirm` (delete/reset confirms unchanged); feedback stays "הדיווח נסגר".

QA: lint/tsc/build green; Chrome QA 22/06→23/06 (content copied, 22/06 stayed closed); repeat QA 23/06→24/06 with `POST 201`, no freeze, no `42501`/`23505`/app errors.

## Forum Daily Checkpoint - 2026-06-21

Latest checkpoint: `62fd8fe`. Two UI-only forum daily changes (no DB/SQL/RLS/Auth/proxy):

- **Owner mapping** (`1c7414c`): platoon summary slots enriched from active/approved owners. Match requires both role מ״מ N and unit מחלקה N; matched user gets `ownerUserId`/`unitId` and is filtered out of "דוחות קיימים". סגן שולי (מ״מ 1 / מחלקה 1) → "מחלקה 1 · סיכום מ״מ", not duplicated under "דוחות קיימים". Platoons 2-4 stay unmapped without a matching user. Fallback preserved.
- **Panel scroll** (`62fd8fe`): slot click scrolls the report panel into view (`scrollIntoView({ block: 'nearest' })`, smooth / instant under `prefers-reduced-motion`). Fixes sub-XL single-column visibility; wide desktop does not jump.

Validation: lint (0 errors), tsc, build, Claude review, focused Chrome QA (mapping + scroll).

Known state: forum leader-daily improved but not yet fully daily-ready. Next major task: **Carry Forward / Rollover** (plan first). Open items: no rollover; dev-facing "UI-gated..." text; WhatsApp preview "1 דיווחים נטענו" + empty platoons 2-4 omitted; missing "לו״ז מחר" / "חריגים/פערים"; labels/placeholders/lifecycle polish. Guardrails: no DB population/RLS change before a snapshot, keep the "דוחות קיימים" fallback, plan carry-forward before coding.

## UI Polish Checkpoint - 2026-06-21

Commit `650353f` closed three small QA-verified UI fixes:

- Dashboard activity log translates raw keys for `request_updated`, `forum_daily_report_created`, and `forum_daily_report_submitted`.
- Tasks hides the empty state while the create-task form is open.
- Forum regular post edit button has `min-w-[96px] shrink-0 whitespace-nowrap px-4`, so `ערוך` is no longer clipped.

Validation before commit: `npm run lint`, `npx tsc -p tsconfig.json --noEmit`, `npm run build`, and Chrome QA for the three affected flows.

## Auth / Admin Approval Checkpoint - 2026-06-19

Full registration → approval flow validated manually.

- **OTP-code-only registration** (`c7b8cf1`): no more magic-link placeholder profiles; callback reserved for password reset.
- **`has_completed_onboarding=true`** at registration (`c03db56`): fixes the `/onboarding` loop.
- **Role→unit mapping** (`6996160`, `7d52c40`): מ"מ/מ"כ/סמל N→מחלקה N, מ"פ/סמ"פ/ע.מ"פ→פלוגה, חובש→רפואה, קשר→קשר, רס"פ→לוגיסטיקה, ב.קוד/נהג→רכב; registration requires a real `unit_id` when applicable.
- **Pending users** see "ממתין לאישור מ״פ"; no access until approved.
- **Admin prefill** (`9acd397`): role prefilled with gershayim normalization; מסגרת / יחידה בפיקוד / רמת הרשאה suggested by role when DB value empty; DB value wins; full override before approval.
- **Admin guardrail** (`f1a2d33`): approval blocked without valid role + unit.

### Manual Supabase SQL applied 2026-06-19 (migration 014)

`units` / `roles` had RLS enabled in live without a SELECT policy → client got zero rows → unit/role selectors empty. Applied manually: `units: public read` + `roles: public read` (`for select to anon, authenticated using (true)`). Recorded in `supabase/migrations/014_reference_data_read_policies.sql`.

### Manual QA passed 2026-06-19

Registration OTP, pending-approval screen, Admin edit/save/approval, approved-user login, Tasks, Requests, and Forum basic smoke/navigation were verified manually. Deeper Forum Daily QA on 2026-06-21 found owner-mapping issues documented below.

### Deferred

requests RLS gap · `is_commander` hardening (`search_path`) · additional UI/Forum polish requested by user · Real users QA · docs polish.

This snapshot supersedes the older 2026-06-18 / 2026-06-10 snapshots below.

## Current Snapshot - 2026-06-10

**Product:** `pluga-command-system` / "המפקד"  
**Branch:** `main`  
**Latest commit:** `2dfcff7 Polish forum UX and update handoff docs`  
**Previous important commits:**

```text
f5c1e40 Add hierarchical forum daily reports
f47812b Add Supabase-backed Forum Phase 1
```

The project is a Hebrew RTL company command-management system. It is currently a Next.js 16 + React 19 + TypeScript + Tailwind 4 + Supabase Auth/PostgreSQL/RLS application.

The reference demo at `https://thepluton.vercel.app/` is UX/product-flow inspiration only. Do not copy schema, code, or permission assumptions from it.

## Build History

### Foundation

- Hybrid Auth: email+password for existing users, Email OTP + password setup for first registration, Dev Login in development, Magic Link callback fallback.
- Forgot Password flow: login sends reset email, callback exchanges the code, and `/reset-password` updates the password.
- Role-based interface for approved active users.
- Admin Panel for user approval and role/unit/permission management.
- Admin commanded-unit assignment through `commanded_unit_id`.
- Profile page.
- Light Gloss Command System: bright background, glass cards, orange `#FF6B02`, dark `#020108`, Hebrew RTL.
- Protected routes through `src/proxy.ts`.

### Dashboard

- Supabase-backed dashboard reads requests, tasks, events, audit logs, and users.
- Profile/unit lookup avoids ambiguous `users -> units` embeds after migration 013.
- Summary cards, attention list, today's schedule, open tasks, recent activity.
- Quick Create for request/task/event with best-effort audit and refresh.

### Requests

- Supabase-backed requests workflow.
- Queue tabs, search, filters, status actions, assignee management.
- Treatment history through comments.
- Event link through real `event_id` FK.
- Closed-item deletion for creator or commander.
- Editing Phase 1: creator/commander can edit title, description, category, priority, event link.
- Audit: request created/status/assigned/comment/deleted/updated.

### Tasks

- Supabase-backed tasks workflow.
- Create/edit/status/delete.
- Assignment, due date, event link, metadata fields.
- Quick filter chips: mine/urgent/blocked + visible counter.
- Closed-item deletion for creator or commander.
- Audit: task created/updated/status/deleted.

### Schedule / Events

- Supabase-backed `public.events`.
- Timeline, week grid, day/week/all tabs.
- Event create/edit/status/delete.
- Auto-complete for elapsed events, client-side only.
- Linked tasks/requests in event modal.
- `ON DELETE SET NULL` keeps linked tasks/requests when event is deleted.
- "Copy tomorrow schedule" WhatsApp output.
- Audit: event created/status/deleted/updated.

### Forum Phase 1 - Posts

Commit: `f47812b Add Supabase-backed Forum Phase 1`  
Migration: `008_forum_rls.sql`

- Table: `forum_posts`
- Create posts.
- Edit posts.
- Pinned posts for commanders.
- Creator can edit own post.
- Commander/canSeeAll can edit all posts.
- Audit: `forum_post_created`, `forum_post_updated`.

### Forum Hierarchical Daily Reports

Commit: `f5c1e40 Add hierarchical forum daily reports`  
UX polish commit: `2dfcff7 Polish forum UX and update handoff docs`  
Migrations: `009` through `012`.

Core table: `forum_daily_reports`

Report levels:

```text
squad
platoon
company
staff
```

Staff roles:

```text
medic
assistant_commander
logistics_nco
deputy_commander
```

Statuses:

```text
draft
in_progress
submitted
closed
```

Important columns:

- `content jsonb`
- `summary_text`
- `whatsapp_text`
- `metadata`
- `owner_user_id`
- `created_by`
- `report_date`
- `report_level`
- `staff_role`

Current UX:

- Fixed forum slots:
  - platoon 1
  - platoon 2
  - platoon 3
  - platoon 4
  - medic
  - assistant commander
  - logistics NCO
  - deputy commander
  - company summary
  - WhatsApp
- Existing report opens in read-view card.
- "Edit report" switches to the existing form.
- "Cancel edit" restores read view.
- Closed reports are read-only.
- Safe missing report opens as draft form; first save creates the report.
- Missing owner mapping shows "נדרש שיוך משתמש" and does not create a wrong report.
- No fallback by `report_level` alone.
- Platoons must remain separated by key/report/owner/date/unit/staff identity.
- Date picker is available.
- WhatsApp short/detailed preview and copy.
- Submit, return, approve-close, reopen.
- `returned_note` appears as banner and side-list chip.
- Reset report clears content and returns to draft.
- Advanced delete exists via migration 012.

### Forum Daily Reports - Owner Mapping Diagnosis (2026-06-21) — RESOLVED

> **RESOLVED in the Forum Daily Structured Company Flow round (`c82492c`→`cdcd99f`).** Structural
> slots auto-match owners by `owner_user_id` + role/unit; deterministic aggregation lives in the
> pure module `src/lib/forum/companyReport.ts`; WhatsApp preview maps platoons via the shared
> `assignPlatoonReports` path; the "existing reports" fallback is preserved for unmatched/legacy
> reports. Historical diagnosis kept for context only. See
> [`FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`](FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md).

Historical (pre-fix) — deep QA and Code X diagnosis found that the daily leading forum still needed a mapping fix before real use:

- Most commander structural slots show "requires user mapping".
- `platoonNodes` are static labels only and do not carry real unit UUIDs.
- Commander `dailyNodes` create structural slots such as `platoon_1-summary`, but those slots have no `ownerUserId`, no `unitId`, and no structural key.
- Every existing `forum_daily_reports` row becomes a `dynamicReportNode` under "existing reports".
- `findReportForNode` can match by `reportId`, owner/report level, or current-user ownership. It cannot match an unmapped structural platoon slot by unit/role label.
- Sgan Shuli exists as MM 1 / Platoon 1 and has a report, but the structural "Platoon 1 - MM summary" slot cannot identify him, so his report appears under "existing reports".
- Owner dropdown loads only `active + approved` users. If key users are missing, verify DB/RLS/user approval state, but do not start with DB population.
- WhatsApp preview is generated from `dailyReports`, not all structural slots, so empty platoons 2/3/4 can be omitted and platoon labels are index-based.

(The recommended UI-only owner/slot matching layer was implemented and extended into the full Structured Company Flow; the "existing reports" fallback is preserved, and DB/RLS/hierarchy work remains deferred until after a Supabase snapshot.)

### Commanded Unit Foundation

Migration: `013_add_commanded_unit_id.sql`  
Commits: `7b8050f`, `5b5adc5`

- Adds `users.commanded_unit_id`.
- `unit_id` is the user's membership unit.
- `commanded_unit_id` is the unit the user commands.
- Adds `idx_users_commanded_unit_id`.
- Reportedly run manually in Supabase.
- Foundation only: not yet real hierarchy RLS and not yet wired into forum visibility.
- Admin can set/clear the commanded unit through `יחידה בפיקוד`.

### Password Reset Hotfix

Commit: `717bcc9 Fix dashboard profile lookup and add password reset flow`

- Login includes `שכחתי סיסמה`.
- Uses `supabase.auth.resetPasswordForEmail(...)`.
- Shows a generic success message so email existence is not exposed.
- Adds `/reset-password`.
- Reset page supports password confirmation, show/hide password, validation, and `supabase.auth.updateUser({ password })`.
- Auth callback supports `next=/reset-password` after code exchange.
- Build includes 18 routes after this route was added.

### Users / Units Ambiguity Hotfix

Commit: `73ed3a5 Fix ambiguous user unit lookups across protected pages`

- Root issue: after migration 013, `users` has both `unit_id` and `commanded_unit_id` foreign keys to `units`.
- Supabase/PostgREST embedded selects like `units(name)` from `users` can fail with `PGRST201`.
- Dashboard, Tasks, Schedule, Requests, and Forum now load users without `units(...)`, load units separately, and map names client-side.
- Shared Supabase error logging now reports useful error fields instead of `{}`.

### Step 0 Cleanup

Commit: `96ae49b Remove orphaned legacy prototype shell and split session context`

- Removed 17 orphaned prototype/demo files.
- Reduced `AppContext.tsx` to session-only context: `currentUser`, `isLoading`, and Supabase -> localStorage fallback.
- Removed old demo CRUD state.
- Cleaned dead legacy exports/types from `permissions.ts` and `types.ts`.
- `tsc`, `lint`, and `build` passed after cleanup.

## Migrations Run Manually

| Migration | Purpose | Status |
| --- | --- | --- |
| `001_mvp_schema.sql` | Base schema | run |
| `seed_units_roles.sql` | Units and roles seed | run |
| `002_rls_policies.sql` | Base RLS sections A-G | run |
| `003_events_schema.sql` | Events | run |
| `004_task_event_link.sql` | Tasks to events FK | run |
| `005_request_event_link.sql` | Requests to events FK | run |
| `006_closed_items_delete_rls.sql` | Closed-item delete policies | run |
| `007_request_creator_update_rls.sql` | Request creator update policy | run |
| `008_forum_rls.sql` | Forum posts RLS | run |
| `009_forum_daily_summaries.sql` | Legacy prototype daily summaries | run, legacy |
| `010_forum_hierarchical_daily_reports.sql` | Current daily reports model | run |
| `011_forum_daily_reports_commander_insert.sql` | Commander create-for-subordinate | run |
| `012_forum_daily_reports_delete_policy.sql` | Daily report delete policy | run |
| `013_add_commanded_unit_id.sql` | `users.commanded_unit_id` + index | run manually per user report |
| `014_reference_data_read_policies.sql` | `units: public read` + `roles: public read` | run manually 2026-06-19 |
| `015_tracking_mvp.sql` | Tracking tables/helpers/RLS (`soldiers`, `tracking_items`, `tracking_records`) | run manually in production 2026-06 |

Migration 009 is legacy/prototype. The current forum model is 010+.

Migration 013 is foundation only. Do not rerun it without a direct reason. Do not build hierarchy RLS from it until real QA users and flow validation exist.

## Audit Actions

```text
request_created
request_status_changed
request_assigned
request_comment_added
request_deleted
request_updated
task_created
task_updated
task_status_changed
task_deleted
event_created
event_status_changed
event_deleted
event_updated
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
tracking_soldier_created
tracking_soldier_updated
tracking_item_created
tracking_item_updated
tracking_record_updated
tracking_exported_csv
```

Audit is best-effort: calls use `void createAuditLog(...)` and failures must not block the user workflow.

## Key Decisions Not to Lose

| Decision | Reason |
| --- | --- |
| Use `src/proxy.ts`, not `middleware.ts` | Next.js 16 project convention |
| SQL manual only | Avoid accidental production DB changes |
| Prefer additive migrations | Old migrations may already have run |
| No service role in frontend | Security |
| `event_id` is a real FK column | Proper indexing, linking, and `ON DELETE SET NULL` |
| Audit is non-blocking | UX must not fail because audit insert failed |
| AppContext remains until dependency mapping | It still supports legacy/demo areas |
| Forum hierarchy is UI-gated for now | Real unit hierarchy mapping is missing |
| Reference demo is inspiration only | It is not Supabase/RLS truth |
| Do not embed `units(...)` from `users` | `unit_id` and `commanded_unit_id` both reference `units` |

## Known Limitations

- Full MK -> MM -> MP flow requires real mapped users per role and platoon/squad.
- Full hierarchy mapping is not built yet.
- Forum daily structural slots auto-match owners by `owner_user_id` + role/unit (Structured Company Flow round); full MK→MM→MP coverage still needs real mapped users per role/platoon/squad.
- "Existing reports" fallback is preserved for unmatched/legacy daily reports.
- WhatsApp preview maps platoons via the shared `assignPlatoonReports` path consistent with the aggregation (resolved in `cdcd99f`).
- Non-blocking open items: duplicate dynamic company node; unsaved company draft reset on slot switch (see `FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`).
- Forum daily has UX polish debt: dev-facing UI-gated text, destructive delete confirmation, panel visibility, placeholders/labels, and lifecycle button relevance.
- Real hierarchy RLS is a future phase.
- Some forum visibility is UI-gated.
- `commanded_unit_id` is foundation only.
- Forum is not yet wired to `commanded_unit_id`.
- `009_forum_daily_summaries.sql` is legacy/prototype.
- AuditTab still reads localStorage.
- AppContext still contains demo/localStorage state.
- No notifications/SLA/attachments.
- No recurring events, drag/drop, or calendar integration.
- No automated migration runner.
- No Vercel production deployment yet.

## Recommended Next Phases

```text
Step 0 - Cleanup orphaned legacy prototype shell - DONE in 96ae49b
Hotfix A - Password reset + Dashboard profile lookup - DONE in 717bcc9
Hotfix B - Global users/units ambiguity fix - DONE in 73ed3a5
Step 1 - Sync docs with 013 + cleanup + hotfix milestones - DONE
Step 2 - Forum daily UI-only owner/slot matching layer - DONE in 1c7414c
Step 2b - Forum daily slot-click scroll-into-view - DONE in 62fd8fe
Step 2c - Carry Forward / Rollover - DONE in c991be2
Step 2d - Forum Daily Phase A (layout/density, UI-only) - DONE in 1d37472
Step 2e - Forum Daily Structured Company Flow (structured מ״פ report, deterministic aggregation, owner mapping, ownership, publish/close/reopen) - DONE (c82492c->cdcd99f)
Step 3 - WhatsApp preview from mapped slots/platoons - DONE in cdcd99f
Step 3a - Duplicate dynamic company node cleanup - NEXT (P1)
Step 3b - Unsaved company draft protection on slot switch - NEXT (P1)
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
Tracking Phase 3 - candidates (NOT started): CSV export, cell note editing, filters,
  double-click/debounce, dbProfile attribution, write timeout, role-based UI gating, QA-data cleanup
```

> Note: the "Phase A-E" list immediately below is the older **forum / hierarchy** roadmap; it predates and is unrelated to the Tracking Phase A/B/C labels above.

### Phase A - Real users QA setup

- Create/approve real users for MK, MM, MP, and staff roles.
- Assign real role/unit to every user.
- Assign `commanded_unit_id` where needed through Admin.
- Manually QA the full daily forum chain.

### Phase B - Hierarchy mapping

- Design DB model for company/platoon/squad/user assignment.
- Define commander relationships explicitly.

### Phase C - Real RLS

- Additive migration only.
- No old migration rewrites.
- SQL manual only.

### Phase D - Full operational QA

- MK submits.
- MM consolidates.
- MP returns/approves/closes.
- Staff sections are filled.
- WhatsApp summary is generated and copied.

### Phase E - Product expansion

- Notifications/SLA.
- Attachments.
- Recurring events/calendar integration.
- Deployment/Vercel hardening.

## Validation Baseline

The forum UX milestone was validated before commit by lint, TypeScript, build, and browser QA according to the commit handoff. For docs-only updates, `git diff --name-only` must show Markdown files only.
