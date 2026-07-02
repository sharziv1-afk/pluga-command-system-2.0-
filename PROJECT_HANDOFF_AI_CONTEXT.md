# PROJECT_HANDOFF_AI_CONTEXT

Authoritative technical handoff for AI agents and developers continuing work on `pluga-command-system`.

**Last updated:** Forum Daily Hierarchy — מ״מ 1 live QA checkpoint  
**Milestone:** Forum Daily Structured Company Flow completed (structured מ״פ report, deterministic aggregation, owner mapping, `created_by` vs `owner_user_id`, WhatsApp preview mapping, publish/close/reopen, read-only after close). Tracking Module Phase 1+2 live. Mobile release readiness + CSS Smoothness Batch 1 + Forum Daily Collapsed Hierarchy (all UI only) pushed on top.  
**Latest commit:** `c7d44f3 Document forum hierarchy checkpoint` (matches `origin/main`)  
**Project recovered off OneDrive.** Work only from `C:\dev\pluga-command-system`; the old `C:\Users\Maltak 123\Desktop\pluga-command-system` path is retired.  
**Current milestone override:** Forum Daily Collapsed Hierarchy closed and pushed (`273e49b`, 1 file `src/app/(protected)/forum/page.tsx`, UI/presentation only — no logic, schema, RLS, Auth, proxy, migrations, owner mapping, aggregation, or WhatsApp logic). The flat node list was replaced with a `dailyNodeGroups` accordion: top-level groups (מחלקה 1–4, מפל״ג, פלוגה, דוחות קיימים) that expand to reveal child nodes; each group has `aria-expanded`, a chevron icon, and a submission counter badge; default expand: מ״פ starts with only the selected group open, others fully open; `groupToggles` state records per-group overrides. `dailyNodes` data source, owner mapping, aggregation, WhatsApp logic, and all lifecycle actions unchanged. Validated: lint/tsc/build green + מ״פ live browser QA at 390/430/768/1366 with clean console; date `2026-08-20`, WhatsApp `124/138`, platoon counts correct, UPDATED marker, no swap, touch targets ≥44px. **מ״מ 1 live QA passed** (סגן שולי, מחלקה 1): saw only "המחלקה שלי" group (דיווחי מ״כים + סיכום מחלקתי); did not see other platoons/מפל״ג/פלוגה/WhatsApp/company totals; expand/collapse correct; counter `הוגשו 1/2`; `ערוך דוח` disabled on closed report; commander actions not visible; no RLS errors; console clean. Note P3: `פתח נעילה`/`אפס דוח`/`מחק דוח` visible on own closed report — matches existing code, not a hierarchy regression. CSS Smoothness Batch 1 (`b403691`/`2127e79`) on top. Open next items: backdrop-filter minifier fix, data/render optimization, skeleton/loading UX, Supabase fetch duplication review, physical-device mobile QA. Still pending from prior rounds: P1 follow-ups (duplicate dynamic company node cleanup; unsaved company draft protection) — full plan in [`FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`](FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md). Tracking Phase 3 remains approval-gated. No deployment/Vercel yet.

## Identity

- Repo name: `pluga-command-system`
- Product name: **"המפקד"**
- Description: Hebrew RTL company command-management system
- Local path: `C:\dev\pluga-command-system` (recovered off OneDrive; the old `C:\Users\Maltak 123\Desktop\pluga-command-system` path is retired — do not work from it)
- GitHub: `https://github.com/sharziv1-afk/pluga-command-system-2.0-.git`
- Branch: `main`
- Expected state: `origin/main` up to date, working tree clean

## Latest Git State

```text
273e49b Add collapsed hierarchy to forum daily list      <- HEAD / origin/main
b403691 Document CSS smoothness checkpoint
2127e79 Improve mobile CSS smoothness
75fb9ae Fix remaining mobile touch targets
6a41df9 Document mobile release readiness checkpoint
8422726 Fix mobile release readiness QA follow-up
1f09c50 Polish mobile release readiness batch 1
53d4856 Document forum daily structured flow checkpoint
cdcd99f Fix forum WhatsApp preview platoon mapping
acd2345 Fix forum report ownership for commander-created slot reports
92af9b9 Fix forum owner mapping for staff and squad placeholders
5965615 Document forum QA owner mapping requirements
604c8cd Polish structured company report state handling
9699284 Improve forum company report dialog accessibility
ba903b2 Fix forum date input state update
996bccb Make company report a structured מ״מ-style form
e8f2161 Add structured per-field company aggregator
023fb96 Polish company report status line for in-progress reports
43d4a08 Add publish and close flow for forum daily reports
ba554e6 Add company final report editor to forum daily
c82492c Add deterministic company report generator helpers
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
d33c401 Remove decorative empty state skeletons
2cb5f4e Ignore local Claude tooling in ESLint
f364cdf Show admin reference data load warning
0d967cd Sync auth admin approval checkpoint docs
9acd397 Prefill admin edit form from role with suggestions
7d52c40 Require real unit id during registration
f1a2d33 Block approving users without valid role and unit
c7b8cf1 Use OTP code flow for registration
73ed3a5 Fix ambiguous user unit lookups across protected pages
```

## TRACKING MODULE - IMPLEMENTED (Phase 1+2) (2026-06-27)

Tracking moved from planning to a live MVP. Commits:

```text
f2be781 Add Tracking module schema, RLS, and read-only skeleton page
334fec7 Add Tracking CRUD phase one
16da109 Add Tracking status cycling and soft delete controls
```

### DB / RLS - `015_tracking_mvp.sql` (applied manually in production; SQL stays manual-only)

- **Tables:** `soldiers` (roster; `full_name`, `personal_number?`, `unit_id`, `squad_label?`, `role_label?`, `notes?`, `is_active`, `metadata`, `created_by`/`updated_by`), `tracking_items` (columns; `title`, `category`, `subject?`, `description?`, `sort_order`, `is_active`, ...), `tracking_records` (cells; `soldier_id`, `tracking_item_id`, `status`, `note?`, unique `(soldier_id, tracking_item_id)`, status CHECK `empty|passed|failed|makeup`). RLS enabled on all three.
- **Helpers (SECURITY DEFINER):** `current_app_user_id()` (active+approved user id for `auth.uid()`), `current_tracking_unit_id()` (`coalesce(commanded_unit_id, unit_id)`), `is_tracking_commander(auth_id)` (true for `is_commander` OR `permission_level >= 90` OR normalized role = `ע.מ"פ`), `can_edit_tracking_unit(target_unit_id)` (tracking commander full access, else מ"מ scoped to `coalesce(commanded_unit_id, unit_id) = target_unit_id`). All filter `status='active'` + `role_approval_status='approved'` and use the real `public.users` columns (`role`, `name`, `status`, `role_approval_status`, `unit_id`, `commanded_unit_id`) — not `is_active`/`full_name`/`role_id`.
- **Policies:** `soldiers` — commander select/insert/update; active+approved select for own tracking unit. `tracking_items` — active+approved select; commander insert/update. `tracking_records` — select for visible soldiers; insert/update for `can_edit_tracking_unit`. **No delete policies** (soft delete via `is_active=false`; `tracking_records` keep history and only update status/note).
- **ע. מ"פ note:** the assistant company commander gets full Tracking access only through `is_tracking_commander` (Tracking-scoped), because their `permission_level` is below 90 so `public.is_commander` is not enough. `public.is_commander` was **not** changed.
- **Production snapshot verified (read-only) before apply:** 3 active+approved users (2× מ"פ permission 100; סגן שולי מ"מ 1 permission 70, `unit_id = commanded_unit_id = platoon_1`); no ע. מ"פ user yet (migration still supports a future one); no false-positive מ"מ matches; no broken unit references.

### UI - `src/app/(protected)/tracking/page.tsx`

- `/tracking` protected route (`src/proxy.ts` `protectedRoutes` + `config.matcher`), "מעקב" nav item (`Table2` icon).
- Loads `soldiers`/`tracking_items` (active), `tracking_records`, and `units` with `withTimeout`; redirects to `/login?next=/tracking` when no session.
- Add soldier (full name + unit required; personal number/squad/role/notes optional). Add tracking item (title + category required; subject/description/sort optional). Unit picker from `public.units`, sorted company→platoon_1..4.
- Spreadsheet `soldiers × tracking_items`, sticky soldier column, min-width scales with column count. Missing cell = "ריק".
- Cell status cycling on click: `empty → passed → failed → makeup → empty`. Empty cell → `insert tracking_records status='passed'`; existing → `update` to next status. Per-cell loading via `updatingCellKey`.
- Soft delete soldiers/items: `update is_active=false`, confirmed via an **in-app modal** (`role="dialog"`, `aria-modal`, RTL, overlay, X, Escape, cancel) — no `window.confirm`. Single delete path through `handleConfirmDelete` → `handleRemoveSoldier`/`handleRemoveItem`.
- Stat cards: חיילים פעילים = `soldiers.length`, מופעי מעקב = `items.length`, רשומות תאים = `recordByCell.size` (active visible cells). Status chips count empty/passed/failed/makeup (empty includes cells with no record), no double-counting.
- CSV export button disabled placeholder. Note editing and filters not implemented.
- Types in `src/lib/types.ts` (`DbSoldier`, `DbTrackingItem`, `DbTrackingRecord`, `TrackingStatus`); audit types in `src/lib/audit.ts`.

### Audit (best-effort)

`tracking_soldier_created`, `tracking_soldier_updated`, `tracking_item_created`, `tracking_item_updated`, `tracking_record_updated`, `tracking_exported_csv` (reserved; CSV not implemented). Entity types `tracking_soldier`, `tracking_item`, `tracking_record`, `tracking_export`. `audit_logs.action_type`/`entity_type` are `text` with no CHECK — no DB change needed.

### QA & validation

- `npm run lint` (0 errors; 78 pre-existing vendor warnings only), `npx tsc -p tsconfig.json --noEmit`, `npm run build` — all green; `/tracking` builds.
- Claude Code reviews A for schema/snapshot, CRUD Phase 1, and Phase 2 (incl. the modal fix). Connected Browser QA A for CRUD Phase 1 and for Phase 2 after the modal fix. A console warning during automation is a Chrome-extension warning, not an app error.
- Vercel deployment still needs a quick verification after push.

### QA data left in production (do NOT auto-delete)

soldier `QA Cycling Test 001`, tracking item `בוחן מסלול`, one `tracking_record` with status `עבר`.

### Technical debt / Phase 3 candidates (do not start without approval)

CSV export; cell note editing; filters; `handleCycleCellStatus` double-click/stale-state window (`setUpdatingCellKey(null)` runs before `loadTrackingData`); audit attribution via a dedicated `dbProfile` lookup instead of `AppContext`/`currentUser`; `withTimeout` on the create/remove/cycle write handlers; role-based UI gating (RLS is the source of truth; an unauthorized user may see a button and get a permission error); fuller mobile QA; QA-data cleanup decision.

## Forum Daily Phase A - Layout & Density (2026-06-24)

Commit: `1d37472 Simplify forum daily report layout and density`. Single-file UI-only change in `src/app/(protected)/forum/page.tsx`. No DB/SQL/RLS/Auth/proxy changes.

- **Manpower card:** `מצבת חיילים` is a full-width central card. Edit mode shows a large live ratio (`{present_count}/{total_count}`, falls back to `—`) above the two underlying inputs (labeled `נוכחים`/`סד״כ`, placeholder `0`). Field names/content schema (`present_count`, `total_count`) and save/update logic are unchanged.
- **Primary fields:** squad/platoon fields render in a 2-column grid on desktop (`lg:grid-cols-2`), 1 column on mobile.
- **Secondary fields:** reflection/extra fields (`רשת/ריאלי/פרגון/שימור ידע`, `לקחים יומי`, `התייחסות אישית`) moved into a native `<details>` section labelled "הרחבות וסיכום" with an explicit "פרטים נוספים ▾" / "הסתר פרטים ▴" summary toggle. Auto-`open` when the report already has content in those fields, collapsed when empty — no hidden data.
- **Action bar:** verified (not changed) to wrap correctly with `flex-wrap` down to 390px; no horizontal overflow.
- **Untouched:** `carryForwardClosedReport`, `generateWhatsappText`, `shiftDateString`, `findPlatoonSummaryOwner`, `findReportForNode`, `loadDailyReports`, save/submit/close/reopen/reset/delete/return handlers, `createAuditLog`, all `supabase.from(...)` calls, locked/closed state, WhatsApp preview, date navigation.
- **QA:** Chrome-checked at 1117px (desktop), 768px (tablet), 500px (narrow), and 390px (mobile). No blocking issues, no app console errors. Minor non-blocking polish noted: the date input is slightly tight at 390px, and the disclosure glyph is small — neither blocks commit.
- **Validation:** `npm run lint` (0 errors), `npx tsc -p tsconfig.json --noEmit`, `npm run build` — all green before commit and push.

## NEXT MAJOR WORK: Tracking Module - Phase B (Technical Execution Plan)

Tracking is the next core module, but **Phase B (planning only) starts now — not code.** Do not write Tracking DB/RLS/migration/UI code before this plan is reviewed and approved.

**Collaboration model going forward:**

- **ChatGPT** - orchestrator / writes prompts / commander role.
- **Code X** - primary implementer once a plan is approved.
- **Claude Code** - deep technical planning, documentation, periodic review.
- **Claude Chrome** - visual QA against the live app and the reference demo.

**Decisions already locked (do not re-open without reason):**

- Tracking is a core module, spreadsheet-style: rows = soldiers, columns = exercises/qualifications/checks, cells = status.
- Soldiers come from a dedicated `soldiers`/personnel table — **not** `users`. Not every soldier is a system user; the existing `users` table represents commanders/staff, not the full roster.
- Export starts as CSV (client-side, no new dependency). Real Excel (`xlsx`) and Google Sheets API are later, not MVP.
- Initial status set (per reference demo, not the earlier "הושלם/לא הושלם" draft): `empty`/`ריק`, `passed`/`עבר`, `failed`/`לא עבר`, `makeup`/`השלמה`.

**Open decisions — must close in Phase B, before any migration draft:**

1. Does מ״כ edit their own squad's tracking, or view-only at first (until a reliable squad model exists)?
2. Is "squad" (כיתה) a free-text `squad_label`, or a dedicated `squads` table?
3. Is מספר אישי (personal number) required on a soldier record?
4. Are soldiers hard-deleted or marked inactive?
5. Is Tracking one company-wide board, or multiple boards (per subject/unit)?
6. Is CSV export always the full dataset, or only the currently filtered view?

**Phase B sequence (in order, no skipping):**

1. Re-verify existing schema/migrations/RLS patterns: `units`, `roles`, `is_commander()` (`002_rls_policies.sql`), `audit_logs`, and how Tasks/Requests/Events already load+mutate+audit through Supabase.
2. Propose a data model: `soldiers`, `tracking_items` (columns/exercises), `tracking_records` (cells), and decide whether `tracking_boards` is needed for MVP or later.
3. Propose an RLS plan mirroring `002_rls_policies.sql` conventions (commander sees/edits all; platoon commander scoped to their unit; squad-commander scope per open decision #1) — **draft only, not applied**.
4. Resolve the 6 open decisions above with the product owner.
5. Only then prepare a migration draft for review. SQL stays manual-only; nothing is auto-run.

## Forum Daily Auto Carry Forward (2026-06-23)

Latest checkpoint: `c991be2 Carry forward closed forum daily reports`. Code-only change in `src/app/(protected)/forum/page.tsx` + one audit-type addition in `src/lib/audit.ts`. No DB/SQL/RLS/Auth/proxy/schema/migration changes.

- **Trigger:** `closeSelectedReport` — only on `status='closed'` (commander approve-close). Not on save/submit/return/reopen/reset/delete.
- **Behavior:** a local helper `carryForwardClosedReport(sourceReport)` computes `shiftDateString(report_date, 1)` (Asia/Jerusalem) and inserts a new **draft** for the same `owner_user_id`/`report_level`/`staff_role`/unit fields, copying `content` and `summary_text`. `parent_report_id` is null, `whatsapp_text` null, and `metadata` carries `carried_forward_from_report_id` / `carried_forward_from_date` / `carried_forward_created_at` (plus preserved `node_id`/`node_label`/`ui_gated_scope` only).
- **History safety:** the closed report stays at its own date — never overwritten, moved, reset, or deleted. `reopen` still edits the historical report, not tomorrow's draft.
- **No duplicates / no overwrite:** plain `insert` (no `upsert`). The `unique(report_date, report_level, owner_user_id)` violation (`23505`) is skipped silently; other errors are logged best-effort only.
- **Fire-and-forget best-effort:** `void carryForwardClosedReport(...).catch(...)` — close never waits on rollover and a rollover failure never makes the close appear to fail; feedback stays "הדיווח נסגר".
- **Audit:** new action `forum_daily_report_carried_forward` (`audit_logs.action_type` has no CHECK, so the new value is safe at runtime).
- **Close UX:** the native `window.confirm` was removed from report close only (delete/reset confirms unchanged).
- **RLS note:** the rollover insert relies on existing policies — owner-self insert (010 J2) and commander insert-for-owner (011). No RLS change was made. If a future environment returns `42501` on the rollover insert, stop and verify 011 is applied (do not change RLS without a snapshot).

Validation: `npm run lint` (0 errors), `npx tsc -p tsconfig.json --noEmit`, `npm run build`, and Chrome QA — closing 22/06 created a 23/06 draft (content copied, 22/06 stayed closed/historical, no duplicate). Repeat QA after the confirm removal: 23/06→24/06 with `POST forum_daily_reports 201`, no freeze, no `42501`/`23505`/app errors (only a known Chrome-extension error, not the app).

## Forum Daily Checkpoint (2026-06-21)

Latest checkpoint: `62fd8fe Scroll forum daily slot selections into view`. Two UI-only changes in `src/app/(protected)/forum/page.tsx` — no DB/SQL/RLS/Auth/Supabase/proxy/WhatsApp/lifecycle changes.

- **Owner mapping** (`1c7414c`): a local helper enriches structural platoon summary slots from active/approved owner options. Match requires **both** role מ״מ N **and** unit מחלקה N (gershayim-normalized); a matched slot receives `ownerUserId` + `unitId` and `requiresOwnerMapping: false`, and `findReportForNode` resolves its report. A platoon report already matched to a structural slot is filtered out of the "דוחות קיימים" fallback so it is not shown twice. Result: סגן שולי (מ״מ 1 / מחלקה 1) appears under "מחלקה 1 · סיכום מ״מ" and no longer under "דוחות קיימים". Platoons 2-4 stay unmapped (`requiresOwnerMapping: true`) when no matching user exists. The "דוחות קיימים" fallback is preserved for unmatched/legacy reports.
- **Panel scroll** (`62fd8fe`): the daily slot list and the report panel form a two-column grid only at `xl` (≥1280px); below that they stack, so the panel sat far below the slot list with no feedback on click. `handleSelectDailyNode` now sets the selected node and, in a `requestAnimationFrame`, calls `reportPanelRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion ? 'auto' : 'smooth' })`. `block: 'nearest'` is a no-op when the panel is already visible (wide desktop), so wide desktop does not jump; sub-XL/single-column scrolls the panel into view. Runs only on click (not on mount or auto-select); `window.matchMedia` is read inside the browser-only handler.

Validation before commit: `npm run lint` (0 errors), `npx tsc -p tsconfig.json --noEmit`, `npm run build`, Claude review, and focused Chrome QA for both mapping and scroll.

**Known state and next task:** the forum leader-daily view is materially better but not yet ready for full daily use. The next major task is **Carry Forward / Rollover** — "create a new day based on yesterday" — which must be planned before any code. Still open: no rollover/carry-forward; dev-facing "UI-gated..." text needs cleanup; WhatsApp preview shows "1 דיווחים נטענו" and omits empty platoons 2-4; missing fields ("לו״ז מחר", "חריגים/פערים"); labels/placeholders/lifecycle polish. Guardrails: do not start DB population before a snapshot/diagnosis, do not change RLS without a snapshot, do not delete the "דוחות קיימים" fallback, and plan carry-forward before writing code.

## Auth / Admin Approval Checkpoint (2026-06-19)

Registration → approval flow, validated end-to-end manually.

- **Registration: OTP-code-only** (`c7b8cf1`). User fills name/email/password/role/unit → email code → `verifyRegistrationCode` upserts `public.users`. `emailRedirectTo` removed from the registration `signInWithOtp` so the magic-link/callback path no longer creates placeholder profiles; the callback is reserved for password reset.
- **`has_completed_onboarding=true`** at registration (`c03db56`) — fixes the `/onboarding` redirect loop.
- **Role→unit mapping** (`6996160`, `7d52c40`): מ"מ/מ"כ/סמל N→מחלקה N, מ"פ/סמ"פ/ע.מ"פ→פלוגה, חובש→רפואה, קשר→קשר, רס"פ/לוגיסטיקה→לוגיסטיקה, ב.קוד/נהג→רכב. Registration requires a real `unit_id` when the role maps to a unit.
- **Admin prefill** (`9acd397`): role select prefilled with gershayim normalization; מסגרת / יחידה בפיקוד / רמת הרשאה suggested by role when the DB value is empty (DB value always wins; fully overridable before approval).
- **Admin guardrail** (`f1a2d33`): approval blocked without a valid role + `unit_id`.

### Manual Supabase SQL applied 2026-06-19 (recorded in migration 014)

`public.units` / `public.roles` had RLS enabled in live without a SELECT policy → client got zero rows → registration/Admin unit/role selectors were empty. Applied manually:

```sql
alter table public.units enable row level security;
create policy "units: public read" on public.units for select to anon, authenticated using (true);
alter table public.roles enable row level security;
create policy "roles: public read" on public.roles for select to anon, authenticated using (true);
```

Now recorded in `supabase/migrations/014_reference_data_read_policies.sql` (idempotent). After applying, selectors load and Admin approval works.

### Manual QA passed 2026-06-19

Registration OTP → pending-approval → Admin edit/save/approval → approved-user login → Tasks → Requests → Forum basic smoke/navigation. Deeper Forum Daily QA on 2026-06-21 found the owner-mapping issues documented below.

## UI Polish Checkpoint (2026-06-21)

Commit: `650353f Polish small dashboard forum and task UI issues`

Included fixes:

- Dashboard activity log translates recently exposed raw audit keys: `request_updated`, `forum_daily_report_created`, and `forum_daily_report_submitted`.
- Tasks hides the empty state while the create-task form is open, then restores it when the form closes.
- Forum regular post edit button uses `min-w-[96px] shrink-0 whitespace-nowrap px-4` so the Hebrew `ערוך` label is not clipped.

Validation before commit: `npm run lint`, `npx tsc -p tsconfig.json --noEmit`, `npm run build`, and Chrome QA for the three affected flows.

## Stack

- Next.js 16.2.6 App Router
- React 19.2.4
- TypeScript
- Tailwind CSS 4
- Supabase Auth with SSR helpers
- Supabase PostgreSQL with RLS
- Lucide React
- ESLint

**Important:** This project uses `src/proxy.ts`, not `middleware.ts`.

## What to Read First

1. `README.md` - quick status and migration table
2. `PROJECT_HANDOFF_AI_CONTEXT.md` - this technical handoff
3. `PROJECT_SUMMARY.md` - product and milestone history
4. `AGENTS.md` - guardrails for all coding agents
5. `CLAUDE.md` - Claude Code-specific summary

## Auth

Implemented across:

- `src/app/(auth)/login/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/proxy.ts`

Hybrid auth:

- Existing user: email + password.
- First registration: Email OTP -> verify OTP -> set password -> create `public.users` profile -> onboarding.
- Forgot Password: login sends `supabase.auth.resetPasswordForEmail(...)`, callback exchanges the code, and `/reset-password` updates via `supabase.auth.updateUser({ password })`.
- Dev Login exists only in non-production.
- Magic Link callback remains as fallback.

Do not touch auth callback, Supabase clients, or proxy unless a direct verified auth bug requires it. Current reset callback behavior depends on `next=/reset-password`.

## Supabase State

Core tables include:

```text
users
units
roles
onboarding_progress
audit_logs
tasks
requests
comments
approvals
forum_posts
feature_flags
events
forum_daily_summaries
forum_daily_reports
```

## Migrations

All SQL is manual-only. Do not run SQL automatically.

| Migration | What it does | Notes |
| --- | --- | --- |
| `001_mvp_schema.sql` | Base schema | Run manually |
| `seed_units_roles.sql` | Units and roles seed | Run manually |
| `002_rls_policies.sql` | `is_commander()` and RLS sections A-G | Run manually |
| `003_events_schema.sql` | `public.events` | Required for `/schedule` |
| `004_task_event_link.sql` | `tasks.event_id -> events(id) ON DELETE SET NULL` | Tasks/events link |
| `005_request_event_link.sql` | `requests.event_id -> events(id) ON DELETE SET NULL` | Requests/events link |
| `006_closed_items_delete_rls.sql` | Closed delete policies for requests/tasks/events | Supersedes specific policies from 002 |
| `007_request_creator_update_rls.sql` | Request creator update policy | Request editing Phase 1 |
| `008_forum_rls.sql` | `forum_posts` + RLS | Forum Phase 1 |
| `009_forum_daily_summaries.sql` | `forum_daily_summaries` prototype | Legacy; do not build on it |
| `010_forum_hierarchical_daily_reports.sql` | `forum_daily_reports` + owner/commander RLS | Current forum daily model |
| `011_forum_daily_reports_commander_insert.sql` | Commander can create report for another active approved owner | Additive policy |
| `012_forum_daily_reports_delete_policy.sql` | Delete policy for daily reports | Commander OR creator OR owner |
| `013_add_commanded_unit_id.sql` | Adds `users.commanded_unit_id` and `idx_users_commanded_unit_id` | Run manually per user report; foundation only |
| `014_reference_data_read_policies.sql` | `units: public read` + `roles: public read` SELECT policies | Run manually 2026-06-19; recorded for DB/repo sync |
| `015_tracking_mvp.sql` | Tracking tables (`soldiers`, `tracking_items`, `tracking_records`), helpers (`current_app_user_id`, `current_tracking_unit_id`, `is_tracking_commander`, `can_edit_tracking_unit`), and RLS | Run manually in production; ע. מ"פ gets Tracking-scoped full access via `is_tracking_commander`; no delete policies (soft delete) |

### Migration 013 Notes

- `users.unit_id` represents the user's membership unit.
- `users.commanded_unit_id` represents the unit the user commands.
- Migration 013 was reportedly run manually in Supabase.
- Do not rerun it without a direct reason.
- It is not yet wired into real hierarchy RLS.
- Forum visibility is not yet wired to `commanded_unit_id`.

## RLS Model

- Commander helper: `public.is_commander(auth.uid())`.
- Requests/tasks/events: creator + commander Phase 1 policies.
- `forum_posts`: creator edits own, commander edits all.
- `forum_daily_reports`: owner/creator/commander model.
- Real unit hierarchy visibility is not fully modeled yet.
- Some forum visibility remains UI-gated until hierarchy mapping exists.

Do not implement fake hierarchy in RLS. Build explicit unit/user mapping first.

## Users / Units Lookup Rule

After migration 013, `users` has two foreign keys to `units`:

```text
unit_id
commanded_unit_id
```

Supabase/PostgREST embedded selects like `units(name)` from `users` are ambiguous and can fail with `PGRST201`.

Current rule:

- Do not use embedded `units(...)` from `users`.
- Load users without unit embeds.
- Load units separately by `unit_id`, using batch `.in('id', unitIds)` for lists.
- Map unit names client-side.
- Use shared Supabase error logging so `message`, `code`, `details`, `hint`, `status`, and context are visible instead of `{}`.

This was fixed globally in `73ed3a5 Fix ambiguous user unit lookups across protected pages`, after the initial dashboard fix in `717bcc9`.

## Dashboard

File: `src/app/(protected)/dashboard/page.tsx`

Current state:

- Loads profile, requests, tasks, events, audit logs, users.
- Profile/unit lookup no longer embeds `units(name)` from `users`; unit names are loaded separately.
- Missing profile states show a clearer message instead of an opaque console error.
- Summary stat cards.
- Attention list.
- Today's schedule.
- Open tasks.
- Recent activity.
- Quick Create for request/task/event.
- Best-effort audit after create.

## Requests

Current state:

- Create request.
- Search/filter/tabs.
- Status workflow.
- Assignee management.
- Comments/treatment history.
- Event link through `event_id`.
- Edit Phase 1: creator/commander can edit title, description, category, priority, event link.
- Closed deletion: completed/rejected/cancelled by creator or commander.
- Audit: create/status/assigned/comment/delete/update.

Guardrail:

- Metadata merge preserves `creator_name`, `creator_role`, `creator_unit`.
- Do not move `event_id` into metadata.

## Tasks

Current state:

- Create/edit/status/delete.
- `assigned_to`, `due_at`, `event_id`, `completed_at`.
- Quick filter chips: mine/urgent/blocked.
- Closed deletion: completed/cancelled by creator or commander.
- Audit: create/update/status/delete.

Guardrail:

- Metadata merge preserves provenance fields: `source_type`, `source_id`, `creator_name`, `creator_role`, `creator_unit`, `control_questions`, `stuck_reason`.
- Only `category`, `location`, `output_required` should be overwritten.

## Schedule / Events

Current state:

- Timeline and week grid.
- Day/week/all tabs.
- Create/edit/status/delete events.
- Auto-complete elapsed events client-side only.
- Linked tasks and requests in event modal.
- "Copy tomorrow schedule" WhatsApp output.
- Event edit can reopen a completed event to scheduled if moved to future.

Guardrail:

- Do not add recurring events, drag/drop, cron, Edge Functions, or Realtime without explicit planning.

## Forum Module - Full State

File: `src/app/(protected)/forum/page.tsx`  
Reference demo: `https://thepluton.vercel.app/`

The demo is UX/product-flow inspiration only. The current Next.js + Supabase + RLS implementation is the source of truth.

### Posts Tab - Forum Phase 1

Commit: `f47812b Add Supabase-backed Forum Phase 1`  
Migration: `008_forum_rls.sql`

- Table: `forum_posts`.
- Create posts.
- Edit posts.
- Pin posts for commanders.
- Creator can edit own post.
- Commander/canSeeAll can edit all posts.
- Audit actions:
  - `forum_post_created`
  - `forum_post_updated`

### Daily Hierarchical Reports

Commits:

```text
f5c1e40 Add hierarchical forum daily reports
2dfcff7 Polish forum UX and update handoff docs
```

Current table: `forum_daily_reports`.

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

Important DB fields:

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

- Fixed daily slots:
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
- Date picker and previous/today/next controls.
- Master-detail layout with grouped side list.
- Status chips and explicit "נדרש שיוך" chip for unmapped slots.
- Existing report renders as read-view card by default.
- "ערוך דוח" switches to edit form.
- "ביטול עריכה" restores read-view.
- Closed reports are read-only.
- `returned_note` appears as banner and side-list chip.
- Safe missing report renders draft form and first save creates the report.
- Unsafe missing owner mapping renders "נדרש שיוך משתמש" and does not create a wrong report.
- No fallback by `report_level` alone.
- Platoons 1-4 must remain separated by real identity keys.
- Create-for-subordinate exists for commander/admin workflows.
- Workflow: save, submit, return to lower echelon, approve/close, reopen.
- Reset report clears content, sets `draft`, clears summary/WhatsApp fields, and records reset metadata.
- Advanced delete remains available according to migration 012.
- WhatsApp short/detailed output and copy are available.

### Forum Daily Reports - Owner Mapping Diagnosis (2026-06-21) — RESOLVED

> **RESOLVED in the Forum Daily Structured Company Flow round (`c82492c`→`cdcd99f`).** Structural
> platoon slots are enriched and matched by `owner_user_id` + role/unit; `findReportForNode` matches
> enriched slots; the deterministic aggregation lives in the pure module
> `src/lib/forum/companyReport.ts` (`resolvePlatoonNumber`, `assignPlatoonReports`,
> `aggregateCompanyStructured`, `buildCompanyReport`); and `generateWhatsappText` reuses the same
> `assignPlatoonReports` path (no index-based labels, no omitted empty platoons). The "existing
> reports" fallback is preserved for unmatched/legacy reports. The historical diagnosis below is kept
> for context only. Full detail: [`FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`](FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md).

Historical Code X diagnosis files read (pre-fix):

- `src/app/(protected)/forum/page.tsx`
- `supabase/migrations/010_forum_hierarchical_daily_reports.sql`
- `supabase/migrations/011_forum_daily_reports_commander_insert.sql`
- `supabase/migrations/012_forum_daily_reports_delete_policy.sql`

Findings:

- `platoonNodes` are static IDs/labels for platoons 1-4. They do not carry real unit UUIDs.
- For commanders, `dailyNodes` creates structural slots like `${platoon.id}-summary` (`level: 'platoon'`) and `${platoon.id}-squads` (`level: 'squad'`).
- Those structural platoon slots have `requiresOwnerMapping: true`, but no `ownerUserId`, `unitId`, `platoon_unit_id`, or structural report key.
- `dynamicReportNodes` are created for every existing `dailyReports` row and grouped under "existing reports"; those nodes do have `reportId`, `ownerUserId`, and `unitId`.
- `loadOwnerOptions` queries `users` with `status = active` and `role_approval_status = approved`; it does not filter by unit/role/platoon. A small dropdown likely means DB data/RLS/user approval state needs verification.
- `loadDailyReports` queries `forum_daily_reports` by `report_date` only, ordered by `report_level` and `created_at`; it does not join users/units.
- `findReportForNode` can match by `reportId`, by `report_level + owner_user_id + staffRole`, or by owned/current-user paths. It cannot match an unmapped structural platoon slot by unit or role label.

Why Sgan Shuli falls under "existing reports":

- QA showed Sgan Shuli exists as an active owner label like `Sgan Shuli - MM 1 - Platoon 1` and has a report for 2026-06-21.
- The structural slot "Platoon 1 - MM summary" is only a placeholder with `requiresOwnerMapping: true`; it lacks `ownerUserId`/`unitId`.
- Therefore `findReportForNode` returns `null` for that slot.
- The same report is still loaded from `forum_daily_reports`, becomes a `dynamicReportNode`, and appears under "existing reports".

Diagnosis:

- Primary issue: UI/code mapping-model gap.
- Possible secondary issue: DB/RLS/roster completeness, because owner options only include active+approved users.
- Do not start with DB population or RLS changes. First implement a UI-only owner/slot matching layer.

Recommended first implementation:

1. Enrich structural slots using active/approved `ownerOptions` and role/unit labels.
2. Map MM 1 / Platoon 1 to the structural "Platoon 1 - MM summary" slot with `ownerUserId`/`unitId`.
3. Let `findReportForNode` match enriched slots by owner/report_level.
4. Keep "existing reports" as a fallback for unmatched/legacy reports; hide reports from fallback only after they matched a structural slot.

WhatsApp link (RESOLVED in `cdcd99f`):

- Previously `generateWhatsappText` iterated over `dailyReports`, so empty platoons 2/3/4 were omitted and labels were index-based.
- It now reuses the shared `assignPlatoonReports` / `findPlatoonSummaryOwner` mapping, consistent with the aggregation; platoons 1/2/3/4 map correctly in short and detailed previews.

### Forum Product Intent

- MK reports.
- MM consolidates platoon.
- MP sees all, returns/approves/closes.
- Staff roles add professional updates.
- Final output is a daily WhatsApp/forum summary.

### Forum Limitations

- Full MK -> MM -> MP flow requires real mapped users.
- Unit hierarchy mapping is not complete.
- Some visibility is still UI-gated.
- Real hierarchy RLS is a future phase.
- 009 is legacy/prototype.

## Audit Trail

File: `src/lib/audit.ts`

Audit is best-effort and non-blocking.

Actions:

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

Entity types:

```text
request
task
event
forum_post
forum_daily_summary
forum_daily_report
tracking_soldier
tracking_item
tracking_record
tracking_export
```

## AppContext / Demo Layer Warning

`src/lib/context/AppContext.tsx` still contains demo/localStorage state.

Do not delete or rewrite it without dependency mapping. Some legacy/demo areas still depend on it, including local types, gap tracking, and older audit UI behavior.

DB-backed modules use direct Supabase calls, but AppContext remains part of the shell/user context.

## Admin Commanded Unit

Commits:

```text
7b8050f Add commanded unit assignment to admin panel
5b5adc5 Fix admin commanded unit mapping
```

Current state:

- Admin supports editing `commanded_unit_id`.
- Dropdown label: `יחידה בפיקוד`.
- Can choose a unit or `-- ללא --`.
- Save updates `commanded_unit_id`.
- If present, user cards display `בפיקוד: [unit name]`.
- Users and units are loaded separately and mapped client-side to avoid FK-name dependency.

## Password Reset

Commit: `717bcc9 Fix dashboard profile lookup and add password reset flow`

- Login includes `שכחתי סיסמה`.
- Uses `supabase.auth.resetPasswordForEmail(...)`.
- Success message is generic and does not reveal whether an email exists.
- Adds route `/reset-password`.
- Reset page includes new password, confirmation, show/hide password, basic validation, and `supabase.auth.updateUser({ password })`.
- Auth callback supports `next=/reset-password` after `exchangeCodeForSession`.
- Build includes 18 routes because of `/reset-password`.

## Step 0 Cleanup

Commit: `96ae49b Remove orphaned legacy prototype shell and split session context`

- Removed 17 orphaned prototype/demo files.
- Removed old demo CRUD state.
- `src/lib/context/AppContext.tsx` is now session-only: `currentUser`, `isLoading`, and Supabase -> localStorage fallback.
- `src/lib/permissions.ts` and `src/lib/types.ts` were cleaned of dead legacy exports/types.
- `tsc`, `lint`, and `build` passed after cleanup.

## Known Technical Debt

| Area | Debt |
| --- | --- |
| AppContext | Session context remains shared shell dependency |
| AuditTab | Still not fully real `audit_logs` |
| Forum | Unit hierarchy mapping missing; visibility partly UI-gated; not wired to `commanded_unit_id` yet |
| Forum daily owner mapping | RESOLVED: structural platoon slots auto-match owners by `owner_user_id` + role/unit; "existing reports" fallback preserved for unmatched/legacy reports |
| Forum WhatsApp preview | RESOLVED in `cdcd99f`: maps platoons via the shared `assignPlatoonReports` path consistent with the aggregation |
| Forum daily structured flow open items | Non-blocking: duplicate dynamic company node (`forum/page.tsx:495-502`); unsaved company draft reset on slot switch (`forum/page.tsx:972-975`) |
| Forum daily UX polish | Dev-facing UI-gated text, destructive delete confirmation, panel visibility, placeholders/labels, and lifecycle button relevance need follow-up |
| RLS | Real hierarchy RLS not built |
| Users/Roles | Real MK/MM/MP/staff mapping and `commanded_unit_id` assignment needed |
| Requests | Edit Phase 1 excludes assigned_to/status/unit_id |
| Tasks | Assigned-user status-only permissions not solved |
| Events | No recurring/drag-drop/calendar integration |
| Product | No notifications/SLA/attachments |
| Deployment | No Vercel hardening yet |
| SQL | Manual migrations only |

## Next Recommended Phases

### Phase A - Real users QA setup

- Create/approve real users for MK, MM, MP, and staff roles.
- Assign real role/unit to each user.
- Assign `commanded_unit_id` where needed through Admin.
- QA full chain with real accounts.

### Phase B - Hierarchy mapping

- Design DB mapping for company, platoon, squad, commander relationships, and user assignment.
- Do not rely on UI labels for security.

### Phase C - Real RLS

- Additive migration only.
- Manual SQL only.
- No rewriting old migrations.

### Phase D - Full operational QA

- MK submits.
- MM consolidates.
- MP returns/approves/closes.
- Staff fills sections.
- WhatsApp summary is generated and copied.

### Phase E - Product expansion

- Notifications/SLA.
- Attachments.
- Recurring events/calendar integration.
- Deployment hardening.

## Product Decisions That Must Not Be Lost

1. No service role in frontend.
2. SQL manual only.
3. Use `src/proxy.ts`, not `middleware.ts`.
4. `event_id` is a real FK column in tasks and requests.
5. Deleting an event uses `ON DELETE SET NULL`; linked tasks/requests survive.
6. Audit is best-effort.
7. AppContext must not be deleted without dependency mapping.
8. Reference demo is inspiration only.
9. Forum hierarchy must not be faked in RLS.
10. Prefer additive migrations.
11. Do not embed `units(...)` from `users`; load units separately because both `unit_id` and `commanded_unit_id` reference `units`.
12. The מ״פ report is a structured form, not a free textarea.
13. Company aggregation is deterministic (`aggregateCompanyStructured()`); AI is not part of the fixed flow — only ever an opt-in, explicitly user-approved action.
14. Platoon assignment is by `owner_user_id` + role/unit; `metadata.node_label` is a last-resort fallback only; never by array index.
15. `created_by` (actor) is distinct from `owner_user_id` (report owner); both are preserved on every insert.

## Current Roadmap

```text
Step 0 - Cleanup orphaned legacy prototype shell - DONE in 96ae49b
Hotfix A - Password reset + Dashboard profile lookup - DONE in 717bcc9
Hotfix B - Global users/units ambiguity fix - DONE in 73ed3a5
Step 1 - Sync docs with 013 + cleanup + hotfix milestones - DONE
Step 2 - Forum daily UI-only owner/slot matching layer - DONE in 1c7414c
Step 2b - Forum daily slot-click scroll-into-view - DONE in 62fd8fe
Step 2c - Carry Forward / Rollover - DONE in c991be2
Step 2d - Forum Daily Phase A (layout/density, UI-only) - DONE in 1d37472
Step 2e - Forum Daily Structured Company Flow (structured מ״פ report, deterministic aggregation, owner mapping, ownership, publish/close/reopen, read-only after close) - DONE (c82492c->cdcd99f)
Step 3 - WhatsApp preview from mapped slots/platoons - DONE in cdcd99f
Step 3a - Duplicate dynamic company node cleanup (forum/page.tsx:495-502) - NEXT (P1)
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

## Current 2026-06-27 Prompt Override (Tracking checkpoint)

Use this current prompt and treat older prompt text below as superseded:

Continue `pluga-command-system` / "המפקד". First read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and `CLAUDE.md`. Latest commit is `16da109 Add Tracking status cycling and soft delete controls`; the Tracking MVP was built across `f2be781` (schema/RLS/skeleton, migration `015_tracking_mvp.sql`), `334fec7` (CRUD Phase 1), and `16da109` (Phase 2: cell status cycling + soft delete + in-app confirm modal). `/tracking` is a protected route with a "מעקב" nav item; tables `soldiers`/`tracking_items`/`tracking_records` exist with RLS in production; ע. מ"פ gets Tracking-scoped full access via `is_tracking_commander` (not via the global `is_commander`). CSV export, cell note editing, and filters are not implemented. QA data was left in production on purpose: soldier `QA Cycling Test 001`, tracking item `בוחן מסלול`, one `tracking_record` with status `עבר` — do not delete without approval. Stack: Next.js 16 with `src/proxy.ts` (not `middleware.ts`), React 19, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL/RLS. SQL is manual only; preserve Hebrew RTL and Light Gloss Command System; do not touch Auth/proxy/Supabase/RLS without explicit scope; do not start Tracking Phase 3 before approval; ask before commit/push. Immediate next steps: verify the Vercel deployment, decide what to do with the QA data, then (only on approval) pick a Tracking Phase 3 item.

## Old Prompt for New Claude/Codex Session (superseded)

Continue `pluga-command-system` / "המפקד". First read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and `CLAUDE.md`. Latest commit should be `2dfcff7 Polish forum UX and update handoff docs`; previous important commits are `f5c1e40 Add hierarchical forum daily reports` and `f47812b Add Supabase-backed Forum Phase 1`. Stack: Next.js 16 with `src/proxy.ts` (not `middleware.ts`), React 19, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL/RLS. Forum posts and hierarchical daily reports are Supabase-backed. Migrations 001-012 were run manually; 009 is legacy/prototype; 010+ is the current forum daily model. Do not run SQL automatically, do not use service role client-side, do not rewrite old migrations, preserve Hebrew RTL and Light Gloss Command System, and ask before commit/push. Next major phase is real users + hierarchy mapping + real hierarchy RLS.
## 2026-06-23 Prompt Override (superseded)

Use this current prompt and treat older prompt text above as superseded:

Continue `pluga-command-system` / "המפקד". First read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and `CLAUDE.md`. Latest commit should be `c991be2 Carry forward closed forum daily reports`; recent forum daily checkpoints are `813ef48 Document forum daily scroll checkpoint`, `62fd8fe Scroll forum daily slot selections into view`, and `1c7414c Map forum daily platoon owners to structural slots`. Forum daily now also has **Auto Carry Forward**: closing a report (`status='closed'`) auto-creates a next-Jerusalem-day draft for the same owner/level/unit with copied content (fire-and-forget best-effort; no upsert; duplicate `23505` skipped; `metadata.carried_forward_from_*`; audit `forum_daily_report_carried_forward`); the historical closed report is preserved and `reopen` still edits it, not tomorrow's draft; the native `window.confirm` was removed from report close only (delete/reset confirms stay). The rollover insert relies on existing RLS (010 J2 owner-self + 011 commander-for-owner) — no RLS change was made; if a future environment returns `42501`, stop and verify 011 before any RLS work. Recommended next tasks (UI/text polish, no DB/RLS): remove dev-facing "UI-gated..." text; fix WhatsApp preview grammar + empty platoons 2-4; add missing fields (לו״ז מחר, חריגים/פערים); labels/placeholders/lifecycle polish; optionally replace the remaining destructive native confirms (delete/reset) with in-site UI after a separate decision. Stack: Next.js 16 with `src/proxy.ts` (not `middleware.ts`), React 19, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL/RLS. SQL is manual only; preserve Hebrew RTL and Light Gloss Command System; do not touch Auth/proxy/Supabase/RLS without explicit scope; do not delete the "דוחות קיימים" fallback; ask before commit/push.

## Previous Session Prompt Override (superseded)

Continue `pluga-command-system` / "המפקד". First read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and `CLAUDE.md`. Latest commit should be `73ed3a5 Fix ambiguous user unit lookups across protected pages`; recent important commits include `717bcc9 Fix dashboard profile lookup and add password reset flow`, `96ae49b Remove orphaned legacy prototype shell and split session context`, `5b5adc5 Fix admin commanded unit mapping`, `7b8050f Add commanded unit assignment to admin panel`, `2dfcff7 Polish forum UX and update handoff docs`, `f5c1e40 Add hierarchical forum daily reports`, and `f47812b Add Supabase-backed Forum Phase 1`. Stack: Next.js 16 with `src/proxy.ts` (not `middleware.ts`), React 19, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL/RLS. Forum posts and hierarchical daily reports are Supabase-backed. Migrations 001-013 were run manually per project handoff; 009 is legacy/prototype; 010+ is the current forum daily model; 013 adds `users.commanded_unit_id` as foundation only. Do not run SQL automatically, do not use service role client-side, do not rewrite old migrations, preserve Hebrew RTL and Light Gloss Command System, do not embed `units(...)` from `users`, and ask before commit/push. Next major phase is real users QA, forum wiring to `commanded_unit_id`, hierarchy mapping, and real hierarchy RLS.

## 2026-06-24 Prompt Override (superseded by the 2026-06-27 override above)

> Superseded: this override predates the Tracking Module implementation. Tracking Phase B/C are now DONE (`f2be781` + `334fec7` + `16da109`); the "no Tracking code yet" instruction below no longer applies. Use the 2026-06-27 override above.

Continue `pluga-command-system` / "המפקד". First read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and `CLAUDE.md`. Latest commit is `1d37472 Simplify forum daily report layout and density` (Forum Daily Phase A: layout/density redesign of the report form, UI-only, single file `src/app/(protected)/forum/page.tsx`, no DB/RLS/Auth/proxy changes, lint/tsc/build green, Chrome-QA'd at 1117/768/500/390px). Forum Daily before that already has Auto Carry Forward (`c991be2`), slot-click scroll (`62fd8fe`), and owner/slot matching (`1c7414c`) — all still intact and unchanged by Phase A.

**Next major work is the Tracking Module, but only Phase B (Technical Execution Plan) — no Tracking code, DB, RLS, or migration yet.** Collaboration model: ChatGPT orchestrates/writes prompts, Code X implements once a plan is approved, Claude Code does deep planning/documentation/periodic review, Claude Chrome does visual QA against the live app and the reference demo. Decisions already locked: Tracking is spreadsheet-style (rows = soldiers, columns = exercises/qualifications, cells = status); soldiers come from a dedicated `soldiers` table, not `users`; export starts as CSV, Excel/Sheets API later; initial statuses are `empty/ריק`, `passed/עבר`, `failed/לא עבר`, `makeup/השלמה`. Open decisions to close in Phase B: מ״כ edit-vs-view scope, squad as free text vs a `squads` table, whether personal number is required, soldier delete vs inactive, one board vs many, and whether CSV export is full-dataset or filtered-view. See "NEXT MAJOR WORK: Tracking Module - Phase B" in this file for the full sequence. Do not write Tracking DB/RLS/migration/UI code before that plan is reviewed and approved.

Stack: Next.js 16 with `src/proxy.ts` (not `middleware.ts`), React 19, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL/RLS. SQL is manual only; preserve Hebrew RTL and Light Gloss Command System; do not touch Auth/proxy/Supabase/RLS without explicit scope; do not delete the "דוחות קיימים" forum fallback; do not start Tracking implementation before Phase B approval; ask before commit/push.
