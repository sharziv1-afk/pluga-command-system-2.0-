# pluga-command-system

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
- Commander RLS policies for reading/managing user profiles were run manually in Supabase and verified with an approved + active commander.
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

## Requests / Requirements

`/requests` is a basic Supabase-backed requests/requirements module.

Current behavior:

- Connected users can open a request.
- Requests are saved to `public.requests`.
- The app uses existing schema fields only: `title`, `description`, `status`, `request_type`, `requested_by`, `unit_id`, `metadata`, `created_at`, and `updated_at`.
- `request_type` stores the request category.
- `metadata` stores priority and creator display fields.
- Existing `request_status` values are used: `open`, `in_progress`, `approved`, `rejected`, `completed`, `cancelled`.

Manual RLS verification is still required for request creation, own-request reads, commander all-request reads/updates, and any professional-role category visibility.

## Design System

Current design direction: **Light Gloss Command System**.

The UI should feel:

- Light, glossy, clean, professional
- Fast and operational
- Modern SaaS, not a dark military dashboard
- Mobile, tablet, and desktop friendly
- Hebrew RTL first

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

1. Manually verify `/requests` against Supabase RLS.
2. Confirm request creation, listing, and commander status updates.
3. Keep the module scoped: it is a basic connected module, not a complete workflow yet.
4. Preserve the verified role-based interface, commander Admin Panel visibility, and Supabase RLS assumptions.
5. Re-run `npm run lint`, `npx tsc -p tsconfig.json --noEmit`, and `npm run build` after changes.

## Guardrails

- Do not return to a dark theme as the primary design.
- Do not change Supabase schema or seed during UI work.
- Do not change `src/app/auth/callback/route.ts` unless auth testing proves a real bug.
- Do not rename `src/proxy.ts` to `middleware.ts`.
- Do not delete `src/lib/context/AppContext.tsx` or localStorage demo state without mapping dependencies.
- Do not create duplicate README, handoff, or summary files.
