# pluga-command-system - "המפקד"

## Milestone Snapshot - 2026-06-27

`pluga-command-system` / **"המפקד"** is a Hebrew RTL company command-management system for command teams. It is built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase Auth/PostgreSQL/RLS, and GitHub. Future deployment target: Vercel.

**Critical:** this project uses `src/proxy.ts`, not `middleware.ts`.

## Latest Git State

```text
Latest commit (pushed):
16da109 Add Tracking status cycling and soft delete controls

Previous important commits:
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

- Branch: `main`
- `origin/main`: up to date
- Working tree: clean

## Tracking Module - Phase 1+2 Checkpoint - 2026-06-27

The **Tracking Module** (spreadsheet-style company tracking: rows = soldiers, columns = exercises/qualifications, cells = status) is now live in the app. Built across three commits:

```text
f2be781 Add Tracking module schema, RLS, and read-only skeleton page
334fec7 Add Tracking CRUD phase one
16da109 Add Tracking status cycling and soft delete controls
```

**Current capabilities (`/tracking`):**

- `/tracking` is a protected route (`src/proxy.ts`) with a "מעקב" navigation item.
- DB tables `soldiers`, `tracking_items`, `tracking_records` exist with RLS (migration `015_tracking_mvp.sql`, applied manually in production).
- Add soldier (full name + unit required; personal number / squad / role / notes optional).
- Add tracking item / column (title + category required).
- Spreadsheet table of soldiers × tracking_items, with a sticky soldier column.
- Cell status cycling on click: `ריק → עבר → לא עבר → השלמה → ריק`. The first click on an empty cell **inserts** a `tracking_records` row with `status='passed'`; later clicks **update** to the next status.
- Soft delete for soldiers and tracking items (`is_active=false`, never a hard delete), confirmed through an **in-app modal** (no `window.confirm`) with cancel / X / Escape / overlay-click to dismiss.
- "רשומות תאים" counter is based on active visible cells (`recordByCell.size`); status stat chips count empty/passed/failed/makeup correctly (empty includes cells with no record).
- CSV export button is still a disabled placeholder; cell note editing and filters are not implemented.

**Audit (best-effort):** `tracking_soldier_created`, `tracking_soldier_updated`, `tracking_item_created`, `tracking_item_updated`, `tracking_record_updated`, `tracking_exported_csv` (the last is reserved; CSV is not implemented yet).

**QA:** `npm run lint` (0 errors, only the 78 pre-existing vendor warnings in `.agents/skills/impeccable/scripts/modern-screenshot.umd.js`), `npx tsc -p tsconfig.json --noEmit`, and `npm run build` all pass; `/tracking` builds as a route. Claude Code reviews returned A for the schema/snapshot, CRUD Phase 1, and Phase 2 (incl. the modal fix). Connected Browser QA returned A for CRUD Phase 1 and for Phase 2 after the modal fix; a console warning seen during automation is a Chrome-extension warning, not an app error. Vercel deployment still needs a quick verification after push.

**QA data left in production (do not auto-delete):** soldier `QA Cycling Test 001`, tracking item `בוחן מסלול`, and one `tracking_record` with status `עבר`.

**Technical debt / Phase 3 candidates:** CSV export; cell note editing; filters; the `handleCycleCellStatus` double-click/stale-state window (`setUpdatingCellKey(null)` fires before `loadTrackingData`); audit attribution via a dedicated `dbProfile` lookup instead of `AppContext`/`currentUser`; `withTimeout` wrapping on the write handlers (create/remove/cycle); role-based UI gating (RLS is the source of truth, so an unauthorized user may see a button and get a permission error); fuller mobile QA; and a decision on cleaning the QA data.

## Forum Daily Auto Carry Forward - 2026-06-23

Latest checkpoint: `c991be2 Carry forward closed forum daily reports`.

When a forum daily report is closed (`status='closed'`), the system auto-creates a new **draft** for the next Jerusalem day for the same owner/level/unit:

- Copies `content` (and `summary_text` when present); `metadata` carries `carried_forward_from_report_id` / `carried_forward_from_date` / `carried_forward_created_at`.
- The historical closed report is preserved at its own date — never overwritten, moved, or deleted.
- No `upsert`; the `unique(report_date, report_level, owner_user_id)` duplicate (`23505`) is skipped silently.
- Rollover is **fire-and-forget best-effort**: it never blocks the close and a failure never makes the close appear to fail.
- Adds audit action `forum_daily_report_carried_forward`.
- Close UX no longer uses a native `window.confirm` (delete/reset confirms unchanged); the close feedback stays "הדיווח נסגר".

Validation: lint (0 errors), tsc, build, and Chrome QA — closing 22/06 created a 23/06 draft (content copied, 22/06 stayed closed/historical), and the repeat QA after the confirm removal had 23/06→24/06 with `POST forum_daily_reports 201`, no freeze, no `42501`/`23505`/app errors.

## Forum Daily Phase A - Layout & Density - 2026-06-24

Commit: `1d37472 Simplify forum daily report layout and density`. UI-only, single file (`src/app/(protected)/forum/page.tsx`).

- Manpower (`מצבת חיילים`) is a full-width central card; edit mode shows a large live `נוכחים/סד״כ` ratio above the two underlying inputs (placeholder `0`) — same `present_count`/`total_count` fields and content schema.
- Primary squad/platoon fields moved to a 2-column grid on desktop, 1 column on mobile.
- Secondary/reflection fields moved into a collapsible "פרטים נוספים / הסתר פרטים" section — open automatically when it already has content, collapsed when empty.
- Sidebar status badges, locked/closed state, WhatsApp preview, and date navigation are unchanged.
- QA: Chrome-checked at 1117px / 768px / 500px / 390px — no blocking issues, no console app errors. Minor non-blocking polish noted (date input slightly tight at 390px; `▾` glyph small).
- Validation: lint (0 errors), tsc, build — all green.
- Not touched: DB/RLS/SQL, Auth, proxy, rollover/carry-forward, WhatsApp generation, date navigation, slot matching, owner mapping, audit, Supabase queries/mutations.

## Forum Daily Checkpoint - 2026-06-21

Latest checkpoint: `62fd8fe Scroll forum daily slot selections into view`.

Today's forum daily work (UI-only, no DB/RLS/Auth changes):

- **Owner mapping** (`1c7414c`): platoon summary slots are enriched from active/approved owner options. A user whose role is מ״מ N and unit is מחלקה N is matched to the `מחלקה N · סיכום מ״מ` slot — e.g. סגן שולי (מ״מ 1 / מחלקה 1) now appears under "מחלקה 1 · סיכום מ״מ" and no longer also appears under "דוחות קיימים". Platoons 2-4 stay unmapped when no matching user exists. The "דוחות קיימים" fallback is preserved for unmatched/legacy reports.
- **Panel scroll** (`62fd8fe`): clicking a daily slot scrolls the report panel into view via `scrollIntoView({ block: 'nearest' })` (smooth, or instant under `prefers-reduced-motion`). This fixes the sub-XL / single-column case where the slot list is on top and the panel was far below. Wide desktop (≥1280px, two columns) does not jump.

Validation: `npm run lint` (0 errors), `npx tsc -p tsconfig.json --noEmit`, `npm run build`, Claude review, and focused Chrome QA for both mapping and scroll.

**Known state:** the forum leader-daily view is better but not yet ready for full daily use. Next major task: **Carry Forward / Rollover** ("create a new day based on yesterday") — plan before coding. Still open: no rollover yet; dev-facing "UI-gated..." text needs cleanup; WhatsApp preview shows "1 דיווחים נטענו" and omits empty platoons 2-4; missing fields ("לו״ז מחר", "חריגים/פערים"); labels/placeholders/lifecycle polish. Guardrails: no DB population before a snapshot/diagnosis, no RLS changes without a snapshot, do not delete the "דוחות קיימים" fallback, and plan carry-forward before writing code.

## UI Polish Checkpoint - 2026-06-21

Commit: `650353f Polish small dashboard forum and task UI issues`

Small live-QA fixes were completed and pushed:

- Dashboard activity log now translates raw audit keys for `request_updated`, `forum_daily_report_created`, and `forum_daily_report_submitted`.
- Tasks hides the empty state while the create-task form is open and restores it when the form closes.
- Forum posts: the regular post edit button uses `className="min-w-[96px] shrink-0 whitespace-nowrap px-4"`, so `ערוך` is not visually clipped.

Validation before commit: `npm run lint`, `npx tsc -p tsconfig.json --noEmit`, `npm run build`, and Chrome QA for Dashboard translations, Tasks form/empty state, and Forum `ערוך`.

## Auth / Admin Approval Checkpoint - 2026-06-19

End-to-end registration → approval flow validated manually. Summary of the flow as it now works:

- **Registration is OTP-code-only** (`c7b8cf1`): user fills name/email/password/role/unit, gets an email code, types it, profile is created in `public.users`. `emailRedirectTo` was removed so the magic-link/callback path no longer competes and cannot create placeholder profiles. The callback is reserved for password reset.
- **`has_completed_onboarding=true`** is set at registration (`c03db56`), so approved users reach `/dashboard` instead of looping back to `/onboarding`.
- **Role→unit mapping at registration** (`6996160`, `7d52c40`): מ"מ N→מחלקה N, מ"כ/סמל N→מחלקה N, מ"פ/סמ"פ/ע.מ"פ→פלוגה, חובש→רפואה, קשר→קשר, רס"פ/לוגיסטיקה→לוגיסטיקה, ב.קוד/נהג→רכב. Registration now requires a real `unit_id` when the role maps to a unit.
- **Pending users** see "ממתין לאישור מ״פ" and do not get system access (RLS gates on `status='active'` + `role_approval_status='approved'`).
- **Admin edit prefill** (`9acd397`): opening edit for a pending user prefills תפקיד (with gershayim normalization so the role select matches), and suggests מסגרת / יחידה בפיקוד / רמת הרשאה by role when the DB value is empty. Existing DB values always win; the commander can override everything before approval.
- **Admin approval guardrail** (`f1a2d33`): approval is blocked if the user has no valid role or no `unit_id`. The commander must edit + save role/unit first.

### Manual Supabase SQL applied (2026-06-19) — recorded in migration 014

`public.units` and `public.roles` had RLS enabled in the live DB without a SELECT policy, so the client received zero rows and the registration/Admin unit/role dropdowns were empty. The following was applied manually in the Supabase SQL Editor and is now recorded in `supabase/migrations/014_reference_data_read_policies.sql`:

```sql
-- units / roles are non-sensitive reference data; allow client read.
alter table public.units enable row level security;
create policy "units: public read" on public.units for select to anon, authenticated using (true);
alter table public.roles enable row level security;
create policy "roles: public read" on public.roles for select to anon, authenticated using (true);
```

After this, unit/role selectors load and Admin approval works end-to-end.

### Manual QA passed (2026-06-19)

Registration OTP → pending-approval screen → Admin edit/save/approval → approved-user login → Tasks → Requests → Forum basic smoke/navigation were verified manually. Deeper Forum Daily QA on 2026-06-21 found owner-mapping issues documented below.

## Tech Stack

| Layer | Version / Notes |
| --- | --- |
| Next.js App Router | 16.2.6 |
| React | 19.2.4 |
| TypeScript | strict project config |
| Tailwind CSS | 4 |
| Supabase Auth | SSR helpers |
| Supabase PostgreSQL | RLS enabled |
| GitHub remote | `https://github.com/sharziv1-afk/pluga-command-system-2.0-.git` |

## What Works Today

- **Auth** - hybrid flow: existing users log in with email+password; new users can use Email OTP + password setup; Dev Login is available in development only; Magic Link callback remains as fallback. Forgot Password now uses Supabase password reset through `/reset-password`.
- **Role-based interface** - approved active commanders see the full command dashboard and Admin Panel.
- **Profile** - `/profile` is protected and reads real user data from Supabase.
- **Admin Panel** - approve/reject users, edit roles/units, manage permission level, and set `commanded_unit_id` through "יחידה בפיקוד".
- **Dashboard** - `/dashboard` reads real Supabase data: requests, tasks, events, audit logs, users. Includes summary cards, attention list, today's schedule, open tasks, recent activity, and Quick Create popovers for request/task/event. Profile/unit lookup no longer uses ambiguous `users -> units` embeds.
- **Requests** - create, search/filter, status workflow, assignee management, comments/treatment history, event link through real `event_id`, edit Phase 1, closed-item deletion, audit.
- **Tasks** - Supabase-backed tasks with create/edit/status/delete, assignment, due date, event link through real `event_id`, quick filter chips, audit.
- **Schedule / Events** - timeline, week grid, day tabs, event create/edit/status/delete, auto-complete for elapsed events, linked tasks/requests, and "copy tomorrow schedule" WhatsApp output.
- **Forum - Posts Phase 1** - Supabase-backed `forum_posts`: create posts, edit posts, pinned posts for commanders, RLS-gated visibility, audit.
- **Forum - Hierarchical Daily Reports** - Supabase-backed `forum_daily_reports`: fixed daily slots, read-view card, edit mode, date picker, create-for-subordinate, safe draft creation, submit/return/approve-close/reopen, reset report, advanced delete, WhatsApp short/detailed output and copy.
- **Tracking** - Supabase-backed `soldiers`/`tracking_items`/`tracking_records` with RLS: `/tracking` spreadsheet of soldiers × tracking items, add soldier, add tracking item, click-to-cycle cell status (`ריק → עבר → לא עבר → השלמה`), soft delete for soldiers/items via an in-app confirm modal, and best-effort audit. CSV export, note editing, and filters are not implemented yet.
- **Audit trail** - best-effort, non-blocking audit for request/task/event/forum/tracking actions.

Reference UX demo: `https://thepluton.vercel.app/`

The demo is UX/product-flow inspiration only. Do **not** copy schema, code, or client-only permissions from it. This repository's Next.js + Supabase + RLS implementation is the source of truth.

## Recent Milestones

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
93eae89 Align project docs with editing milestone
```

### Password Reset

Commit: `717bcc9 Fix dashboard profile lookup and add password reset flow`

- Login includes a `שכחתי סיסמה` flow.
- Uses `supabase.auth.resetPasswordForEmail(...)`.
- Shows a generic success message that does not reveal whether an email exists.
- Adds `/reset-password`.
- Reset page supports new password, confirmation, show/hide password, basic validation, and `supabase.auth.updateUser({ password })`.
- `src/app/auth/callback/route.ts` supports `next=/reset-password` after `exchangeCodeForSession`.
- Build now includes 18 routes because of `/reset-password`.

### Users / Units Lookup Hotfix

Commits:

```text
717bcc9 Fix dashboard profile lookup and add password reset flow
73ed3a5 Fix ambiguous user unit lookups across protected pages
```

After migration 013, `users` has two foreign keys to `units`: `unit_id` and `commanded_unit_id`. Supabase/PostgREST embedded selects like `units(name)` from `users` became ambiguous and returned `PGRST201`.

Current rule:

- Do not embed `units(...)` from `users`.
- Select users without `units(...)`.
- Load units separately by `unit_id`, using batch `.in('id', unitIds)` when needed.
- Map unit names on the client.
- Shared Supabase logging should print `message`, `code`, `details`, `hint`, `status`, and context instead of `{}`.

This pattern was applied across Dashboard, Tasks, Schedule, Requests, and Forum.

### Step 0 Cleanup

Commit: `96ae49b Remove orphaned legacy prototype shell and split session context`

- Removed 17 orphaned prototype/demo files.
- `src/lib/context/AppContext.tsx` was reduced to session context only: `currentUser`, `isLoading`, and Supabase -> localStorage fallback.
- Removed old demo CRUD state.
- Cleaned dead legacy exports from `permissions.ts`.
- Cleaned legacy demo types from `types.ts`.
- `tsc`, `lint`, and `build` passed after cleanup.

## Forum Current State

### Forum Phase 1 - Posts

- Table: `forum_posts`
- Migration: `008_forum_rls.sql`
- Capabilities:
  - create post
  - edit own post
  - commander/canSeeAll can edit all posts
  - pinned posts for commanders
  - audit actions: `forum_post_created`, `forum_post_updated`

### Hierarchical Daily Reports

- Table: `forum_daily_reports`
- Main migration: `010_forum_hierarchical_daily_reports.sql`
- Additive migrations:
  - `011_forum_daily_reports_commander_insert.sql`
  - `012_forum_daily_reports_delete_policy.sql`

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

Important fields:

- `content jsonb`
- `summary_text`
- `whatsapp_text`
- `metadata`
- `created_by`
- `owner_user_id`
- `report_date`
- `report_level`
- `staff_role`

Current UX:

- Fixed slots always appear:
  - מחלקה 1
  - מחלקה 2
  - מחלקה 3
  - מחלקה 4
  - חופ"ל
  - ע. מ"פ
  - רס"פ
  - סמ"פ
  - סיכום פלוגתי
  - WhatsApp
- If a report exists: show read-view card by default.
- If safe to create: show draft form instead of an empty state.
- If owner mapping is missing: show "נדרש שיוך משתמש"; do not create a wrong report.
- No fallback by `report_level` alone.
- Each platoon slot must stay separate by report/owner/date/unit/staff key.
- Date picker uses `YYYY-MM-DD`.
- WhatsApp output has short/detailed modes and copy.
- `returned_note` is shown in the read view and side list.
- `reset report` clears content and returns the report to draft while keeping the row.
- `advanced delete` remains available for commander/creator/owner according to RLS 012.

### Forum Daily Reports - Owner Mapping Diagnosis (2026-06-21)

Current status after live QA and Code X diagnosis:

- The basic Forum page works: posts load, regular post editing opens, and no app console errors were found in QA.
- The daily leading forum is not ready for real operational use yet.
- Most structural slots still show "requires user mapping".
- Owner dropdown data comes from `users` with `status = active` and `role_approval_status = approved`; there is no unit/role filter in the UI query. If only a few users appear, verify DB/RLS/user state before assuming a UI filter bug.
- `platoonNodes` are static labels for platoons 1-4 and do not include real unit UUIDs.
- Commander `dailyNodes` creates structural slots such as `platoon_1-summary` and `platoon_1-squads`, but those nodes have `requiresOwnerMapping: true` and no `ownerUserId`, `unitId`, `platoon_unit_id`, or structural report key.
- Existing reports are also converted into `dynamicReportNodes` with `id: report-${report.id}`, `reportId`, `ownerUserId`, and `unitId`, and are grouped under "existing reports".
- `findReportForNode` matches reports by `reportId`, or by `report_level + owner_user_id + staffRole`, or by owned/current-user paths. It does not currently match a structural platoon slot by unit name/UUID.
- QA example: Sgan Shuli exists as MM 1 / Platoon 1 and has a report for 2026-06-21, but his report appears under "existing reports" instead of under "Platoon 1 - MM summary" because the structural slot has no owner/unit mapping.

Recommendation: start with a UI-only owner/slot matching layer. Enrich structural slots from active/approved owner options and unit/role labels, keep "existing reports" as fallback for unmatched/legacy reports, and do not start with DB population or RLS changes.

Related WhatsApp limitation: `generateWhatsappText` currently iterates over `dailyReports`, not all structural slots. Empty platoons 2/3/4 may be omitted and platoon labels are index-based rather than `platoon_unit_id`/unit-name based.

## Supabase Migrations

Run SQL manually in Supabase SQL Editor only. Do not run SQL automatically.

| File | Purpose | Status |
| --- | --- | --- |
| `001_mvp_schema.sql` | Base schema: users, units, roles, tasks, requests, comments, audit_logs, events, approvals, forum_posts, feature_flags | run |
| `seed_units_roles.sql` | Seed units and roles | run |
| `002_rls_policies.sql` | Base RLS sections A-G, including `is_commander()` | run |
| `003_events_schema.sql` | `public.events` | run |
| `004_task_event_link.sql` | `tasks.event_id -> events(id) ON DELETE SET NULL` | run |
| `005_request_event_link.sql` | `requests.event_id -> events(id) ON DELETE SET NULL` | run |
| `006_closed_items_delete_rls.sql` | Delete policies for closed requests/tasks/events | run |
| `007_request_creator_update_rls.sql` | Request creator update policy | run |
| `008_forum_rls.sql` | `forum_posts` + RLS for Forum Phase 1 | run |
| `009_forum_daily_summaries.sql` | Legacy/prototype `forum_daily_summaries` | run, legacy |
| `010_forum_hierarchical_daily_reports.sql` | Current `forum_daily_reports` model + owner/commander RLS | run |
| `011_forum_daily_reports_commander_insert.sql` | Commander can create report for another active approved owner | run |
| `012_forum_daily_reports_delete_policy.sql` | Advanced delete policy for `forum_daily_reports`: commander OR creator OR owner | run |
| `013_add_commanded_unit_id.sql` | Adds `users.commanded_unit_id` and `idx_users_commanded_unit_id`; separates membership unit from commanded unit | run manually per user report |
| `014_reference_data_read_policies.sql` | `units: public read` + `roles: public read` SELECT policies so client selectors load | run manually 2026-06-19; recorded for sync |
| `015_tracking_mvp.sql` | Tracking tables (`soldiers`, `tracking_items`, `tracking_records`), helpers (`current_app_user_id`, `current_tracking_unit_id`, `is_tracking_commander`, `can_edit_tracking_unit`), and RLS | run manually in production; ע. מ"פ gets full Tracking access via `is_tracking_commander` |

Migration 009 is kept for history only. The current forum daily model is 010+.

Migration 013 is foundation only:

- `unit_id` = the user's membership unit.
- `commanded_unit_id` = the unit the user commands.
- Do not rerun it unless there is a direct reason.
- It is not yet wired into real hierarchy RLS.
- Forum visibility is not yet wired to `commanded_unit_id`.

## Admin Commanded Unit

Admin now supports editing `commanded_unit_id`:

- Dropdown label: `יחידה בפיקוד`.
- Can choose a unit or `-- ללא --`.
- Save updates `commanded_unit_id`.
- If present, the user card shows `בפיקוד: [unit name]`.

The admin ambiguity fix in `5b5adc5` loads users without embedding units, loads units separately, and maps names client-side.

## Audit Actions

Audit is best-effort and must never block the workflow.

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

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` or `http://localhost:3000/login`.

Health checks:

```bash
npm run lint
npx tsc -p tsconfig.json --noEmit
npm run build
```

Do not run `npm audit fix --force`.

## Environment Variables

Create `.env.local` from `.env.example`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Never commit `.env.local` or real keys.

## Routes

Protected via `src/proxy.ts`:

```text
/dashboard
/tasks
/requests
/schedule
/forum
/tracking
/admin
/profile
/help
```

Auth/public:

```text
/login
/reset-password
/onboarding
/select-role
/pending-approval
/auth/callback
```

## Design System - Light Gloss Command System

- Primary text: `#020108`
- Primary action orange: `#FF6B02`
- Main background: `#F6F7F9`
- Glass card: white translucency, blur, soft shadow
- Hebrew RTL first
- Mobile-friendly layouts

## Known Limitations

- Full MK -> MM -> MP flow requires real mapped users for each role/platoon/squad.
- Full hierarchy mapping is not built yet.
- Forum daily owner mapping is incomplete: structural platoon slots do not yet auto-match existing reports by owner/unit.
- "Existing reports" is currently a necessary fallback for reports that are not matched to structural slots; do not remove it until legacy/unmatched reports are understood.
- WhatsApp preview still depends on `dailyReports` rather than the full structural slot list, so empty platoons may be omitted.
- Daily report UI still has product-polish debt: dev-style UI-gated text, destructive delete confirmation review, panel visibility, placeholders/labels, and lifecycle button relevance.
- Some forum visibility is still UI-gated.
- Real hierarchical RLS is the next major security phase.
- `commanded_unit_id` is currently foundation only.
- Forum is not yet wired to `commanded_unit_id`.
- Do not start real hierarchy RLS before real QA users and flow validation exist.
- Migration 009 is legacy/prototype.
- Reference demo is UX inspiration only and must not be treated as schema or permission truth.
- No Vercel deployment yet.
- No notifications/SLA/attachments.
- No recurring events, drag/drop, or calendar integration.
- `AppContext` still contains demo/localStorage state; do not delete without dependency mapping.
- `AuditTab.tsx` still reads localStorage instead of real `audit_logs`.

## Next Recommended Phases

### Current Roadmap

```text
Step 0 - Cleanup orphaned legacy prototype shell - DONE in 96ae49b
Hotfix A - Password reset + Dashboard profile lookup - DONE in 717bcc9
Hotfix B - Global users/units ambiguity fix - DONE in 73ed3a5
Step 1 - Sync docs with 013 + cleanup + hotfix milestones - DONE
Step 2 - Forum daily UI-only owner/slot matching layer - DONE in 1c7414c
Step 2b - Forum daily slot-click scroll-into-view - DONE in 62fd8fe
Step 2c - Carry Forward / Rollover - DONE in c991be2
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
Tracking Phase C - MVP implementation - DONE in 015 + f2be781 + 334fec7 + 16da109
  - C1 Schema + RLS + read-only skeleton - DONE in f2be781 (migration 015_tracking_mvp.sql)
  - C2 CRUD Phase 1 (add soldier, add tracking item, table) - DONE in 334fec7
  - C3 Phase 2 (cell status cycling + soft delete + in-app confirm modal) - DONE in 16da109
Tracking Phase 3 - candidates (not started): CSV export, cell note editing, filters,
  double-click/debounce, dbProfile attribution, write timeout, role-based UI gating, QA-data cleanup
```

See `PROJECT_HANDOFF_AI_CONTEXT.md` for the full Tracking history, open decisions, and the ChatGPT/Code X/Claude Code/Chrome Claude collaboration model.

### Phase A - Real users QA setup

- Create/approve real users for MK/MM/MP/staff roles.
- Assign each user a real role/unit.
- Assign `commanded_unit_id` where needed through Admin.

### Phase B - Hierarchy mapping

- Design DB model for company, platoon, squad, commander relationships, and user assignment.

### Phase C - Real RLS

- Additive migrations only.
- Do not rewrite old migrations.
- SQL manual only.

### Phase D - Full operational QA

- MK submits.
- MM consolidates.
- MP returns/approves/closes.
- Staff roles fill professional sections.
- WhatsApp summary is generated and copied.

### Phase E - Product expansion

- Notifications/SLA.
- Attachments.
- Recurring events/calendar integration.
- Vercel hardening.

## Guardrails

- Use `src/proxy.ts`, not `middleware.ts`.
- Do not change `src/app/auth/callback/route.ts` without a proven auth bug.
- Do not put service role keys in frontend code.
- SQL is manual only.
- Do not rewrite old migrations.
- Prefer additive migrations.
- Do not run `npm audit fix --force`.
- Do not delete `AppContext` without dependency mapping.
- Do not use embedded `units(...)` selects from `users`; load units separately because `users.unit_id` and `users.commanded_unit_id` both reference `units`.
- Preserve Hebrew RTL.
- Preserve Light Gloss Command System.
- Audit is best-effort.
- Commit/push only with explicit approval.
