# pluga-command-system

## Current Restart Handoff - 2026-06-01

Latest pushed feature commit before this docs-only handoff:

```txt
3582eeb Add request treatment history comments
```

`pluga-command-system` / **"המפקד"** is a Hebrew RTL company command-management system. It uses Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase Auth, Supabase PostgreSQL, Supabase RLS, and GitHub. Future deployment target: Vercel.

Important: this project uses **Next.js 16 `src/proxy.ts`**, not `middleware.ts`.

Current verified state after comments RLS QA:

1. Request assignee updates write to `public.requests.assigned_to`.
2. `public.comments` RLS policies are documented in `supabase/migrations/002_rls_policies.sql`.
3. Treatment comments select/insert were verified manually against Supabase.
4. Request Treatment History works in the site with no React code changes required.
5. Real Audit Trail for Requests has started through `src/lib/audit.ts`; audit RLS for `public.audit_logs` is documented but still needs manual Supabase execution and QA.

Role-based UI currently targets: מ"פ, סמ"פ, ע. מ"פ, מ"מ, מ"כ, סמל, רס"פ / לוגיסטיקה, חובש פלוגתי, קשר פלוגתי, ב.קוד / נהג.

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

`pluga-command-system` is the codebase for **"המפקד"**, a Hebrew RTL command-management web application for a company-level command team.

The current work focus is **UI/design language and project documentation**. Do not expand backend logic, Supabase schema, auth callback, or route protection unless a direct UI issue requires it.

## Product Goal

"המפקד" centralizes company command workflows:

- Company-level dashboard and status overview
- Tasks and command follow-up
- Logistics requests
- Forum/updates
- Onboarding and pending approval flows
- Admin approval surfaces

The current application still includes a demo/localStorage layer through `AppContext`. Keep it in place until the architecture is intentionally migrated.

## Tech Stack

- Next.js 16.2.6 App Router
- React 19.2.4
- TypeScript
- Tailwind CSS 4
- Supabase Auth and Supabase SSR helpers
- Lucide React icons
- ESLint

Important Next.js note: this project uses **Next.js 16 `src/proxy.ts`**, not `middleware.ts`.

## Local Development

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
http://localhost:3000/login
```

Useful checks:

```bash
npm run lint
npx tsc -p tsconfig.json --noEmit
npm run build
```

Do not run `npm audit fix --force`.

## Environment Variables

Create `.env.local` from `.env.example` and fill only local values:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Never commit `.env.local` or real Supabase keys.

## Supabase Schema and Seed

Schema:

```txt
supabase/migrations/001_mvp_schema.sql
```

Seed:

```txt
supabase/migrations/seed_units_roles.sql
```

Current project state:

- The schema file exists and is kept in Git.
- The seed file exists and is kept in Git.
- The schema and seed were already run manually in Supabase.
- Existing tables include `users`, `units`, `roles`, `onboarding_progress`, `audit_logs`, `tasks`, `requests`, `comments`, `approvals`, `forum_posts`, and `feature_flags`.
- `seed_units_roles.sql` includes company, platoons 1-4, logistics, medical, communications, vehicles, and the main command/professional roles.
- Commander RLS policies for reading/managing user profiles were run manually in Supabase and verified with an approved + active commander.
- `public.requests` RLS policies were run manually in Supabase and verified.
- `supabase/migrations/002_rls_policies.sql` documents the manually-applied `public.is_commander()` helper and users/requests/comments policies for recovery or new-environment setup.
- `supabase/migrations/002_rls_policies.sql` also includes proposed `public.audit_logs` RLS policies; these still need manual execution in Supabase and live insert/select verification.
- `public.comments` RLS was added manually in Supabase and documented in Git.
- `public.comments` select/insert for request treatment history was manually verified against Supabase.
- Do not change schema, RLS, triggers, seed, or database structure during design-only work.

## Auth Status

Supabase Auth is wired through:

- `src/app/(auth)/login/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/proxy.ts`

The active `/login` screen implements a **hybrid authentication paradigm**:

- **Existing user login**: Uses a standard **Email + Password** flow (`signInWithPassword`), completely bypassing OTP/Magic Links to preserve Supabase email quotas, then routes by `public.users` profile status.
- **First registration**: Uses an **Email OTP code verification** flow (`signInWithOtp` with `shouldCreateUser: true`). Upon successful `verifyOtp`, the user sets up their **Password** (`updateUser({ password })`), and only then is their profile created in `public.users` before redirecting to `/onboarding`.
- OTP input supports 8 digits.
- Password visibility toggles exist for existing login, registration password, and registration password confirmation.

`/auth/callback` remains in place as a Magic Link fallback and has not been removed.

Development-only login (Dev Login) with pre-configured email/password credentials is still present under the main form when `NODE_ENV !== "production"` to allow swift local testing.

Known current issue:

```txt
Supabase Auth 429 over_email_send_rate_limit
```

This is a Supabase email rate limit, not a UI bug. Do not trigger email sends during automated development checks.

### Supabase Email Template Requirement

For the OTP code flow, update Supabase manually:

```txt
Authentication -> Email Templates
```

The email template must include:

```txt
{{ .Token }}
```

If the template only includes:

```txt
{{ .ConfirmationURL }}
```

Supabase will still send a link instead of a code. This is configured in Supabase, not in application code.

Manual verification still needed:

- Email OTP delivery with `{{ .Token }}`
- Existing user code verification and profile redirect
- First registration code verification
- `public.users` profile is created only after OTP verification
- New user redirects to `/onboarding`
- Pending user redirects to `/pending-approval`
- Approved active user reaches `/dashboard`

Latest manual verification:

- Approved + active מ״פ can log in.
- The מ״פ sees the role-appropriate commander dashboard.
- Admin Panel navigation appears for the מ״פ.
- The personal profile page exists.
- Sidebar and mobile header show the connected user and role.
- Basic role-based interface behavior is working.
- Claude Code Browser QA covered login, dashboard, requests, admin, profile, and responsive widths `1440`, `1280`, `1200`, `1024`, `768`, and `390`.
- Fixed after Browser QA: mobile Admin link, role/permission normalization for commander actions, search/filter issue, compact navigation, and QuickHelp positioning.

## Requests / Requirements

`/requests` is a basic Supabase-backed requests/requirements module.

Current behavior:

- Connected users can open a request.
- Requests are saved to `public.requests`.
- The app uses existing schema fields only: `title`, `description`, `status`, `request_type`, `requested_by`, `assigned_to`, `unit_id`, `metadata`, `created_at`, and `updated_at`.
- `request_type` stores the request category.
- `metadata` stores priority and creator display fields.
- `assigned_to` stores the assigned handler as `public.users.id`.
- Existing `request_status` values are used: `open`, `in_progress`, `approved`, `rejected`, `completed`, `cancelled`.

Manual verification passed:

- Request creation works from `/requests`.
- Requests are saved to `public.requests`.
- RLS policies for `public.requests` were run manually in Supabase and work.
- Approved + active commanders can see requests.
- Approved + active commanders can assign or remove a request handler through `assigned_to`.

The module includes Requests Workflow v1 with filters, queues, statistics, status actions, basic assignee management, basic request treatment comments, and initial real request audit logging. It does not yet include notifications, SLA, or attachments.

Initial real request audit logging uses `src/lib/audit.ts` and writes best-effort rows to `public.audit_logs` after successful:

- `request_created`
- `request_status_changed`
- `request_assigned`
- `request_comment_added`

Audit insert failures only warn in the console and do not block the main request action. Audit RLS still needs manual Supabase execution and QA.

Workflow details:

- Queue tabs: הכל, שלי, פתוחות, דחופות, בטיפול, הושלמו, נדחו/בוטלו.
- Status actions:
  - `open ->` קבל לטיפול / אשר / דחה / בטל
  - `in_progress ->` אשר / סמן הושלם / דחה / בטל
  - `approved ->` סמן הושלם / בטל
  - terminal statuses have no action buttons.
- Browser QA fixes included role normalization for smart quotes, fallback commander permission inference by role, and `type="text"` for the search input.
- Assign Request Owner: approved commanders / high-permission users can set or remove `assigned_to`; regular users can view the handler but cannot change it.

Request treatment history is now wired through the existing generic `public.comments` table:

- Request comments use `entity_type = 'request'` and `entity_id = public.requests.id`.
- `user_id` stores the author as `public.users.id`.
- `body` stores the treatment update text.
- `metadata` stores author display fields such as name and role.
- No schema change was made for this feature.

The comments feature has passed live Supabase/RLS verification. Future enhancements remain: audit trail, attachments, SLA, notifications, and richer treatment history workflows.

## Design System

Current design direction: **Light Gloss Command System**.

The UI should feel:

- Light, glossy, clean, professional
- Fast and operational
- Modern SaaS, not a dark military dashboard
- Mobile, tablet, and desktop friendly
- Hebrew RTL first
- Includes a subtle day/night theme toggle while keeping the light gloss design as the primary direction.
- Responsive layout: fixed sidebar at `1280px+`; compact top navigation inside the flow below `1280px`; no sidebar overlay hiding content; one menu button only.
- QuickHelp is a centered modal/card and should not clip on compact layouts.

Core tokens:

- Primary text: `#020108`
- Primary action orange: `#FF6B02`
- Main background: `#F6F7F9`
- Secondary background: `#EEF1F5`
- Muted text: `#667085`
- Subtle text: `#98A2B3`
- Soft border: `rgba(2,1,8,0.10)`
- Glass card: `rgba(255,255,255,0.72)` with blur and soft shadow
- Strong glass card: `rgba(255,255,255,0.88)` with orange-tinted border

Primary background:

```css
radial-gradient(circle at top right, rgba(255,107,2,0.14), transparent 28%),
radial-gradient(circle at bottom left, rgba(2,1,8,0.06), transparent 32%),
#F6F7F9
```

Design files currently touched:

- `src/app/globals.css`
- `src/components/ui/GlassCard.tsx`
- `src/components/ui/GlossyButton.tsx`
- `src/components/ui/StatusBadge.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/MobileHeader.tsx`
- `src/components/layout/PageHeader.tsx`
- Auth screens under `src/app/(auth)`
- Dashboard placeholder under `src/app/(protected)/dashboard/page.tsx`

## Routes

Public/auth routes:

- `/login`
- `/onboarding`
- `/select-role`
- `/pending-approval`
- `/auth/callback`

Protected routes:

- `/dashboard`
- `/tasks`
- `/requests`
- `/forum`
- `/admin`
- `/profile`
- `/help`

Protected route checks are handled by `src/proxy.ts`.

## Next Safe Steps

1. Run the documented `public.audit_logs` RLS policies manually in Supabase, then verify audit insert/select for request actions.
2. Consider richer treatment history, improved assignee workflow, tasks-to-Supabase migration, and Vercel deployment.
3. Re-run `npm run lint`, `npx tsc -p tsconfig.json --noEmit`, and `npm run build` after changes.

## Technical Debt / Known Risks

- `AppContext` still contains demo/localStorage state.
- `tasks` and `forum` still rely on mock/localStorage behavior.
- `Profile.status` currently maps `role_approval_status`, not `users.status`; this is intentional until app-level types are remapped.
- `users.role` is text, not a foreign key to `roles`.
- Request priority is stored in `metadata`, not a dedicated column.
- `assigned_to` and treatment comments passed live Supabase/RLS QA after the latest UI work.
- `audit_logs` is connected for initial Requests write logging, but `public.audit_logs` RLS still needs manual Supabase execution and QA.
- No Vercel deployment yet.
- No notifications, SLA, attachments, Realtime, or full audit trail yet.

## Guardrails

- Do not return to a dark theme as the primary design.
- Do not change Supabase schema or seed during UI work.
- Do not change `src/app/auth/callback/route.ts` unless auth testing proves a real bug.
- Do not rename `src/proxy.ts` to `middleware.ts`.
- Do not delete `src/lib/context/AppContext.tsx` or localStorage demo state without mapping dependencies.
- Do not create duplicate README, handoff, or summary files.
