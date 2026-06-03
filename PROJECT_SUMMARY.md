# Project Summary — pluga-command-system

## Milestone Snapshot — 2026-06-03

**Milestone:** Closed Items Deletion + Schedule Auto-Complete
**Last commit:** `ac47d00 Add closed item deletion and schedule auto-complete`
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
- Audit: `event_created`, `event_status_changed`, `event_deleted`.

---

## Migrations Run (in order)

1. `001_mvp_schema.sql` — base tables, enums, triggers.
2. `seed_units_roles.sql` — units + roles seed.
3. `002_rls_policies.sql` — is_commander() + RLS sections A–G.
4. `003_events_schema.sql` — public.events.
5. `004_task_event_link.sql` — tasks.event_id FK.
6. `005_request_event_link.sql` — requests.event_id FK.
7. `006_closed_items_delete_rls.sql` — replaces C6/F8 from 002; adds events delete policy.

All were run manually in Supabase and verified.

---

## Audit Actions (as of ac47d00)

```
request_created          request_status_changed    request_assigned
request_comment_added    request_deleted
task_created             task_updated              task_status_changed
task_deleted
event_created            event_status_changed      event_deleted
```

All are best-effort: `void createAuditLog(...)`. Failures warn only.

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
| Metadata merge on task edit | Provenance fields (source_type, creator_name, etc.) are preserved |
| No request edit form yet | Complex workflow; deferred to Phase 2 |
| No column-level RLS | Postgres doesn't support it natively; assigned-user restrictions enforced in UI |
| Hebrew gershayim normalization | Critical for commander role detection across all modules |
| No service role key in frontend | Security non-negotiable |
| AppContext kept intact | Still depended on by Forum, audit UI, gap tracking |

---

## What Was Deliberately NOT Built

- Recurring events, drag/drop, Google Calendar integration.
- Supabase cron / Edge Functions / scheduler.
- Request edit form (Phase 2).
- Assigned-user expanded permissions (Phase 2).
- Hierarchy/unit-level delete permissions (Phase 2).
- request_event_changed audit action (Phase 2).
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

---

## Current Technical Debt

- AppContext: demo/localStorage (Forum, AuditTab, Gaps still depend on it).
- No request edit form.
- No hierarchy permissions.
- Dashboard summaries not real Supabase queries.
- No Vercel deployment.
- No notifications/SLA/attachments.
- task_deleted audit doesn't include event_id in previousValue (minor gap, not regression).

---

## Recommended Next Steps (ordered)

1. Short manual QA of all three modules after docs commit.
2. Real Supabase data in Dashboard summaries.
3. Forum module → Supabase.
4. Request edit form (parity with Task Editing Phase 1).
5. Notifications/SLA.
6. Hierarchy permissions Phase 2.
7. Vercel deployment.
8. Attachments.

---

## Build Status

As of `ac47d00`:

- `npm run lint` — 0 errors/warnings.
- `npx tsc -p tsconfig.json --noEmit` — 0 errors.
- `npm run build` — 17 routes, 0 errors.

Routes produced:
`/`, `/_not-found`, `/admin`, `/auth/callback (ƒ)`, `/dashboard`, `/forum`, `/help`, `/login`, `/onboarding`, `/pending-approval`, `/profile`, `/requests`, `/schedule`, `/select-role`, `/tasks`.