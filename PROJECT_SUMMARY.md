# Project Summary - pluga-command-system

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
- Core UI components exist: `GlassCard`, `GlossyButton`, `StatusBadge`, `EmptyState`.
- The current UI pass introduced the **Light Gloss Command System**.

## Latest Manual Verification

Manual testing passed after the commander RLS policies were applied in Supabase:

- An approved + active מ״פ can log in.
- The מ״פ sees the role-appropriate commander dashboard.
- The Admin Panel appears for the מ״פ.
- The personal profile page exists.
- Sidebar and mobile header show the connected user and role.

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

Then manually verify the basic requests/requirements module:

- Open `/requests`.
- Create a request and confirm it is written to `public.requests`.
- Confirm the row includes `title`, `description`, `status`, `request_type`, `requested_by`, `unit_id`, and `metadata`.
- Confirm a commander can see/update requests and a regular user can at least see their own requests.

Important: `/requests` is now a basic connected module, but it is not yet a complete request workflow.
