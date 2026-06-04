# pluga-command-system — "המפקד"

## Milestone Snapshot — 2026-06-04

**Last committed feature:** `e002163 Add request and event editing`

`pluga-command-system` / **"המפקד"** is a Hebrew RTL company command-management system. Built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase Auth/PostgreSQL/RLS, and GitHub. Future deployment target: Vercel.

**Critical:** this project uses `src/proxy.ts`, not `middleware.ts`.

---

## Recent Commits

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
```

---

## Tech Stack

| Layer | Version |
|-------|---------|
| Next.js App Router | 16.2.6 |
| React | 19.2.4 |
| TypeScript | — |
| Tailwind CSS | 4 |
| Supabase Auth | SSR helpers |
| Supabase PostgreSQL | RLS enabled |
| GitHub remote | `https://github.com/sharziv1-afk/pluga-command-system-2.0-.git` |

---

## What is working today

- **Auth** — hybrid: existing user email+password, new user Email OTP + password setup, Dev Login (dev only), Magic Link callback fallback, password visibility toggles.
- **Role Based Interface** — approved active commanders see full dashboard + Admin Panel; role/unit shown in sidebar/header.
- **Profile page** — `/profile` is protected, shows real user data from Supabase.
- **Admin Panel** — approve/reject users, edit roles/units, permission management.
- **Dashboard** — `/dashboard` connected to real Supabase data: requests, tasks, events, audit_logs, users. Summary stat cards, "דרוש טיפול" attention list with dedup, "היום בלו״ז", open tasks panel, recent activity feed. Quick Create floating modals for request/task/event from header buttons (insert → audit → reload). No service role.
- **Requests module** — full workflow: create, queue tabs, search, filters, status actions, assignee management, treatment history comments, audit trail, closed-item deletion. Linked to Events via `event_id`. **Editing Phase 1**: creator or commander can edit title, description, category, priority, event link — metadata merge preserves `creator_name/role/unit`.
- **Tasks module** — Supabase-backed: create, status update, edit (Phase 1), assigned_to, event_id, audit trail, closed-item deletion (completed/cancelled). Linked to Events via `event_id`.
- **Schedule / Events** — `/schedule`: timeline view, week grid, day tabs, event creation, status updates, auto-complete for elapsed events, closed-item deletion (completed/cancelled). Modal shows linked tasks and requests. **Editing Phase 1**: creator or commander can edit title, description, event type, times, location, responsible user.
- **Cross-module links** — Tasks ↔ Events (migration 004), Requests ↔ Events (migration 005). Deleting an event detaches linked items via `ON DELETE SET NULL`.
- **Audit trail** — 14 action types, best-effort, non-blocking, full entityType support.
- **Closed item deletion** — Phase 1: creator or commander can delete closed items across all three modules.

---

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` or `http://localhost:3000/login`.

Health checks (run after every change):

```bash
npm run lint
npx tsc -p tsconfig.json --noEmit
npm run build
```

Do not run `npm audit fix --force`.

---

## Environment Variables

Create `.env.local` from `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Never commit `.env.local` or real keys.

---

## Supabase Migrations

All migrations are in `supabase/migrations/`. Run manually in Supabase SQL Editor in order:

| File | Purpose | Status |
|------|---------|--------|
| `001_mvp_schema.sql` | Base schema: users, units, roles, tasks, requests, comments, audit_logs, events, approvals, forum_posts, feature_flags | ✅ run |
| `seed_units_roles.sql` | Seed: units (company, platoons 1-4, logistics, medical, comms, vehicles) and roles | ✅ run |
| `002_rls_policies.sql` | RLS policies sections A–G: is_commander(), users, requests, comments, audit_logs, tasks, events | ✅ run |
| `003_events_schema.sql` | `public.events` table, indexes, triggers, enums | ✅ run |
| `004_task_event_link.sql` | `tasks.event_id → events(id) ON DELETE SET NULL` | ✅ run |
| `005_request_event_link.sql` | `requests.event_id → events(id) ON DELETE SET NULL` | ✅ run |
| `006_closed_items_delete_rls.sql` | Replaces C6/F8 with expanded delete policies; adds events delete policy | ✅ run |
| `007_request_creator_update_rls.sql` | Adds `"requests: creator update own"` — request creator can update their own request | ✅ run |

**Note:** Migration 006 supersedes C6 and F8 from 002. Migration 007 adds a new policy (requests creator update) that did not exist in 002; events already had G7 creator update since 002.

---

## Routes

**Protected** (via `src/proxy.ts`): `/dashboard` `/tasks` `/requests` `/schedule` `/forum` `/admin` `/profile` `/help`

**Auth/Public**: `/login` `/onboarding` `/select-role` `/pending-approval` `/auth/callback`

---

## Design System — Light Gloss Command System

- Primary text: `#020108`
- Primary action orange: `#FF6B02`
- Main background: `#F6F7F9`
- Glass card: `rgba(255,255,255,0.72)` + blur + soft shadow
- Hebrew RTL first, mobile-friendly

---

## Known Technical Debt

- `AppContext` still has demo/localStorage state — do not delete without dependency mapping.
- `Forum` still mock/localStorage.
- `AuditTab.tsx` reads localStorage, not real `audit_logs`.
- Old `Task` / `LogisticsRequest` types in `types.ts` coexist with DB implementations.
- No assigned-user status-only edit for tasks/requests (RLS can't restrict columns; UI-only gate).
- No hierarchy/unit-based permissions (Phase 2).
- Request Editing Phase 1 does not include: assigned_to, status, unit_id.
- Event Editing Phase 1 does not include: status (separate dropdown), unit_id, metadata.
- No Vercel deployment.
- No notifications, SLA, attachments, recurring events, drag/drop.
- No automated migration runner — SQL is manual.

---

## Next Recommended Steps

1. Short manual QA across all modules after docs update.
2. Forum module → Supabase.
3. Hierarchy permissions (Phase 2).
4. Notifications / SLA.
5. Attachments.
6. Vercel deployment.
7. Request Edit Phase 2 (assigned_to integration if needed).
8. Recurring events / drag-drop / calendar integration.

---

## Guardrails

- Do not change `src/app/auth/callback/route.ts` without proven auth bug.
- Do not rename `src/proxy.ts` to `middleware.ts`.
- Do not delete `src/lib/context/AppContext.tsx` without mapping dependencies.
- Do not change schema/RLS/migrations without planning.
- Do not run `npm audit fix --force`.
- Never put a service role key in frontend code.
- Keep Hebrew RTL. Keep Light Gloss Command System.
