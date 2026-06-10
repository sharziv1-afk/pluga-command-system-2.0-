# Project Summary - pluga-command-system

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
- Role-based interface for approved active users.
- Admin Panel for user approval and role/unit/permission management.
- Profile page.
- Light Gloss Command System: bright background, glass cards, orange `#FF6B02`, dark `#020108`, Hebrew RTL.
- Protected routes through `src/proxy.ts`.

### Dashboard

- Supabase-backed dashboard reads requests, tasks, events, audit logs, and users.
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

Migration 009 is legacy/prototype. The current forum model is 010+.

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

## Known Limitations

- Full MK -> MM -> MP flow requires real mapped users per role and platoon/squad.
- Full hierarchy mapping is not built yet.
- Real hierarchy RLS is a future phase.
- Some forum visibility is UI-gated.
- `009_forum_daily_summaries.sql` is legacy/prototype.
- AuditTab still reads localStorage.
- AppContext still contains demo/localStorage state.
- No notifications/SLA/attachments.
- No recurring events, drag/drop, or calendar integration.
- No automated migration runner.
- No Vercel production deployment yet.

## Recommended Next Phases

### Phase A - Real users QA setup

- Create/approve real users for MK, MM, MP, and staff roles.
- Assign real role/unit to every user.
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
