# PROJECT_HANDOFF_AI_CONTEXT

This document is for future AI agents and developers continuing work on `pluga-command-system`.

Project name: `pluga-command-system`  
Product name: **"המפקד"**  
Purpose: Hebrew RTL command-management system for a company-level command team.

## Current Snapshot

Last known local commit:

```txt
a628081 Organize project documentation and finalize Supabase seed setup
```

Current focus:

- Development of new product logic is paused.
- Current work is limited to the real site design language and existing project documentation.
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
- Do not change schema, seed, RLS, triggers, or database structure during design-only work.

Requests schema currently used:

- Table: `public.requests`
- Columns used by the app: `title`, `description`, `status`, `request_type`, `requested_by`, `unit_id`, `metadata`, `created_at`, `updated_at`
- Existing status enum: `open`, `in_progress`, `approved`, `rejected`, `completed`, `cancelled`
- Category is stored in `request_type`.
- Priority and creator display fields are stored in `metadata`.

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

## Next Safe Steps

1. Manually verify `/requests` with an approved active commander and a regular/non-commander user.
2. Confirm that request creation writes a row to `public.requests`.
3. Confirm RLS allows users to see their own requests and commanders to see/update all requests.
4. If RLS blocks requests, add policies manually in Supabase; do not disable RLS or use service role keys.
5. Continue from the basic requests/requirements module toward real request workflows only after the simple flow is verified.

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
