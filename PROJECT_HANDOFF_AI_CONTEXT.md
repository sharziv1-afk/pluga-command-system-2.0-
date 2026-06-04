# PROJECT_HANDOFF_AI_CONTEXT

Authoritative technical handoff for AI agents and developers continuing work on `pluga-command-system`.

**Last updated:** 2026-06-04
**Milestone:** Request + Event Editing Phase 1
**Last feature commit:** `e002163 Add request and event editing`

---

## Identity

- Repo name: `pluga-command-system`
- Product name: **"המפקד"**
- Description: Hebrew RTL company command-management system
- Local path: `C:\Users\Maltak 123\Desktop\pluga-command-system`
- GitHub: `https://github.com/sharziv1-afk/pluga-command-system-2.0-.git`
- Branch: `main`
- Working tree: clean as of this docs commit

---

## Git Log (last 12 commits)

```
9d25c8b Complete docs review: add commit naming guardrail and Quick Create details  ← latest (docs)
769ea01 Update project handoff after editing milestone
e002163 Add request and event editing                                                ← latest feature
dd2da33 Add dashboard quick create modals
3e12d3e Add Supabase dashboard summaries
07a565e Fix audit action count in documentation
66dea44 Update project handoff after closed-items milestone
ac47d00 Add closed item deletion and schedule auto-complete
097bf60 Link requests to schedule events
29d445d Polish schedule weekly view
066145e Add basic task editing
8788a9c Link tasks to schedule events
836d176 Add Events and Schedule v1
```

---

## Stack

- Next.js 16.2.6 App Router, `src/proxy.ts` (not middleware.ts)
- React 19.2.4
- TypeScript
- Tailwind CSS 4
- Supabase Auth (SSR helpers), Supabase PostgreSQL, RLS
- Lucide React, ESLint

---

## What to read first in a new session

1. `README.md` — quick status and migration table
2. `PROJECT_HANDOFF_AI_CONTEXT.md` (this file) — full technical decisions
3. `PROJECT_SUMMARY.md` — product/decision history
4. `AGENTS.md` — guardrails for code changes
5. `CLAUDE.md` — Claude Code-specific overrides

---

## Auth

Implemented in `src/app/(auth)/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/lib/supabase/browser.ts`, `src/lib/supabase/server.ts`, `src/proxy.ts`.

**Hybrid auth paradigm:**
- Existing user: Email + Password (`signInWithPassword`). Preserves Supabase email quotas.
- First registration: Email OTP (`signInWithOtp + shouldCreateUser: true`) → verify OTP (`verifyOtp`) → set password (`updateUser({ password })`) → create `public.users` profile → redirect to `/onboarding`.
- OTP input supports 8 digits.
- Dev Login exists under the form when `NODE_ENV !== "production"`.
- Magic Link callback `/auth/callback` remains as fallback.
- Password visibility toggles exist on all password fields.

**Supabase email template requirement:** `Authentication → Email Templates` must use `{{ .Token }}` (not only `{{ .ConfirmationURL }}`).

**Known issue:** `429 over_email_send_rate_limit` — Supabase rate limit, not an app bug.

**Do not touch:** `src/app/auth/callback/route.ts`, `src/proxy.ts`, `src/lib/supabase/*` unless a direct verified auth bug requires it.

---

## Supabase State

### Tables (from 001_mvp_schema.sql)

`users`, `units`, `roles`, `onboarding_progress`, `audit_logs`, `tasks`, `requests`, `comments`, `approvals`, `forum_posts`, `feature_flags`, `events` (003).

### Migrations — all run manually in Supabase

| Migration | What it does | Notes |
|-----------|-------------|-------|
| `001_mvp_schema.sql` | All base tables, enums, triggers, indexes | Run first |
| `seed_units_roles.sql` | Units + roles seed data | Run after 001 |
| `002_rls_policies.sql` | `is_commander()` + RLS sections A–G | Idempotent; run to recover |
| `003_events_schema.sql` | `public.events` table, enum, trigger, indexes | Required for /schedule |
| `004_task_event_link.sql` | `tasks.event_id → events(id) ON DELETE SET NULL` + index | Tasks ↔ Events |
| `005_request_event_link.sql` | `requests.event_id → events(id) ON DELETE SET NULL` + index | Requests ↔ Events |
| `006_closed_items_delete_rls.sql` | Replaces C6 + F8; adds events delete policy | Supersedes 002 for those two policies |
| `007_request_creator_update_rls.sql` | Adds `"requests: creator update own"` for request creator update | Events did not need this; G7 existed in 002 |

### RLS sections in 002_rls_policies.sql

- **A** — `public.is_commander(uuid)` — SECURITY DEFINER helper; checks active + approved + (מ"פ/סמ"פ or permission_level ≥ 90).
- **B** — `public.users` — select own, commander select all, commander update all.
- **C** — `public.requests` — insert own, select own, select own unit, commander select all, commander update all, **creator update own** (007). C6 (delete) was replaced by 006.
- **D** — `public.comments` — select/insert for request viewers.
- **E** — `public.audit_logs` — insert own, select own, commander select all.
- **F** — `public.tasks` — insert own, select own/assigned/own unit, commander select all, commander update all, creator update own. F8 (delete) was replaced by 006.
- **G** — `public.events` — insert own, select own/responsible/own unit, commander select all, commander update all, creator update own.

### Migration 006 — what it changed

006 does **not** modify 002. It:
1. Drops `"requests: commander delete completed"` (C6) and creates `"requests: delete closed"` — allows delete for `status IN ('completed','rejected','cancelled')` AND (commander OR `requested_by = users.id`).
2. Drops `"tasks: commander delete completed"` (F8) and creates `"tasks: delete closed"` — allows delete for `status IN ('completed','cancelled')` AND (commander OR `created_by = users.id`).
3. Creates `"events: delete closed"` — allows delete for `status IN ('completed','cancelled')` AND (commander OR `created_by = users.id`).

No column-level restrictions exist in Postgres RLS. Assigned-user status-only updates are therefore enforced in UI only.

### Rules

- No service role key in frontend code. Ever.
- No automatic SQL execution. Propose SQL, wait for manual execution.
- Do not re-run 001/002 in production. They are idempotent but unnecessary.

---

## Dashboard — Full State

File: `src/app/(protected)/dashboard/page.tsx`

### Data loading

Loads on mount via `loadDashboard()`:
1. Profile lookup (`users.maybeSingle`)
2. `Promise.all([requests, tasks, events, audit_logs])` — all via browser client / RLS
3. User name lookup for assignee display

No service role. No RPC. All anon-key browser client.

### UI sections

- **Stat cards** — פתוחות / דחופות / בטיפול / הושלמו (requests).
- **"דרוש טיפול"** — Urgent + open requests, overdue tasks; deduped via `Set<string>` composite key `${type}:${id}`.
- **"היום בלו״ז"** — Events filtered by Jerusalem-timezone day key.
- **Open tasks panel** — first 5 open/in_progress tasks.
- **Recent activity** — last 8 audit_log entries.

### Quick Create Modals (commit `dd2da33`)

Three forms accessible via header buttons: פתח דרישה / משימה חדשה / מופע חדש.

Each form:
- Uses a floating popover panel with `fixed` positioning to prevent clipping by parent containers. No dark/blur overlay backdrop.
- Description textareas use `command-input min-h-24 resize-none` (not `command-textarea` which does not exist in globals.css — this was corrected during this commit).
- Inserts directly to Supabase via browser client.
- Calls `void createAuditLog(...)` after success (best-effort).
- Calls `loadDashboard()` to refresh all data.
- No new RLS policies required.

### Decisions

- Dashboard is read-only summary + quick entry — no status actions or management.
- No service role, no admin bypass.

---

## Requests Module — Full State

### Schema fields used

`id`, `title`, `description`, `status`, `request_type`, `requested_by`, `assigned_to`, `unit_id`, `event_id`, `metadata`, `created_at`, `updated_at`.

`metadata`: `{ category, priority, creator_name, creator_role, creator_unit }`.

### Status values

`open | in_progress | approved | rejected | completed | cancelled`

### UI capabilities

- Create request (form with title, description, category, priority, optional event link).
- 4-stat header: פתוחות / דחופות / בטיפול / הושלמו.
- 7 queue tabs: הכל / שלי / פתוחות / דחופות / בטיפול / הושלמו / נדחו/בוטלו.
- Free-text search + category filter + priority filter.
- Status actions (commander): קבל לטיפול / אשר / סמן הושלם / דחה / בטל. Non-commanders: dropdown.
- Assignee management (commander only): set/clear `assigned_to`.
- Treatment history: `public.comments` with `entity_type='request'`.
- Audit trail: writes to `public.audit_logs`.
- Closed deletion: delete button for completed/rejected/cancelled for creator or commander.

### Requests ↔ Events (commit `097bf60`, migration 005)

- `requests.event_id → events(id) ON DELETE SET NULL` (added column, index).
- Optional event selection in create form.
- Request card shows `מופע: [title] · [time]` badge when linked.
- `/schedule` event modal shows `דרישות קשורות` section (RLS-filtered).
- Audit `request_created.newValue` includes `event_id`.
- Audit `request_deleted.previousValue` includes `event_id`.
- **Decided NOT to build:** request edit form, event_id change after creation, `request_event_changed` audit action — all Phase 2.

### Closed deletion (commit `ac47d00`, migration 006)

- Deletable: `completed`, `rejected`, `cancelled`.
- Not deletable: `open`, `in_progress`, `approved`.
- Allowed for: commander/canSeeAll OR `requested_by === dbProfile.id`.
- DB guard: RLS policy `"requests: delete closed"`.
- UI guard: `canDeleteRequest()` function + no extra `.eq('status', ...)` in query.
- Audit: `request_deleted` written after success.

### Request Editing Phase 1 (commit `e002163`, migration 007)

`canEditRequest = canSeeAll || request.requested_by === dbProfile.id`

**Editable fields:** title, description, request_type/category, metadata.priority, event_id.

**Not editable in this modal:** status, requested_by, unit_id, assigned_to, comments.

**Metadata merge pattern:**
```typescript
const mergedMetadata = {
  ...existingMetadata,         // preserves creator_name, creator_role, creator_unit + any other fields
  category: editCategory,
  priority: editPriority,
};
```

**Handler:** `handleEditRequest` — validates title, builds merged metadata, calls `.update({title, description, request_type, event_id, metadata}).eq('id', ...)`, on error shows inline `editError` and keeps modal open, on success calls `void createAuditLog(..., 'request_updated', ...)` + `loadRequests()`.

**Audit:** `request_updated` — previousValue includes title, description, request_type, priority, event_id; newValue same.

**RLS:** `"requests: creator update own"` from migration 007. Policy uses `USING` + `WITH CHECK` both checking `requested_by = (SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1)`. No column-level restriction — UI is the gate.

### Decisions

- `requested_by` stores `public.users.id` (verified by 'mine' tab filter working).
- Creator can edit their own request fields. Only UI prevents editing status/assigned_to.
- `request_event_changed` audit action still deferred to Phase 2.

---

## Tasks Module — Full State

### Schema fields used

`id`, `title`, `description`, `status`, `priority`, `assigned_to`, `created_by`, `unit_id`, `event_id`, `due_at`, `completed_at`, `metadata`, `created_at`, `updated_at`.

`metadata`: `{ category, location, output_required, control_questions, stuck_reason, source_type, source_id, creator_name, creator_role, creator_unit }`.

### Status values

`open | in_progress | blocked | completed | cancelled`

### Priority values

`רגילה | חשובה | דחופה | קריטית`

### UI capabilities (as of ac47d00)

- Create task (title, description, priority, assigned_to, due_at, event_id, category, location, output_required).
- 6 queue tabs: הכל / שיצרתי / באחריותי / פתוחות / בתהליך / הושלמו.
- Status update via select (creator or commander).
- Edit modal (Phase 1) — editable: title, description, priority, assigned_to, due_at, event_id, metadata.category/location/output_required. Status remains in card select.
- Metadata merge on edit preserves provenance fields (source_type, source_id, creator_name, creator_role, creator_unit, control_questions, stuck_reason).
- Closed deletion: completed or cancelled, for creator or commander.

### Tasks ↔ Events (commit `8788a9c`, migration 004)

- `tasks.event_id → events(id) ON DELETE SET NULL`.
- Dropdown in create + edit forms (shows scheduled/in_progress events per RLS).
- Task card shows `מופע: [title] · [time]` badge when linked.
- `/schedule` event modal shows `משימות קשורות` section (RLS-filtered).
- Audit `task_created.newValue` includes `event_id`.

### Task Editing Phase 1 (commit `066145e`)

- `canEditTask = canSeeAll || created_by === dbProfile.id`.
- Edit button in card, visible only to editors.
- Pre-populated modal. Status not in modal.
- `handleEditTask`: `.update({...}).eq('id', task.id)`. RLS F6/F7 enforce permission.
- Audit: `task_updated` with full previousValue/newValue diff.
- `editEventOptions` useMemo: if current event_id not in active events list, appends it.

### Closed deletion (commit `ac47d00`, migration 006)

- Deletable: `completed`, `cancelled`.
- Not deletable: `open`, `in_progress`, `blocked`.
- Allowed for: commander/canSeeAll OR `created_by === dbProfile.id`.
- Delete button shown inside `{canUpdate ? ...}` block — safe because canDeleteTask ⊆ canUpdate.
- Audit: `task_deleted` previousValue includes title, status, priority, assigned_to, created_by, unit_id, due_at, completed_at. (event_id not included — minor gap, not regression.)

### Decisions

- Assigned user has no expanded update permissions (RLS can't restrict columns; UI gates to creator/commander only).
- Phase 2: hierarchy/unit-level permissions, assigned-user status-only.

---

## Schedule / Events Module — Full State

### Schema

`public.events` from `003_events_schema.sql`.

Fields: `id`, `title`, `description`, `event_type`, `starts_at`, `ends_at`, `location`, `unit_id`, `created_by`, `responsible_user_id`, `status`, `metadata`, `created_at`, `updated_at`.

### Status values

`scheduled | in_progress | completed | cancelled`

### Event types

`training | logistics | meeting | inspection | operation | admin | other`

### UI capabilities

- Timeline view (day/hour grouping) + week grid (7 columns, horizontal scroll on mobile).
- Tabs: היום / מחר / השבוע / הכל.
- Events ended > 24h ago hidden from default view (client-side filter only, no DB change).
- Tomorrow and week calculated using Jerusalem timezone calendar day.
- Event creation form (title, description, type, responsible_user, starts_at, ends_at, location).
- Status update via select in modal footer.
- Click-through modal with full details, linked tasks section, linked requests section.
- Closed event deletion: completed or cancelled, for creator or commander.

### Auto-complete (commit `ac47d00`)

Function `shouldAutoCompleteEvent(event)`:
- Returns `true` only for `scheduled` or `in_progress`.
- Uses `ends_at` if present; falls back to `starts_at`.
- Checks `endTime < Date.now()`.

Runs inside `loadEvents()` after fetching raw events:
- Permission guard: `isCommanderRole(profileData.role, profileData.permission_level) OR event.created_by === profileData.id`.
- Sequential `for...of` loop — errors per-event are `continue`; page never crashes.
- No recursive `loadEvents()` call — state updated locally via `autoCompletedEventIds` Set.
- Audit `event_status_changed` written after each successful update, `newValue: { status: 'completed', auto_completed: true }`.

**Decision:** client-side only. No Supabase cron/Edge Function/scheduler.

### Closed event deletion (commit `ac47d00`, migration 006)

- Deletable: `completed`, `cancelled`.
- Not deletable: `scheduled`, `in_progress`.
- Allowed for: commander/canSeeAll OR `created_by === dbProfile.id`.
- `handleDeleteEvent`: confirm → `.delete().eq('id', event.id)` → audit `event_deleted` → `setSelectedEvent(null)` → `loadEvents()`.
- Confirm message: `"האם למחוק מופע זה? משימות ודרישות הקשורות אליו יתנתקו מהמופע אך לא יימחקו."`.
- Linked tasks and requests: `ON DELETE SET NULL` → `event_id` becomes null, items survive.
- Audit `event_deleted` previousValue: title, event_type, starts_at, ends_at, status, created_by, unit_id.

### Cross-module modal sections

Event detail modal includes:
- `משימות קשורות` — queried from `tasks WHERE event_id = selectedEvent.id`, RLS-filtered.
- `דרישות קשורות` — queried from `requests WHERE event_id = selectedEvent.id`, RLS-filtered.
- Both have `isMounted` guards, no infinite loops, separate loading states.

### Event Editing Phase 1 (commit `e002163`)

`canEditEvent = canSeeAll || event.created_by === dbProfile.id` (same as `canUpdateEventStatus`)

**Editable fields:** title, description, event_type, starts_at, ends_at, location, responsible_user_id.

**Not editable in this modal:** status (separate dropdown in detail footer), created_by, unit_id, metadata, linked tasks/requests.

**Validations:** title required, starts_at required, ends_at must be after starts_at.

**Handler:** `handleEditEvent` — validates, calls `.update({title, description, event_type, starts_at, ends_at, location, responsible_user_id}).eq('id', ...)`. On success: updates `events` state + `selectedEvent` locally, calls `void createAuditLog(..., 'event_updated', ...)` + `loadEvents()`.

**Audit:** `event_updated` — previousValue and newValue include all 7 editable fields.

**Status and auto-reopen:**
- Status is not an editable field in the edit form.
- **Exception:** if the event's current status is `completed` and the new `starts_at`/`ends_at` is in the future, `handleEditEvent` automatically sets `status: 'scheduled'` in the update payload and records `reopened_from_completed: true` in `event_updated.newValue`.
- `cancelled` events are never auto-reopened.

**RLS:** No new migration needed. `G7 "events: creator update own"` already existed in migration 002.

**UI:** Edit modal is z-[60], above the detail modal at z-50. `formatDateTimeLocalInput` pre-populates datetime-local inputs by converting ISO → local offset.

### Decisions

- No recurring events, drag/drop, Google Calendar, cron, Supabase Realtime.
- Old events hidden client-side only — no automatic DB deletion.
- Auto-complete is client-triggered (loadEvents) — retries on next load if RLS blocks.
- Event status is not an editable form field; status changes go through the separate status dropdown. The one exception is the auto-reopen: editing a `completed` event to a future time implicitly reopens it to `scheduled`.

---

## Audit Trail — Full State

File: `src/lib/audit.ts`
Table: `public.audit_logs`

### AuditActionType (as of e002163) — 14 total

```
request_created | request_status_changed | request_assigned
request_comment_added | request_deleted | request_updated
task_created | task_updated | task_status_changed | task_deleted
event_created | event_status_changed | event_deleted | event_updated
```

### entityType

`'request' | 'task' | 'event'`

### Rules

- All audit calls are `void createAuditLog(...)` — best-effort, non-blocking.
- Failures only `console.warn`, never throw.
- Audit is written only after the primary DB action succeeds.
- Auto-complete writes `event_status_changed` with `newValue.auto_completed = true`.

---

## AppContext / Demo Layer Warning

`src/lib/context/AppContext.tsx` still contains old demo/localStorage state.

Do **not** delete or rewrite it without mapping dependencies. The following still use it:

- Old `Task`, `LogisticsRequest`, `ForumSummary`, `AuditLog`, `Gap` types in `src/lib/types.ts`.
- `Forum` feature tab (still mock/localStorage).
- `AuditTab.tsx` (reads localStorage, not `public.audit_logs`).
- Gap tracking features (mock/localStorage).

The DB-backed modules (Requests, Tasks, Events) use their own local types and direct Supabase calls, completely bypassing AppContext.

---

## Known Technical Debt

| Area | Debt |
|------|------|
| AppContext | Demo/localStorage still active |
| Forum | Still mock/localStorage |
| AuditTab | Reads localStorage, not DB |
| types.ts | Old Task/LogisticsRequest types alongside DB types |
| Task assigned user | No status-only expanded update (RLS limitation) |
| Request Editing Phase 1 | Does not include assigned_to / status / unit_id |
| Event Editing Phase 1 | Does not include status / unit_id / metadata |
| Permissions | No hierarchy/unit-level Phase 2 |
| Deployment | No Vercel yet |
| Notifications | None |
| SLA | None |
| Attachments | None |
| Recurring events | Not built |
| Drag/drop | Not built |
| Calendar integration | Not built |
| Migration runner | Manual only |
| event_id hardening | Basic RLS only, no advanced filtering |
| requested_by UUID | Uses currentUser.id — same as public.users.id in practice (verified by 'mine' tab), but asymmetric with tasks which use dbProfile.id |

---

## Product Decisions That Must Not Be Lost

1. **No automatic DB deletion** — old events are hidden client-side, not deleted from DB.
2. **ON DELETE SET NULL** — deleting an event detaches linked tasks/requests; items survive.
3. **event_id is a real column** — not metadata. In both tasks and requests.
4. **Closed deletion Phase 1** — creator + commander. Unit hierarchy is Phase 2.
5. **Auto-complete is client-side** — no cron, no DB job, no scheduler.
6. **Metadata merge on task edit** — source_type, source_id, creator_name, creator_role, creator_unit, control_questions, stuck_reason are preserved; only category/location/output_required are updated.
7. **No request_event_changed audit action yet** — deferred to Phase 2.
8. **Request Editing Phase 1 live** — creator/commander can edit title, description, category, priority, event_id. Status/assigned_to/unit_id still Phase 2.
9. **Event Editing Phase 1 live** — creator/commander can edit title, description, type, times, location, responsible user. Status not a form field; editing a `completed` event to a future time auto-reopens it to `scheduled` (audit: `reopened_from_completed: true`).
10. **Assigned user cannot full-edit** — RLS cannot restrict column-level updates. Only creator/commander can edit. Phase 2 solution would require a SECURITY DEFINER function.
10. **Hebrew gershayim normalization** — `normalizeRole()` replaces both U+05F4 (״) and straight quotes to match commander role names consistently across modules.

---

## Prompt for New Claude Session

Continue `pluga-command-system` / "המפקד". Last commit: `e002163 Add request and event editing`. Stack: Next.js 16 (src/proxy.ts NOT middleware.ts), React 19, TypeScript, Tailwind 4, Supabase Auth/PostgreSQL/RLS. Auth: hybrid email+password / Email OTP. Working modules: Dashboard (Supabase summaries + Quick Create), Requests (full workflow + event link + closed deletion + Editing Phase 1), Tasks (Supabase + editing Phase 1 + event link + closed deletion), Events/Schedule (timeline, week grid, auto-complete, event link, closed deletion + Editing Phase 1). Migrations 001-007 all run in Supabase. Audit: 14 actions, best-effort. AppContext/forum still localStorage. No service role in frontend. No middleware.ts. Read README, PROJECT_HANDOFF_AI_CONTEXT, PROJECT_SUMMARY, AGENTS, CLAUDE before writing any code.

## Prompt for New Codex Session

Open `C:\Users\Maltak 123\Desktop\pluga-command-system` on branch `main`. Read README.md, PROJECT_HANDOFF_AI_CONTEXT.md, PROJECT_SUMMARY.md, AGENTS.md, CLAUDE.md first. Last feature commit: `e002163`. Uses Next.js 16 src/proxy.ts (not middleware.ts). Supabase migrations 001–007 all run manually. Key guardrails: keep Hebrew RTL, keep Light Gloss Command System, no service role in frontend, no AppContext/localStorage delete without dependency mapping, no npm audit fix --force. All three main modules (Requests, Tasks, Events) are Supabase-backed with event_id links, audit trail, closed-item deletion, and Editing Phase 1. Dashboard has real Supabase data + Quick Create. Forum and audit UI are still mock/localStorage.

---

## Files to Avoid Unless Necessary

- `src/app/auth/callback/route.ts`
- `src/proxy.ts`
- `src/lib/supabase/*`
- `supabase/migrations/001_mvp_schema.sql`
- `supabase/migrations/seed_units_roles.sql`
- `src/lib/context/AppContext.tsx`
- `src/app/providers.tsx`
