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

RLS policies for `public.users` were added manually in Supabase after profile creation failed. `public.users` was empty before those policies were added.

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
- Core UI components exist: `GlassCard`, `GlossyButton`, `StatusBadge`, `EmptyState`.
- The current UI pass introduced the **Light Gloss Command System**.

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

Then wait for the Supabase rate limit, verify registration OTP and profile creation, and confirm existing user login with email + password.
