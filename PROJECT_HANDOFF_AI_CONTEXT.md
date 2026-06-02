# PROJECT_HANDOFF_AI_CONTEXT

This document is for future AI agents and developers continuing work on `pluga-command-system`.

Project name: `pluga-command-system`  
Product name: **"המפקד"**  
Purpose: Hebrew RTL command-management system for a company-level command team.

## Final Handoff Before Restart - 2026-06-02

This is the current authoritative handoff snapshot for future AI agents after the long ChatGPT/Codex/Claude work session.

Repository:

- Local path: `C:\Users\Maltak 123\Desktop\pluga-command-system`
- GitHub: `https://github.com/sharziv1-afk/pluga-command-system.git`
- Branch: `main`
- Previous latest pushed feature commit before Events/Schedule v1: `5bd714d Add Supabase-backed Tasks v1`
- Latest feature ready for commit: Events / Schedule v1
- Working tree was clean before this documentation update.
- `.claude/` is ignored in `.gitignore` and must stay out of Git.

Product:

- Project: `pluga-command-system`
- Product name: **"המפקד"**
- Hebrew RTL company command-management system.
- Role-based interface targets: מ"פ, סמ"פ, ע. מ"פ, מ"מ, מ"כ, סמל, רס"פ / לוגיסטיקה, חובש פלוגתי, קשר פלוגתי, ב.קוד / נהג.

Stack:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth
- Supabase PostgreSQL
- Supabase RLS
- GitHub
- Future deployment target: Vercel
- Important: this project uses `src/proxy.ts`; do not create `middleware.ts`.

### Current Capabilities

- Auth works.
- First registration uses Email OTP + password setup.
- Existing login uses email + password.
- OTP input supports 8 digits.
- Supabase Email Template must use `{{ .Token }}` instead of only `{{ .ConfirmationURL }}`.
- Dev Login exists only in development.
- Magic Link callback remains as a fallback.
- Password visibility toggles exist on login, registration password, and registration confirmation password fields.
- Real Supabase profile loading is connected.
- Sidebar and MobileHeader show user name, role, and unit.
- Dashboard content is role-specific.
- Profile page exists.
- Admin Panel exists for approved active commanders / high-permission users.
- Requests module is connected to Supabase and has progressed through basic requests, workflow queues, assignee management, treatment comments, real request audit logging, and completed-request deletion.
- Events / Schedule v1 is connected to Supabase and works through `/schedule`.

### Manual QA Already Passed

- Approved + active מ"פ can log in.
- Approved + active מ"פ sees commander dashboard content.
- Admin Panel appears for approved + active מ"פ.
- Sidebar/Header display the connected user, role, and unit.
- Profile page renders.
- `/requests` loads.
- Request creation works and writes to `public.requests`.
- RLS policies for `public.users` and `public.requests` were run manually in Supabase and work.
- Approved + active commanders can see requests.
- Browser QA with Playwright/Chrome was performed by Claude Code across login, dashboard, requests, admin, profile, and responsive widths `1440`, `1280`, `1200`, `1024`, `768`, `390`.
- Browser QA findings that were fixed: missing mobile Admin link, commander action visibility caused by role/permission normalization, search/filter issue, compact navigation issues, and QuickHelp positioning.

### Latest Manual QA

- `assigned_to` update was verified live in Supabase after the latest assignee UI.
- `public.comments` RLS policies were applied manually in Supabase and documented in `supabase/migrations/002_rls_policies.sql`.
- `public.comments` select/insert was verified live against Supabase/RLS after the treatment history feature.
- Request Treatment History works in the site; no React code change was required.
- Real Audit Trail for Requests works with `src/lib/audit.ts`.
- Request actions write best-effort audit rows for `request_created`, `request_status_changed`, `request_assigned`, `request_comment_added`, and `request_deleted`.
- `public.audit_logs` RLS section E was manually run in Supabase and verified.
- Completed-request deletion works in the completed tab for commander-level users only.
- `requests: commander delete completed` was manually run in Supabase and verified.
- `unit_id` behavior is accepted: requests are associated to the creator profile unit; existing profiles missing `unit_id` use a fallback resolver, and future users per unit/department should work correctly.

### Events / Schedule v1

- New route: `/schedule`.
- Navigation item: `לו״ז` was added through `src/data/navigation.ts`.
- Route protection: `/schedule` is protected through `src/proxy.ts`.
- Database migration: `supabase/migrations/003_events_schema.sql` adds `public.events`.
- RLS documentation: Section G in `supabase/migrations/002_rls_policies.sql` covers `public.events`.
- Page behavior: tabs for today/tomorrow/week/all, summary counters, timeline view grouped by day and hour, compact event blocks, click-to-open details modal, event creation, status update, loading/error/empty states.
- Audit: `src/lib/audit.ts` supports `event_created`, `event_status_changed`, and future `event_updated`; audit `entityType` supports `request | task | event`.
- Types: `DbEvent` was added to `src/lib/types.ts`.
- Layout: protected shell uses viewport height and an internal main scroll area to improve sidebar and modal behavior.
- Manual SQL for new environments: run `003_events_schema.sql`, then Section G for `public.events` RLS.
- Not included yet: task `event_id`, calendar grid, drag/drop, recurring events, Google Calendar, Forum integration, or AI.

### Important Commits

- `c8aa98d Allow 8 digit email OTP codes`
- `02c54e5 Use password login for existing users and OTP registration`
- `652276b Add password visibility toggles`
- `6f6c0d4 Add role based interface and commander approval panel`
- `7521e75 Add basic requests module`
- `3760a2a Document verified requests flow`
- `a296ef6 Stabilize RLS policy documentation and admin client`
- `6b2d7f6 Add requests workflow filters and status queues`
- `388a815 Fix responsive layout and requests search input`
- `c4e1ad6 Fix compact navigation and quick help modal`
- `c22177c Fix mobile admin link and commander role detection`
- `2e1d576 Add request assignee management`
- `3582eeb Add request treatment history comments`
- `24651be Add comments RLS policies for request treatment history`
- `d11279d Add Audit Trail for Requests`
- `084b810 Add audit trail and completed request deletion`

### Requests Module Evolution

Basic Requests:

- `/requests` works.
- Users can open a request.
- Requests are saved in `public.requests`.
- `request_type` stores category.
- `metadata.priority` stores priority.
- `metadata.creator_name`, `metadata.creator_role`, and `metadata.creator_unit` store creator display fields.
- `requested_by = public.users.id`.
- `unit_id` is stored when available.

Requests Workflow v1:

- Stats cards.
- Queue tabs: הכל, שלי, פתוחות, דחופות, בטיפול, הושלמו, נדחו/בוטלו.
- Free-text search.
- Category filter.
- Priority filter.
- Status actions:
  - `open ->` קבל לטיפול / אשר / דחה / בטל
  - `in_progress ->` אשר / סמן הושלם / דחה / בטל
  - `approved ->` סמן הושלם / בטל
  - terminal statuses have no action buttons.
- Assigned-to display: `מטפל: [שם]` or `טרם הוקצה`.

Fixes after Browser QA:

- Mobile Admin link fixed.
- `normalizeRole` updated to support both regular quotes and smart Hebrew quotes.
- Requests has fallback permission inference by role so commanders are recognized even if `permission_level` is missing or `0`.
- Search input uses `type="text"`.
- Commander actions work for non-terminal request statuses.

Assign Request Owner:

- Commanders / permission >= 90 can assign a handler through a select.
- Regular users can see the handler but cannot change it.
- Removing assignment sets `public.requests.assigned_to = null`.
- No schema change was made. `public.comments` RLS policies were added manually in Supabase and documented in Git.

Request Comments / Treatment History:

- Each request card has a compact treatment history panel.
- Uses existing `public.comments`.
- `entity_type = 'request'`.
- `entity_id = request.id`.
- `user_id = public.users.id`.
- `body =` comment text.
- `metadata = { author_name, author_role }`.
- Empty comments are blocked client-side.
- Clear errors are shown if comment loading or insertion fails.
- Live Supabase/RLS verification passed for `public.comments` select/insert.

Request Audit Trail:

- `src/lib/audit.ts` contains `createAuditLog`, a best-effort Supabase insert helper for `public.audit_logs`.
- Request create, status change, assignee change, comment add, and completed-request delete actions call audit after the primary Supabase action succeeds.
- Audit insert failures only warn in the console and do not block the request workflow.
- `DbAuditLog` was added to `src/lib/types.ts` without changing the existing mock/localStorage `AuditLog`.
- `AuditTab.tsx` and the AppContext/localStorage audit mock are intentionally untouched.
- `public.audit_logs` RLS was manually run and verified in Supabase.

Completed Request Deletion:

- Delete button appears only in the completed tab.
- Delete button appears only when `request.status === 'completed'`.
- Delete is available only to `canSeeAll` / commander-level users.
- Regular users do not see delete.
- The delete query also guards `.eq('status', 'completed')`.
- A confirmation prompt appears before delete.
- `request_deleted` audit is written after successful delete.

Unit ownership:

- `unit_id` means which unit/department the item belongs to.
- `assigned_to` means who handles the request/task.
- Request insert uses `dbProfile.unit_id`.
- If an existing profile is missing `unit_id`, `resolveRequestUnitId` tries `dbProfile.units.name` or `currentUser.assigned_frame`.
- No immediate UI selector for "requesting unit" is needed.

### Supabase / Schema / Seed

Existing tables in `001_mvp_schema.sql`:

- `users`
- `units`
- `roles`
- `onboarding_progress`
- `audit_logs`
- `tasks`
- `requests`
- `comments`
- `approvals`
- `forum_posts`
- `feature_flags`

Seed:

- `seed_units_roles.sql` was already run manually in Supabase.
- Units include company, platoons 1-4, logistics, medical, communications, vehicles.
- Roles include מ"פ, סמ"פ, ע. מ"פ, רס"פ, חובש, קשר, נהג, מ"מים, סמלים, מ"כים.

RLS:

- `public.is_commander(auth_id uuid)` exists in `supabase/migrations/002_rls_policies.sql`.
- It uses `SECURITY DEFINER` and `SET search_path = public`.
- It checks active + approved users whose role is מ"פ/סמ"פ or whose `permission_level >= 90`.
- `public.users` policies: select own profile, commander select all, commander update all.
- `public.requests` policies: insert own, select own, select own unit, commander select all, commander update all.
- `public.comments` table exists and is used by the app. Comments RLS is documented and select/insert was manually verified.
- `public.audit_logs` table exists and is written by request actions. Insert own/select own/commander select all was manually verified.
- `public.requests` delete completed policy allows commanders to delete only completed requests.
- Do not run SQL automatically. Propose SQL and wait for manual Supabase execution approval.
- Never put a service role key in frontend code.

### UI / Layout

- Primary design language: **Light Gloss Command System**.
- Bright glossy UI with orange `#FF6B02`, light glass cards, Hebrew RTL, and a subtle night variant.
- Theme toggle works and persists day/night choice.
- Search input alignment was fixed.
- Responsive layout final approach:
  - `1280px+`: fixed sidebar.
  - Below `1280px`: compact top navigation inside the document flow.
  - No overlay hiding content.
  - One menu button only.
- QuickHelp is a centered modal/card and no longer clips on compact layouts.

### Technical Debt / Known Risks

- `AppContext` still contains demo/localStorage state.
- `tasks` and `forum` still rely on mock/localStorage behavior.
- `Profile.status` currently maps `role_approval_status` because the app-level `UserStatusType` is `pending | approved | rejected`; it does not directly represent `users.status` (`active | pending | blocked | inactive`). Do not change this without full type and authorization mapping.
- `users.role` is text, not a foreign key to `roles`.
- Request priority is stored in `metadata`, not a dedicated column.
- `assigned_to` works in UI and passed live Supabase verification after latest changes.
- Comments/history were added and passed live comments RLS verification.
- `audit_logs` is connected for Requests write logging and RLS was manually verified, but `AuditTab.tsx` still uses mock/localStorage and is not yet connected to Supabase `audit_logs`.
- No Vercel deployment yet.
- No notifications, SLA, attachments, Realtime, Events/Schedule module, or full Supabase-backed Audit UI yet.

### Recommended Next Steps

1. Map current Tasks and Forum implementation.
2. Move Tasks from localStorage/mock to Supabase.
3. Keep Events / Schedule v1 stable and manually verify new-environment SQL when needed.
4. Link Tasks to Events using a future `event_id`.
5. Later connect Forum posts to Tasks/Events.
6. Only later consider AI-based extraction from forum posts.
7. Avoid for now:
   - Big `AppContext` refactor.
   - Auth rewrite.
   - Schema changes without planning.
   - Notifications.
   - Supabase Realtime.

### Prompt For A New ChatGPT Chat

Continue the project `pluga-command-system` / "המפקד". It is a Hebrew RTL company command-management system built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase Auth/PostgreSQL/RLS, and GitHub. Auth works with hybrid auth: first registration uses Email OTP + password setup, existing login uses email + password, OTP supports 8 digits, Dev Login is development-only, password visibility toggles exist, and Magic Link callback remains fallback. Role Based Interface works: approved active commanders see dashboard and Admin, Profile page works, Sidebar/Header show user/role/unit. Requests module works: request creation, workflow queues, search, filters, status actions, assignee display, assignee management, treatment comments, real request audit logging, and completed-request deletion. RLS for users/requests/comments/audit and completed-request delete was run manually and works; `supabase/migrations/002_rls_policies.sql` documents it. Do not change Auth, schema, seed, proxy, AppContext, or RLS without approval.

### Prompt For A New Codex Chat

Open `C:\Users\Maltak 123\Desktop\pluga-command-system` on branch `main`. Read `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`, `AGENTS.md`, and `CLAUDE.md` first. The last known feature commit before docs handoff is `084b810 Add audit trail and completed request deletion`. The project uses Next.js 16 `src/proxy.ts`, not middleware. Working assumptions: code is stable, Light Gloss Command System is primary, `.claude/` is ignored, AppContext still has demo/localStorage state, tasks/forum are still mock/localStorage, and service role keys must never enter frontend code. Requests, comments, audit trail, and completed-request deletion have passed live Supabase/RLS QA.

## Current Snapshot

Last known local commit:

```txt
084b810 Add audit trail and completed request deletion
```

Current focus:

- Requests Workflow v1 is stable and manually verified.
- Development of large product logic is paused until Tasks/Forum/Event planning is mapped.
- Current work is limited to documentation and careful planning unless explicitly requested.
- The active design direction is **Light Gloss Command System**.

Tech stack:

- Next.js 16.2.6 App Router
- React 19.2.4
- TypeScript
- Tailwind CSS 4
- Supabase Auth and SSR helpers
- Lucide React

Next.js 16 warning:

- Use `src/proxy.ts`.
- Do not create or rename to `middleware.ts`.
- Read relevant docs in `node_modules/next/dist/docs/` before changing Next-specific conventions.

## Supabase State

Files:

- Schema: `supabase/migrations/001_mvp_schema.sql`
- Seed: `supabase/migrations/seed_units_roles.sql`

Current known state:

- Schema file exists and is kept in Git.
- Seed file exists and is kept in Git.
- The schema and seed were already run manually in Supabase.
- RLS policies for `public.users` were added manually in Supabase after profile creation failed.
- Commander RLS policies for reading/managing user profiles were also run manually in Supabase and verified in the live project.
- `public.users` was empty before the manual RLS policy update.
- Basic `requests` table already exists in the schema and is used by the first requests/requirements module.
- RLS policies for `public.requests` were run manually in Supabase and work.
- Request creation from `/requests` was manually verified and writes to `public.requests`.
- Approved + active commanders can see requests.
- `supabase/migrations/002_rls_policies.sql` was added to version-control the `public.is_commander()` function and all RLS policies for `public.users`, `public.requests`, and `public.comments`. These were previously only applied manually. The file is idempotent (safe to re-run) and is intended for recovery or new-environment setup — it does NOT need to be re-run in the existing production database unless policies need recovery.
- Do not change schema, seed, RLS, triggers, or database structure during design-only work.

Requests schema currently used:

- Table: `public.requests`
- Columns used by the app: `title`, `description`, `status`, `request_type`, `requested_by`, `assigned_to`, `unit_id`, `metadata`, `created_at`, `updated_at`
- Existing status enum: `open`, `in_progress`, `approved`, `rejected`, `completed`, `cancelled`
- Category is stored in `request_type`.
- Priority and creator display fields are stored in `metadata`.
- Assigned handler is stored in `assigned_to` as `public.users.id`.
- Basic treatment comments use the existing generic `public.comments` table with `entity_type = 'request'`, `entity_id = public.requests.id`, `user_id = public.users.id`, `body`, `metadata`, and timestamps.

## Auth State

Important files:

- `src/app/(auth)/login/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/proxy.ts`

Current auth status:

- Supabase Auth is connected.
- `/login` uses a **hybrid authentication paradigm**:
  - **Existing user login**: Uses a standard **Email + Password** flow (`signInWithPassword`), completely bypassing OTP/Magic Links to conserve Supabase email quotas, then routes by `public.users` profile status.
  - **First registration**: Uses an **Email OTP code verification** flow (`signInWithOtp` with `shouldCreateUser: true`). Upon successful `verifyOtp`, the user sets up their **Password** (`updateUser({ password })`), and only then is their profile created in `public.users` before redirecting to `/onboarding`.
- Profile creation for first registration happens only after OTP verification and password setup.
- Callback route remains as a Magic Link fallback and should create/find `public.users` profiles if a Magic Link is used.
- Callback was adjusted to create a new `public.users` profile with the required NOT NULL fields.
- Protected route proxy exists.
- Email OTP still requires live verification for new registrations because Supabase reached the email rate limit again.
- Development-only Dev Login with email/password credentials remains in `/login` for local work and must not be exposed in production.
- Manual verification passed for an approved + active company commander profile: the commander can log in, sees the commander dashboard, sees the Admin Panel, and the sidebar/header show the real user and role.
- The basic role-based interface is working: dashboard content, navigation/admin visibility, profile page, and header/sidebar identity respond to the active approved profile.

Known issue:

```txt
Supabase Auth 429 over_email_send_rate_limit
```

Treat this as a Supabase rate limit, not an auth code bug.

Supabase Email Template requirement:

- In Supabase, open `Authentication -> Email Templates`.
- The template must include `{{ .Token }}` for OTP code emails.
- If it only contains `{{ .ConfirmationURL }}`, Supabase will send a link instead of a code.
- Do not try to fix this in application code.

Still requires manual verification:

- One Email OTP send during first registration after rate limit expires.
- `verifyOtp` and subsequent password setup (`updateUser({ password })`) succeed for first registration.
- `public.users` profile creation succeeds only after OTP verification and password setup.
- Existing user login with email + password succeeds.
- New users redirect to `/onboarding`.
- Pending users redirect to `/pending-approval`.
- Approved active users redirect to `/dashboard`.
- Magic Link callback fallback still reaches `/auth/callback` if used.

Recently verified manually:

- Commander RLS policies in Supabase allow an approved + active commander to access the Admin Panel.
- Approved + active מ״פ sees the role-appropriate dashboard.
- Admin Panel appears for מ״פ.
- Personal profile page exists and renders user/role data.
- Sidebar and mobile header show the connected user identity and role.

## Demo Layer Warning

`src/lib/context/AppContext.tsx` still contains the old demo/localStorage layer.

Do not delete or rewrite it without mapping dependencies. Some protected pages and feature tabs still rely on this layer.

Known localStorage/demo surface:

- App context provider in `src/app/providers.tsx`
- Feature tabs under `src/components`
- Role/frame simulation surfaces

## Design Direction

Current design language: **Light Gloss Command System**.

Do not return to dark theme as the primary interface.

The UI should feel:

- Light
- Glossy
- Clean
- Fast
- Professional
- Command-oriented
- Modern SaaS
- Mobile, iPad, and desktop friendly

The UI should not feel:

- Dark military dashboard
- Gaming UI
- Government form
- Presentation page
- Scattered demo

Core tokens:

```txt
primary dark text: #020108
primary action orange: #FF6B02
main background: #F6F7F9
secondary background: #EEF1F5
card glass: rgba(255,255,255,0.72)
strong card: rgba(255,255,255,0.88)
muted text: #667085
subtle text: #98A2B3
border soft: rgba(2,1,8,0.10)
orange soft: rgba(255,107,2,0.12)
orange border: rgba(255,107,2,0.28)
```

Main background:

```css
radial-gradient(circle at top right, rgba(255,107,2,0.14), transparent 28%),
radial-gradient(circle at bottom left, rgba(2,1,8,0.06), transparent 32%),
#F6F7F9
```

Glass card:

```css
background: rgba(255,255,255,0.72);
backdrop-filter: blur(18px);
border: 1px solid rgba(2,1,8,0.10);
box-shadow: 0 18px 50px rgba(2,1,8,0.08);
border-radius: 24px;
```

Strong card:

```css
background: rgba(255,255,255,0.88);
backdrop-filter: blur(20px);
border: 1px solid rgba(255,107,2,0.16);
box-shadow: 0 22px 60px rgba(2,1,8,0.10);
```

## Screens Updated In The Design Pass

Design-aligned screens:

- `/login`
- `/onboarding`
- `/select-role`
- `/pending-approval`
- `/dashboard` placeholder

Layout/components aligned:

- `src/app/globals.css`
- `src/app/(protected)/layout.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/MobileHeader.tsx`
- `src/components/layout/PageHeader.tsx`
- `src/components/ui/GlassCard.tsx`
- `src/components/ui/GlossyButton.tsx`
- `src/components/ui/StatusBadge.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/data/navigation.ts`

## Files To Avoid Unless Necessary

Do not touch without a concrete reason:

- `src/app/auth/callback/route.ts`
- `src/proxy.ts`
- `src/lib/supabase/*`
- `supabase/migrations/001_mvp_schema.sql`
- `supabase/migrations/seed_units_roles.sql`
- `src/lib/context/AppContext.tsx`
- `src/app/providers.tsx`

## Routes

Auth/public:

- `/login`
- `/onboarding`
- `/select-role`
- `/pending-approval`
- `/auth/callback`

Protected:

- `/dashboard`
- `/tasks`
- `/requests`
- `/schedule`
- `/forum`
- `/admin`
- `/help`
- `/profile`

## Validation Checklist

Run:

```bash
npm run lint
npx tsc -p tsconfig.json --noEmit
npm run build
```

Manual visual QA:

- `/login`
- `/onboarding`
- `/select-role`
- `/pending-approval`
- `/dashboard`
- mobile width `390x844`

Check:

- No white screen
- No horizontal overflow
- RTL is correct
- Inputs/selects are usable on mobile
- Buttons are touch-friendly
- No content hidden by stuck `opacity: 0`
- No dark theme relapse

## Requests Workflow v1 — Completed

`/requests` was upgraded from a basic form to a full command request workflow:

- **4-stat header**: פתוחות / דחופות / בטיפול / הושלמו — computed live from Supabase results.
- **7 queue tabs**: הכל / שלי / פתוחות / דחופות / בטיפול / הושלמו / נדחו|בוטלו — each shows a live count badge.
- **Filter bar**: free-text search (title + description), category dropdown, priority dropdown. Each filter is independent of tab selection.
- **Assigned-to display**: fetches assignee names in a safe secondary query; shows "טרם הוקצה" when null or RLS blocks.
- **Assignee management**: approved commanders / permission >= 90 can choose an active approved `public.users` profile as handler, or remove the assignment. This updates only `public.requests.assigned_to` and does not change status.
- **Treatment history**: each request card can open a compact comments panel backed by `public.comments`. Users who can view a request can add a treatment update. Comments store author display metadata and do not change request status. Select/insert was manually verified against Supabase.
- **Initial request audit trail**: request create, status change, assignee change, comment add, and completed-request delete actions write best-effort rows to `public.audit_logs` through `src/lib/audit.ts`.
- **Commander action buttons** (permission >= 90): contextual buttons per status (קבל לטיפול / אשר / סמן הושלם / דחה / בטל). Non-commanders see a dropdown.
- **Per-tab/filter empty states** with context-appropriate messages.
- Schema unchanged. `public.comments`, `public.audit_logs`, and completed-request delete RLS policies are documented in `002_rls_policies.sql` and were manually verified.
- Dashboard updated: third card "בקשות בטיפול" added; grid changed from 2→3 columns.
- lint: 0 / tsc: 0 / build: success (16 routes).

## Next Safe Steps

1. Map current Tasks and Forum implementation.
2. Move Tasks from localStorage/mock to Supabase.
3. Keep Events / Schedule v1 stable and manually verify new-environment SQL when needed.
4. Link Tasks to Events using a future `event_id`.
5. Later connect Forum posts to Tasks/Events.
6. Only later consider AI-based extraction from forum posts.

## Guardrails For Future Agents

- Keep Hebrew RTL.
- Keep **Light Gloss Command System**.
- Do not use dark mode as the main design.
- Do not add new backend features during this design phase.
- Do not change Supabase schema.
- Do not change auth callback unless real auth testing proves a bug.
- Do not change `src/proxy.ts` unless route protection itself is being intentionally fixed.
- Do not delete `AppContext` / localStorage demo layer without dependency mapping.
- Do not run `npm audit fix --force`.
- Do not create duplicate README, handoff, summary, or context files.
