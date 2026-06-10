# PROJECT_HANDOFF_AI_CONTEXT

Authoritative technical handoff for AI agents and developers continuing work on `pluga-command-system`.

**Last updated:** 2026-06-10  
**Milestone:** Forum Phase 1 + hierarchical daily reports + Forum UX polish  
**Latest commit:** `2dfcff7 Polish forum UX and update handoff docs`

## Identity

- Repo name: `pluga-command-system`
- Product name: **"המפקד"**
- Description: Hebrew RTL company command-management system
- Local path: `C:\Users\Maltak 123\Desktop\pluga-command-system`
- GitHub: `https://github.com/sharziv1-afk/pluga-command-system-2.0-.git`
- Branch: `main`
- Expected state: `origin/main` updated, working tree clean

## Latest Git State

```text
2dfcff7 Polish forum UX and update handoff docs
f5c1e40 Add hierarchical forum daily reports
f47812b Add Supabase-backed Forum Phase 1
93eae89 Align project docs with editing milestone
9d25c8b Complete docs review: add commit naming guardrail and Quick Create details
769ea01 Update project handoff after editing milestone
e002163 Add request and event editing
dd2da33 Add dashboard quick create modals
```

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
- Dev Login exists only in non-production.
- Magic Link callback remains as fallback.

Do not touch auth callback, Supabase clients, or proxy unless a direct verified auth bug requires it.

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

## RLS Model

- Commander helper: `public.is_commander(auth.uid())`.
- Requests/tasks/events: creator + commander Phase 1 policies.
- `forum_posts`: creator edits own, commander edits all.
- `forum_daily_reports`: owner/creator/commander model.
- Real unit hierarchy visibility is not fully modeled yet.
- Some forum visibility remains UI-gated until hierarchy mapping exists.

Do not implement fake hierarchy in RLS. Build explicit unit/user mapping first.

## Dashboard

File: `src/app/(protected)/dashboard/page.tsx`

Current state:

- Loads profile, requests, tasks, events, audit logs, users.
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
```

Entity types:

```text
request
task
event
forum_post
forum_daily_summary
forum_daily_report
```

## AppContext / Demo Layer Warning

`src/lib/context/AppContext.tsx` still contains demo/localStorage state.

Do not delete or rewrite it without dependency mapping. Some legacy/demo areas still depend on it, including local types, gap tracking, and older audit UI behavior.

DB-backed modules use direct Supabase calls, but AppContext remains part of the shell/user context.

## Known Technical Debt

| Area | Debt |
| --- | --- |
| AppContext | Demo/localStorage state still active |
| AuditTab | Still not fully real `audit_logs` |
| Forum | Unit hierarchy mapping missing; visibility partly UI-gated |
| RLS | Real hierarchy RLS not built |
| Users/Roles | Real MK/MM/MP/staff mapping needed |
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

## Prompt for New Claude/Codex Session

Continue `pluga-command-system` / "המפקד". First read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and `CLAUDE.md`. Latest commit should be `2dfcff7 Polish forum UX and update handoff docs`; previous important commits are `f5c1e40 Add hierarchical forum daily reports` and `f47812b Add Supabase-backed Forum Phase 1`. Stack: Next.js 16 with `src/proxy.ts` (not `middleware.ts`), React 19, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL/RLS. Forum posts and hierarchical daily reports are Supabase-backed. Migrations 001-012 were run manually; 009 is legacy/prototype; 010+ is the current forum daily model. Do not run SQL automatically, do not use service role client-side, do not rewrite old migrations, preserve Hebrew RTL and Light Gloss Command System, and ask before commit/push. Next major phase is real users + hierarchy mapping + real hierarchy RLS.
