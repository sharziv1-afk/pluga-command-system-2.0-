# pluga-command-system - "המפקד"

## Milestone Snapshot - 2026-06-21

`pluga-command-system` / **"המפקד"** is a Hebrew RTL company command-management system for command teams. It is built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase Auth/PostgreSQL/RLS, and GitHub. Future deployment target: Vercel.

**Critical:** this project uses `src/proxy.ts`, not `middleware.ts`.

## Latest Git State

```text
Latest commit:
650353f Polish small dashboard forum and task UI issues

Previous important commits:
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

- Branch: `main`
- `origin/main`: up to date
- Working tree: clean

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
- **Audit trail** - best-effort, non-blocking audit for request/task/event/forum actions.

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
