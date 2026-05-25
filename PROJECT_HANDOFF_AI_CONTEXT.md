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
- `public.users` was empty before the manual RLS policy update.
- Do not change schema, seed, RLS, triggers, or database structure during design-only work.

## Auth State

Important files:

- `src/app/(auth)/login/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/proxy.ts`

Current auth status:

- Supabase Auth is connected.
- Magic Link request flow exists.
- Callback route exists and should create/find `public.users` profiles.
- Callback was adjusted to create a new `public.users` profile with the required NOT NULL fields.
- Protected route proxy exists.
- Magic Link after the manual RLS policy update still requires live verification because Supabase reached the email rate limit again.

Known issue:

```txt
Supabase Auth 429 over_email_send_rate_limit
```

Treat this as a Supabase rate limit, not an auth code bug.

Still requires manual verification:

- Magic Link callback reaches `/auth/callback`
- `exchangeCodeForSession` succeeds
- `public.users` profile creation succeeds after the manual RLS policies
- New users redirect to `/onboarding`
- Pending users redirect to `/pending-approval`
- Approved active users redirect to `/dashboard`

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

1. Finish visual QA for the updated light gloss screens.
2. Verify lint, TypeScript, and build.
3. Wait for the Supabase email rate limit to expire.
4. Send exactly one Magic Link for a live verification pass.
5. Confirm that a row is created in `public.users`.
6. Confirm redirect to `/onboarding`.
7. If profile creation still fails, read the development terminal log for `Profile create failed` and inspect `message`, `code`, `details`, and `hint`.
8. Only then continue onboarding/admin approval/product logic.

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
