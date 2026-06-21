# Project Summary - pluga-command-system

## Current Snapshot - 2026-06-21

**Product:** `pluga-command-system` / "המפקד"  
**Branch:** `main`  
**Latest commit:** `650353f Polish small dashboard forum and task UI issues`  
**Git state:** `origin/main` up to date, working tree clean

**Recent important commits:**

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

This snapshot supersedes the older 2026-06-19 / 2026-06-18 / 2026-06-10 snapshots below.

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

### Forum Daily Reports - Owner Mapping Diagnosis (2026-06-21)

Deep QA and Code X diagnosis found that the daily leading forum still needs a mapping fix before real use:

- Most commander structural slots show "requires user mapping".
- `platoonNodes` are static labels only and do not carry real unit UUIDs.
- Commander `dailyNodes` create structural slots such as `platoon_1-summary`, but those slots have no `ownerUserId`, no `unitId`, and no structural key.
- Every existing `forum_daily_reports` row becomes a `dynamicReportNode` under "existing reports".
- `findReportForNode` can match by `reportId`, owner/report level, or current-user ownership. It cannot match an unmapped structural platoon slot by unit/role label.
- Sgan Shuli exists as MM 1 / Platoon 1 and has a report, but the structural "Platoon 1 - MM summary" slot cannot identify him, so his report appears under "existing reports".
- Owner dropdown loads only `active + approved` users. If key users are missing, verify DB/RLS/user approval state, but do not start with DB population.
- WhatsApp preview is generated from `dailyReports`, not all structural slots, so empty platoons 2/3/4 can be omitted and platoon labels are index-based.

Recommended next step: implement a UI-only owner/slot matching layer, keep "existing reports" as fallback, and defer DB/RLS/hierarchy work until after a Supabase snapshot.

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
- Forum daily structural slots do not yet auto-match existing reports by owner/unit.
- "Existing reports" fallback is required for unmatched/legacy daily reports.
- WhatsApp preview does not yet render from the full mapped slot structure.
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
Step 2 - Forum daily UI-only owner/slot matching layer - NEXT
Step 3 - WhatsApp preview from mapped slots/platoons
Step 4 - Remove dev-facing daily forum text + confirm destructive delete
Step 5 - Real Users QA setup
Step 6 - Forum wiring to commanded_unit_id
Step 7 - Hierarchical RLS policies
Step 8 - Full MK -> MM -> MP QA
Step 9 - UI/mobile conservative polish
```

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
