# Project Summary — pluga-command-system

## Milestone Snapshot — 2026-06-04

**Milestone:** Request + Event Editing Phase 1
**Last commit:** `e002163 Add request and event editing`
**Branch:** `main` — clean working tree

---

## What the product is

**"המפקד"** is a Hebrew RTL command-management system for a company-level command team. It centralizes:

- Logistics requests and follow-up (Requests module)
- Task assignment and tracking (Tasks module)
- Schedule and events management (Schedule/Events module)
- Role-based access and approval (Admin Panel)
- Forum updates (planned; currently mock)

Target roles: מ"פ, סמ"פ, ע. מ"פ, מ"מ, מ"כ, סמל, רס"פ/לוגיסטיקה, חובש פלוגתי, קשר פלוגתי, ב.קוד/נהג.

---

## Full Build History

### Foundation (pre-milestone)

- Auth: hybrid Email OTP + password setup for registration; email+password for login. Dev Login for local work. Magic Link callback fallback. Password visibility toggles.
- Role-based interface: approved active commanders see full dashboard and Admin Panel.
- Admin Panel: approve/reject users, edit roles/units/permissions.
- Profile page.
- Design: **Light Gloss Command System** (bright, glass cards, orange #FF6B02, dark #020108 text, RTL).
- Layout: fixed sidebar 1280px+; compact top nav below 1280px; no overlay; one menu button.

### Dashboard module

- `/dashboard` connected to real Supabase data (`3e12d3e`): loads requests, tasks, events, audit_logs, users via Promise.all + browser client (no service role).
- Summary stat cards: פתוחות / דחופות / בטיפול / הושלמו.
- "דרוש טיפול" attention list: deduped by composite key, sorted by priority/status.
- "היום בלו״ז" today's events.
- Open tasks panel + recent activity feed.
- Quick Create modals (`dd2da33`): floating popover panel (fixed positioning, no dark/blur overlay) for request/task/event creation from header buttons. Description textareas use `command-input min-h-24 resize-none` (`command-textarea` class does not exist). Each form inserts to Supabase, writes best-effort audit, and calls loadDashboard(). No RLS changes required.

### Requests module

- Basic creation → `public.requests` via Supabase.
- Queue tabs: הכל / שלי / פתוחות / דחופות / בטיפול / הושלמו / נדחו/בוטלו.
- Free-text search + category + priority filters.
- Status actions: contextual buttons for commanders, dropdown for others.
- Assignee management: commanders can set/clear `assigned_to`.
- Treatment history: `public.comments`, `entity_type='request'`.
- Audit trail: `request_created`, `request_status_changed`, `request_assigned`, `request_comment_added`, `request_deleted`.
- Completed-request deletion (commander only) — later expanded by migration 006.
- Requests ↔ Events link (`097bf60`, migration 005): optional event dropdown on create; badge on card; `דרישות קשורות` in Schedule modal.
- Closed deletion expanded (`ac47d00`, migration 006): completed + rejected + cancelled deletable by creator or commander.
- Request Editing Phase 1 (`e002163`, migration 007): edit modal for creator (`requested_by`) or commander. Editable: title, description, category/request_type, metadata.priority, event_id. Metadata merge preserves `creator_name`, `creator_role`, `creator_unit`. Audit: `request_updated`.

### Tasks module

- Moved from localStorage to Supabase (`5bd714d`).
- Create/edit/status-update/delete tasks in `public.tasks`.
- `completed_at` set/cleared on status transition.
- Metadata fields: category, location, output_required, control_questions, source_type.
- Tasks ↔ Events link (`8788a9c`, migration 004): optional event dropdown; `משימות קשורות` in Schedule modal.
- Task Editing Phase 1 (`066145e`): edit modal for creator/commander; metadata merge preserves provenance.
- Closed deletion (`ac47d00`, migration 006): completed + cancelled deletable by creator or commander.
- Audit: `task_created`, `task_updated`, `task_status_changed`, `task_deleted`.

### Schedule / Events module

- New route `/schedule`, protected via `src/proxy.ts`.
- `public.events` via migration 003.
- Timeline view + week grid (7 columns).
- Tabs: היום / מחר / השבוע / הכל. Jerusalem-timezone day calculation.
- Events ended >24h ago hidden client-side (no DB deletion).
- Event creation, status updates, linked tasks/requests sections in modal.
- Auto-complete (`ac47d00`): if `ends_at` (or `starts_at`) has passed and user can update → event moved to `completed` on page load; client-side only, no cron.
- Closed event deletion (`ac47d00`, migration 006): completed + cancelled deletable by creator or commander; deleting event nullifies `event_id` on linked tasks/requests (`ON DELETE SET NULL`).
- Event Editing Phase 1 (`e002163`): edit modal for creator (`created_by`) or commander. Editable: title, description, event_type, starts_at, ends_at, location, responsible_user_id. Status is not an editable field in the form; however, if a `completed` event is edited to a future time, it is automatically re-opened to `scheduled` with `event_updated.newValue.reopened_from_completed = true`. `cancelled` events are never auto-reopened. Validation: title required, starts_at required, ends_at > starts_at. Audit: `event_updated`. No new migration needed — G7 creator update already existed in 002.
- Audit: `event_created`, `event_status_changed`, `event_deleted`, `event_updated`.

---

## Migrations Run (in order)

1. `001_mvp_schema.sql` — base tables, enums, triggers.
2. `seed_units_roles.sql` — units + roles seed.
3. `002_rls_policies.sql` — is_commander() + RLS sections A–G.
4. `003_events_schema.sql` — public.events.
5. `004_task_event_link.sql` — tasks.event_id FK.
6. `005_request_event_link.sql` — requests.event_id FK.
7. `006_closed_items_delete_rls.sql` — replaces C6/F8 from 002; adds events delete policy.
8. `007_request_creator_update_rls.sql` — adds `"requests: creator update own"` (did not exist in 002; events G7 already existed).

All were run manually in Supabase and verified.

---

## Audit Actions (as of e002163)

```
request_created          request_status_changed    request_assigned
request_comment_added    request_deleted           request_updated
task_created             task_updated              task_status_changed
task_deleted
event_created            event_status_changed      event_deleted
event_updated
```

Total: 14 action types. All are best-effort: `void createAuditLog(...)`. Failures warn only.

---

## Closed Item Deletion — Design Decisions

| Module | Deletable statuses | Non-deletable |
|--------|-------------------|---------------|
| Requests | completed, rejected, cancelled | open, in_progress, approved |
| Tasks | completed, cancelled | open, in_progress, blocked |
| Events | completed, cancelled | scheduled, in_progress |

Who can delete: **Phase 1 — creator OR commander (canSeeAll)**.

Phase 2 (not built): unit hierarchy, permission_level comparison.

---

## Key Decisions Not to Lose

| Decision | Why |
|----------|-----|
| ON DELETE SET NULL for event_id | Tasks/requests survive when their linked event is deleted |
| event_id as real column, not metadata | Enables proper FK, indexing, and RLS filtering |
| Auto-complete is client-side only | No cron/scheduler needed for MVP; retries on next loadEvents() |
| Metadata merge on task/request edit | Provenance fields (source_type, creator_name, etc.) are preserved across edits |
| Request edit creator update via migration 007 | New RLS policy; events didn't need one (G7 existed in 002) |
| Event status not editable as a form field | Status changes via separate dropdown; exception: editing a `completed` event to a future time auto-reopens it to `scheduled` |
| No column-level RLS | Postgres doesn't support it natively; assigned-user restrictions enforced in UI |
| Hebrew gershayim normalization | Critical for commander role detection across all modules |
| No service role key in frontend | Security non-negotiable |
| AppContext kept intact | Still depended on by Forum, audit UI, gap tracking |

---

## What Was Deliberately NOT Built

- Recurring events, drag/drop, Google Calendar integration.
- Supabase cron / Edge Functions / scheduler.
- Assigned-user expanded update permissions (Phase 2).
- Hierarchy/unit-level edit/delete permissions (Phase 2).
- request_event_changed audit action (Phase 2).
- Request edit: assigned_to / status / unit_id (Phase 2).
- Event edit: status / unit_id / metadata (Phase 2).
- Vercel deployment.
- Notifications, SLA, attachments.
- Automated migration runner.
- Forum → Supabase migration.
- Real-time audit UI.

---

## What Claude Reviewed and Approved

Each of the following had a dedicated QA pass by Claude before SQL was run or commit was made:

1. Tasks ↔ Events link (migration 004, tasks page, schedule page) — before SQL.
2. Task Editing Phase 1 (tasks page, audit.ts) — before commit.
3. Requests ↔ Events link (migration 005, requests page, schedule page) — before SQL.
4. Closed Items Deletion Phase 1 (migration 006, all three pages, audit.ts) — before SQL.
5. Schedule Auto-Complete addition (schedule page) — before final commit.
6. Dashboard Supabase summaries + Quick Create modals (dashboard page) — before commit.
7. Request + Event Editing Phase 1 (requests page, schedule page, audit.ts, migration 007) — before SQL and commit.

QA covered: lint ✅ tsc ✅ build ✅ for all milestones.

---

## What SQL Was Run Manually

| SQL | When | Verified |
|-----|------|---------|
| 001_mvp_schema.sql | Project start | ✅ |
| seed_units_roles.sql | Project start | ✅ |
| 002_rls_policies.sql sections A–G | Incremental | ✅ |
| 003_events_schema.sql | Events v1 | ✅ |
| 004_task_event_link.sql | Tasks ↔ Events | ✅ |
| 005_request_event_link.sql | Requests ↔ Events | ✅ |
| 006_closed_items_delete_rls.sql | Closed deletion milestone | ✅ |
| 007_request_creator_update_rls.sql | Request + Event Editing milestone | ✅ |

---

## Current Technical Debt

- AppContext: demo/localStorage (Forum, AuditTab, Gaps still depend on it).
- No hierarchy permissions.
- Request Editing Phase 1 omits: assigned_to, status, unit_id.
- Event Editing Phase 1 omits: status, unit_id, metadata.
- No Vercel deployment.
- No notifications/SLA/attachments.
- task_deleted audit doesn't include event_id in previousValue (minor gap, not regression).
- No automated migration runner — SQL is manual.

---

## Recommended Next Steps (ordered)

1. Short manual QA across all modules after docs commit.
2. Forum module → Supabase.
3. Hierarchy permissions Phase 2.
4. Notifications/SLA.
5. Attachments.
6. Vercel deployment.
7. Request Edit Phase 2 (assigned_to integration if needed).
8. Recurring events / drag-drop / calendar integration.

---

## Build Status

As of `e002163`:

- `npm run lint` — 0 errors/warnings.
- `npx tsc -p tsconfig.json --noEmit` — 0 errors.
- `npm run build` — 15 routes + Proxy, 0 errors.

Routes produced:
`/`, `/_not-found`, `/admin`, `/auth/callback (ƒ)`, `/dashboard`, `/forum`, `/help`, `/login`, `/onboarding`, `/pending-approval`, `/profile`, `/requests`, `/schedule`, `/select-role`, `/tasks`.