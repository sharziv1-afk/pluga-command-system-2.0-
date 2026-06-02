# Project Summary - pluga-command-system

## Restart Snapshot - 2026-06-02

Latest pushed feature commit before this docs-only handoff:

```txt
084b810 Add audit trail and completed request deletion
```

The project is a Hebrew RTL company command-management system named **"המפקד"**. It is built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase Auth/PostgreSQL/RLS, and GitHub. Future deployment target: Vercel. The project uses `src/proxy.ts`; do not create `middleware.ts`.

Current product state:

- Auth works.
- First registration uses Email OTP + password setup.
- Existing login uses email + password.
- OTP supports 8 digits.
- Supabase Email Template must use `{{ .Token }}`.
- Dev Login is development-only.
- Magic Link callback remains as fallback.
- Role Based Interface works.
- Approved + active commanders see role-specific dashboard and Admin.
- Profile page works.
- Sidebar/Header display name, role, and unit.
- Requests module works with Supabase.
- Request creation has been manually verified.
- `public.users` and `public.requests` RLS were run manually in Supabase and work.
- Request assignee management has been implemented and pushed; latest `assigned_to` update was verified live against Supabase.
- Request treatment comments have been implemented and pushed.
- `public.comments` RLS policies were added manually in Supabase and documented in `supabase/migrations/002_rls_policies.sql`.
- `public.comments` select/insert was manually verified against Supabase.
- Request Treatment History works in the site, and no React code change was required.
- Real Audit Trail for Requests works with `src/lib/audit.ts`.
- Request actions write best-effort audit rows for `request_created`, `request_status_changed`, `request_assigned`, `request_comment_added`, and `request_deleted`.
- `public.audit_logs` RLS section E was manually run in Supabase and verified.
- Completed-request deletion works in the completed tab for commander-level users only.
- `requests: commander delete completed` was manually run in Supabase and verified.
- `unit_id` behavior is accepted: requests are associated to the creator profile unit; existing profiles missing `unit_id` use a fallback resolver, and future users per unit/department should work correctly.

Immediate next steps:

1. Map current Tasks and Forum implementation.
2. Move Tasks from localStorage/mock to Supabase.
3. Add Events / Schedule / לו"ז / מופעים.
4. Link Tasks to Events using a future `event_id`.
5. Later connect Forum posts to Tasks/Events.
6. Only later consider AI-based extraction from forum posts.

## Current State

`pluga-command-system` is the repository for **"המפקד"**, a Hebrew RTL company command-management system.

The project currently uses:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth
- Supabase schema and seed files
- Next.js 16 `src/proxy.ts` for protected routes
- Existing `AppContext` / localStorage demo layer

The schema and seed were already run manually in Supabase. The seed file is kept in Git at `supabase/migrations/seed_units_roles.sql`.

RLS policies for `public.users` were added manually in Supabase after profile creation failed. `public.users` was empty before those policies were added. Commander RLS policies for reading/managing user profiles were also run manually in Supabase and verified.

`supabase/migrations/002_rls_policies.sql` now documents the `public.is_commander()` helper function and RLS policies for `public.users`, `public.requests`, `public.comments`, and `public.audit_logs` in version control. It also documents the completed-request delete policy. These policies were manually run in Supabase and verified in the live project.

## What Has Been Done

- Supabase client/server helpers are connected.
- `/login` uses a **hybrid authentication paradigm**: existing-user login via **Email + Password** (`signInWithPassword`) to conserve email quota, and first-registration via **Email OTP code verification** (`signInWithOtp`) with password setup (`updateUser({ password })`).
- First registration creates/updates `public.users` only after both OTP verification and password setup succeed.
- Development-only password login remains available locally and is hidden in production.
- Auth callback route exists.
- Auth callback profile creation was adjusted to include all required NOT NULL fields for `public.users`.
- Protected route proxy exists.
- Schema file exists.
- Units/roles seed file exists.
- The app has a protected layout with sidebar/mobile header.
- Role-based interface is working at a basic level: approved active commanders see commander dashboard content, Admin Panel navigation, and real user/role identity in the sidebar/header.
- Personal profile page exists and displays the connected user and role.
- A basic Supabase-backed requests/requirements module now exists at `/requests`.
- The requests module was manually verified: request creation works and writes to `public.requests`.
- RLS policies for `public.requests` were run manually in Supabase and work.
- **Requests Workflow v1** is implemented: queue tabs, text/category/priority filters, 4-stat header, assigned-to display, commander assignee management through `assigned_to`, treatment comments through the existing `public.comments` table, real request audit logging, completed-request deletion, commander action buttons (קבל לטיפול / אשר / סמן הושלם / דחה / בטל), per-tab empty states. Schema unchanged; comments, audit, and completed-delete RLS are now documented and manually verified.
- Dashboard updated with a third "בקשות בטיפול" card linking to `/requests`.
- Core UI components exist: `GlassCard`, `GlossyButton`, `StatusBadge`, `EmptyState`.
- The current UI pass introduced the **Light Gloss Command System**.

## Latest Manual Verification

Manual testing passed after the commander RLS policies were applied in Supabase:

- An approved + active מ״פ can log in.
- The מ״פ sees the role-appropriate commander dashboard.
- The Admin Panel appears for the מ״פ.
- The personal profile page exists.
- Sidebar and mobile header show the connected user and role.
- `/requests` works.
- A new request can be created and is saved in `public.requests`.
- Approved + active commanders can see requests after the manual `public.requests` RLS policy update.
- Approved + active commanders can assign or remove a request handler; `assigned_to` stores `public.users.id`.
- `public.comments` select/insert works for Request Treatment History.
- `public.audit_logs` records `request_created`, `request_status_changed`, `request_assigned`, `request_comment_added`, and `request_deleted`.
- Completed requests can be deleted only from the completed tab by commander-level users.
- The latest checks passed: lint, typecheck, and build. The latest build produced 16 routes.

## Latest Design Change

The design language was updated from dark/cyber styling to a bright professional command SaaS style:

- Light background: `#F6F7F9`
- Primary text: `#020108`
- Primary action: `#FF6B02`
- Soft glass cards with blur, light borders, and restrained shadows
- Orange active states
- RTL-friendly mobile-first forms

Screens aligned in this pass:

- `/login`
- `/onboarding`
- `/select-role`
- `/pending-approval`
- `/dashboard` placeholder
- Protected layout, sidebar, mobile header, and page header

## Auth Status

A hybrid authentication paradigm is implemented in `/login`: Existing user login uses Email + Password (preserving email quota), while first-registration uses Email OTP.
Supabase OTP verification and password update are wired, but live end-to-end testing has been bottlenecked due to:

```txt
429 over_email_send_rate_limit
```

After the manual RLS policy update, Email OTP still requires a live registration pass once the Supabase email rate limit expires.

Before live testing, manually update Supabase:

```txt
Authentication -> Email Templates
```

The template must include:

```txt
{{ .Token }}
```

If it only includes `{{ .ConfirmationURL }}`, Supabase will keep sending a link instead of a code.

After the rate limit expires, test the registration flow:

- Email OTP delivery for new registrations.
- Registration `verifyOtp` and subsequent password setup (`updateUser({ password })`).
- `public.users` profile creation after OTP verification and RLS policies.
- Existing user login with email + password (which works instantly without emails/OTP).
- redirect to `/onboarding`
- redirect to `/pending-approval`
- approved user access to `/dashboard`

## Important Constraints

- Do not change schema, seed, auth callback, or proxy during design-only work.
- Do not delete `AppContext` / localStorage yet.
- Do not rename `proxy.ts` to `middleware.ts`.
- Do not run `npm audit fix --force`.
- Keep Hebrew RTL.
- Keep the primary design light. Do not return to dark theme.

## Next Step

Run visual QA and build checks:

```bash
npm run lint
npx tsc -p tsconfig.json --noEmit
npm run build
```

Next recommended feature steps:

- First map current Tasks and Forum implementation.
- Move Tasks from localStorage/mock to Supabase.
- Add Events / Schedule / לו"ז / מופעים.
- Link Tasks to Events using a future `event_id`.
- Later connect Forum posts to Tasks/Events.
- Only later consider AI-based extraction from forum posts.

## Final Handoff Notes For Restart

Product roles currently documented for the role-based interface:

- מ"פ
- סמ"פ
- ע. מ"פ
- מ"מ
- מ"כ
- סמל
- רס"פ / לוגיסטיקה
- חובש פלוגתי
- קשר פלוגתי
- ב.קוד / נהג

Requests module details:

- Basic request creation writes to `public.requests`.
- `request_type` stores category.
- `metadata.priority` stores priority.
- `metadata.creator_name`, `metadata.creator_role`, and `metadata.creator_unit` store creator display fields.
- `requested_by = public.users.id`.
- `unit_id` is stored when available.
- Queue tabs: הכל, שלי, פתוחות, דחופות, בטיפול, הושלמו, נדחו/בוטלו.
- Status actions:
  - `open ->` קבל לטיפול / אשר / דחה / בטל
  - `in_progress ->` אשר / סמן הושלם / דחה / בטל
  - `approved ->` סמן הושלם / בטל
  - terminal statuses have no actions.
- Assign Request Owner lets approved commanders / high-permission users set or remove `public.requests.assigned_to`.
- Regular users can see the handler but cannot change it.
- `unit_id` stores which unit/department the request belongs to. `assigned_to` stores who handles it. No UI selector for requesting unit is needed yet.
- Request Comments / Treatment History uses existing `public.comments`:
  - `entity_type = 'request'`
  - `entity_id = request.id`
  - `user_id = public.users.id`
  - `body =` comment text
  - `metadata = { author_name, author_role }`
  - empty comments are blocked client-side.
- Request Audit Trail uses `src/lib/audit.ts` and `public.audit_logs`:
  - `request_created`
  - `request_status_changed`
  - `request_assigned`
  - `request_comment_added`
  - `request_deleted`
  - Audit is best-effort/fire-and-forget; failures only `console.warn` and do not block the primary request action.
- Completed-request deletion:
  - Delete button appears only in the completed tab.
  - Delete button appears only when `request.status === 'completed'`.
  - Delete is available only to `canSeeAll` / commander-level users.
  - Regular users do not see delete.
  - The delete query also guards `.eq('status', 'completed')`.
  - A confirmation prompt appears before delete.

RLS and Supabase:

- `supabase/migrations/002_rls_policies.sql` documents manually-run RLS for `public.users`, `public.requests`, `public.comments`, `public.audit_logs`, and `requests: commander delete completed`.
- `public.is_commander(auth_id uuid)` uses `SECURITY DEFINER` and `SET search_path = public`.
- It checks active + approved users whose role is מ"פ/סמ"פ or whose `permission_level >= 90`.
- `public.comments` exists and is used by the app; comments select/insert was manually verified live against Supabase.
- `public.audit_logs` insert own/select own/commander select all was manually verified.
- `public.requests` delete completed policy allows commanders to delete only completed requests.
- Do not run SQL automatically.
- Do not use a service role key in frontend code.

UI and Browser QA:

- Claude Code Browser QA covered login, dashboard, requests, admin, profile, and widths `1440`, `1280`, `1200`, `1024`, `768`, and `390`.
- Fixed after QA: mobile Admin link, commander action visibility, role quote normalization, filter/search issue, compact navigation, and QuickHelp modal positioning.
- Theme toggle supports day/night while preserving Light Gloss Command System.
- Final responsive layout: fixed sidebar at `1280px+`; compact top navigation inside the flow below `1280px`; one menu button; no overlay hiding content.

Technical debt / known risks:

- `AppContext` still contains demo/localStorage state.
- `tasks` and `forum` still rely on mock/localStorage behavior.
- `Profile.status` currently maps `role_approval_status`, not `users.status`.
- `users.role` is text, not a foreign key to `roles`.
- Request priority is stored in `metadata`, not a dedicated column.
- Latest `assigned_to` and comments features passed live Supabase/RLS QA.
- `audit_logs` is connected for Requests write logging and RLS was manually verified, but `AuditTab.tsx` still uses mock/localStorage and is not yet connected to Supabase `audit_logs`.
- No Vercel deployment yet.
- No notifications, SLA, attachments, Realtime, Events/Schedule module, or full Supabase-backed Audit UI yet.

Recent important commits:

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

Local development note:

- Latest checks passed: lint, typecheck, and build.
- Latest build produced 16 routes.
- If localhost acts stale after changes, stop the dev server, remove `.next`, hard reload or use Incognito, then restart `npm run dev`.
