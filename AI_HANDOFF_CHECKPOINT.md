# AI Handoff Checkpoint — 2026-09-04

> **Update 2026-09-06:** Phases 1-6 and four audit cycles are complete; see the Current State block
> in `CLAUDE.md` for what changed and what is still open. The forum regression baseline referenced
> below (`2026-08-20`, 124/138) **no longer exists in Staging** — the live baseline is `2026-09-08`
> = 128/138 from 34/36 + 31/34 + 30/33 + 33/35, and `tests/companyReport.test.mjs` asserts the
> aggregation and the platoon-by-owner invariant without needing live data at all.

Read this before touching the codebase. It captures exactly what state the project is in, why decisions were made, and what's genuinely still open. Written for a fresh AI agent with zero prior context.

## What this project is

**"המפקד" (Hamefaked)** — a Next.js 16 (App Router, Turbopack) + Supabase command system for a single IDF infantry company (פלוגה). Hebrew RTL throughout. One commander (מ״פ) manages ~20 users across 4 platoons (מ״מ), each with 3 squads (כיתה), plus company staff (מפל״ג: סמ״פ, מש״ד, רס״פ, חופ״ל).

This repo (`C:\DEV\pluga-command-system`) is **the canonical, active product**. Three sibling folders exist on this machine — `PLUGA A APP`, `thepluton`, `pluga-reference-render` — they are sandboxes for stealing ideas/patterns from, not competing sources of truth. Do not let their docs (some of which explicitly say "avoid Supabase/auth/RLS") override what's actually running here.

**Supabase projects:**
- **Staging** `vmfihyritfmjycrfpxjn` — this is the one actually in live use right now. The commander logs in on his phone against this project daily. Treat it as production-grade in terms of care, even though it's named "Staging."
- **Production** `hjltpajvqhnygjybtivd` — exists but is NOT wired up to anything live. No `send-email` Edge Function, no Send Email Hook configured there. Do not assume parity with Staging.

## How to run it locally

```bash
cd "C:\DEV\pluga-command-system"
npm run dev          # next dev, binds 0.0.0.0:3000
```
`.env.local` (gitignored) points `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` at Staging. Production's values are commented out in the same file as a backup, clearly labeled "DO NOT USE."

**Phone testing over LAN**: `next.config.ts` has `allowedDevOrigins` hardcoded to specific IPs. The commander's home network IP changes across sessions (DHCP) — if he reports buttons doing nothing on his phone (a real incident that happened, see below), check `ipconfig` for the current IP and add it to that array, then restart the dev server (`next dev` doesn't hot-reload config changes).

**Verification**: `npm run check` = test + lint + typecheck + build, in that order. All four must pass clean. As of this checkpoint they do (23/23 tests, zero lint/type errors, build succeeds, `/mentoring` included as a new static route).

## Auth model (do not regress this)

Email-only OTP, invite-only, no passwords. Flow: commander creates a `public.users` row via `/admin` (status=pending, no `auth_user_id`) → invitee enters their email on `/login` → `signInWithOtp({shouldCreateUser:true})` → enters the 6-8 digit code → `verifyOtp` → if no linked profile found, `claim_own_profile` RPC links the verified auth identity to the pre-created row by matching email. `shouldCreateUser:false` is NOT used — the real invite gate is `claim_own_profile` raising `P0002` ("no invitation found") when the email has no matching unclaimed row.

**OTP email delivery** was broken for most of one session (Supabase's default SMTP is team-members-only; custom SMTP via Resend hung/failed on both 587 and 465). The fix that actually works: a Supabase **Send Email Hook** (Authentication → Hooks in the Dashboard) pointing at a deployed Edge Function (`supabase/functions/send-email/index.ts`, now checked into git) that verifies the Standard Webhooks signature and calls Resend's REST API directly — bypassing SMTP entirely. This is deployed and configured on **Staging only**. If Production ever needs real logins, this whole Edge Function + Hook setup needs to be replicated there manually (Dashboard config can't be scripted via the Supabase MCP tools — no MCP method exists for it).

## What actually exists (verified working tonight, not just "should work")

- **Core pages**: dashboard, tasks, requests (with a "פערים" tab for logistics/training/schedule gaps that can be one-click-converted to a formal request), forum (daily structured reports + a free-form posts feed), schedule (with WhatsApp-text export and now ICS calendar export), tracking (soldier readiness spreadsheet), admin (user approval + direct invite), profile, help (command dictionary).
- **Forum daily structured flow**: מ״כ → מ״מ → מ״פ report chain. Aggregation (`src/lib/forum/companyReport.ts`) is pure, deterministic, matches owners by `owner_user_id` (never array index — this was a real historical bug, see the six invariants in `FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`). The מ״פ's company-level rollup does NOT happen automatically — he must open his own report, click "ערוך דוח" then "בנה מהדיווחים", review, then "שמור". This is deliberate (human review before numbers become official), not a bug, but it surprised the commander once — worth remembering if it comes up again.
- **מנטoring ("תיק חניכה")** — new tonight. `/mentoring`, commander-only (stricter than the general admin/סמ״פ gate — see `is_company_commander()` vs `is_commander()` below). Tracks development conversations (observation → focus → agreed action → next check-in date) for the 4 מ״מ + סמ״פ, ported from a working model already built in the `PLUGA A APP` sibling (`src/domain/mentoring.ts` there). מ״כים are explicitly out of scope for now (commander's own call) but nothing in the schema blocks extending it later.
- **Privacy hints**: `<FieldPrivacyHint>` (advisory text, not enforced) sits under free-text fields prone to collecting sensitive personal data — forum welfare/medical/discipline fields, tracking soldier notes, mentoring observations, request comments.

## Role/permission model — read this before touching RLS or role strings

- `public.users.role` is free text matching `public.roles.name` (a picklist enforced only at the UI level). Real roles: `מ"פ`, `סמ"פ`, `מ"מ 1..4`, `מ"כ 1א..4ג` (3 squads/platoon, not 4 — a real correction made mid-session), staff: `מש"ד`, `רס"פ / לוגיסטיקה`, `סרס"פ`, `ב.קוד / נהג`, `חובש פלוגתי`, `קשר פלוגתי`.
- **Gershayim (״, U+05F4) vs straight double-quote (", U+0022) is a recurring, proven bug source.** Some rows/roles are stored with one, some with the other, inconsistently. `src/lib/permissions.ts:normalizeRole()` collapses both to `"` — **always run role strings through `normalizeRole()` before comparing**, never compare raw. This has caused at least three real bugs this project's history (a `DELETE ... WHERE name IN (...)` that silently deleted nothing, a squad-commander role-matching filter that silently dropped one platoon commander from a UI list tonight, and would have caused RLS confusion if not for `normalizeRole` existing at all).
- Three permission-check tiers exist, don't conflate them: `hasAdminAccess()` (מ״פ or סמ״פ — the general "commander UI" gate), `hasCompanyWideUiAccess()` (same plus מש״ד, plus a `permission_level >= 90` fallback), and the new `isCompanyCommander()` (מ״פ **only** — added tonight for mentoring, use it anywhere a feature must exclude even the deputy).
- Server-side mirror: `public.is_commander(auth_id)` (מ״פ or סמ״פ, permission_level>=90) vs the new `public.is_company_commander(auth_id)` (מ״פ only). Don't use `is_commander` where the UI uses `isCompanyCommander` or you'll open a hole.

## Security posture (as of tonight)

A dedicated security audit ran tonight and found one real, fixed issue: **RLS policies on tasks/requests/events/gaps/forum_posts/comments/audit_logs checked row ownership but not account status** — a commander blocking a user (`status='blocked'`) only took effect client-side; the blocked user's existing JWT could still read/write their own rows via direct Supabase REST calls. Fixed in `supabase/migrations/024_harden_ownership_policies.sql` by swapping the raw ownership subquery for `public.current_app_user_id()` (already existed, returns null for non-active/approved users) everywhere that pattern appeared. Verified: an active user can still create tasks normally after this change.

Everything else checked clean: no unwrapped `auth.uid()` (the perf anti-pattern), all SECURITY DEFINER functions have `search_path` set and correct grants, no secrets committed to source, no raw SQL injection surface, no CSRF exposure (no server API routes — every write goes straight from browser to Supabase with the anon key and a real JWT).

**Known, accepted, low-priority gap**: `publishAndCloseForum` (forum bulk-close) filters only by `report_date`, not by company — a genuine multi-company leak risk, but there is only ever one company in this system today (multi-company is explicitly YAGNI'd, see below), so it's dead-code risk, not a live one. Don't "fix" this without first deciding whether multi-company is actually being built — a half-fix here is worse than the current honest gap.

## Update — 2026-09-04 later that day: offline layer, and Phase 0 of the launch plan

Two rounds landed after the section above was written.

**Offline support was built** (`73957e2` → `1784ac0`): a PWA shell, a device PIN and WebAuthn biometric unlock, an IndexedDB read cache, an author-locked write queue, and field-level write-conflict resolution that falls back to role hierarchy only when two people changed the *same field* to different values. Wired into `/tasks` and `/forum` saves. `requests`/`schedule`/`tracking` still have no conflict protection at all and therefore must not be given offline writes until they do.

**Then a full audit of the whole repo ran** (three parallel agents over all 18,571 lines of source, 107 docs, 30 migrations and every UI string) and produced the launch-readiness plan the project is now executing. The plan lives outside the repo; its Phase 0 is done, Phase 1 is next.

**Phase 0** (`c05cf51` → `d5304db` → `b871069`) fixed three security bugs *in that same offline code*, all found by turning an adversarial review on it rather than trusting the commit message:

1. **The rank check was forgeable.** The caller's own `permission_level` was passed in from the browser. Replaced by `caller_outranks()` (migration `029`) which compares both ranks in the DB. But that was still not enough: the resolver identified the *other* editor from `updated_by`, a column the client wrote — so a user could stamp themselves as last editor and skip the check. Migration `030` puts a trigger on `tasks` and `forum_daily_reports` that overwrites `updated_by` with the caller's real id. **Never trust that column from the client, and never drop that trigger.**
2. **TOCTOU** — the post-conflict merge write had no `updated_at` guard, so a third save landing mid-resolution was silently clobbered. Now guarded and re-resolved.
3. **The offline queue crossed users on a shared phone** — writes carried no author, cache keys weren't scoped, and sign-out cleared nothing. Now author-locked, user-scoped, and cleared on both sign-out and a different user signing in.

The review also caught a bug *introduced* by fix 3: an attempt counter that counted failures which happened while offline, deleting real unsaved work after a few page navigations. That is why `flushWriteQueue` now returns early when offline and never counts an offline failure. **The lesson is worth keeping: the scope creep ("add a safety limit nobody asked for") caused the worst bug of the round.**

Full invariants are in `AGENTS.md` → "Write Conflicts & Offline". Two known holes remain open there: `submitSelectedReport` and the task status change both still bypass the resolver, and an RLS-denied write is still indistinguishable from a conflict (PostgREST returns 204 with no error).

## Explicitly rejected features (don't re-propose these without a new reason)

- **Multi-company support.** A draft schema exists (`MULTI_COMPANY_SCHEMA_RLS_DRAFT.md`) but the project's own hard rule is "don't add a second company to the DB before RLS is hardened for it." No business need exists. Leave it a draft.
- **Gantt chart, AI-generated summaries** (ported from the `thepluton` sibling) — fake progress bars and a "summary" that's actually local filtering pretending to be AI. Rejected as valueless / doctrinally wrong (aggregation must stay deterministic — invariant #2 in the forum checkpoint doc).
- **A separate "מסגרות" (org structure) page** — `/admin` already edits the unit tree; a dedicated page would duplicate it.

## What's genuinely still open (not done, and why)

1. **Vercel deployment.** Never deployed anywhere. This was literally the original request months ago ("connect the Vercel site to Supabase") and is still not done. A Vercel MCP connector is available in this environment and deployment is technically possible right now — it was deliberately NOT done autonomously because it's a consequential, hard-to-reverse, externally-visible action (new public/semi-public URL, env var setup, deployment protection settings). **The commander has since made this an explicit standing gate: every Vercel step must be presented and approved individually — project creation, env vars, first deploy, deployment protection, domain, monitoring — and the same gate applies to all design work.** `next.config.ts` sets `distDir: ".next-build"` (not Next's default `.next`) — confirm Vercel's build detection handles that, or drop the override, before deploying. Note the connected Vercel account in this environment has no team access (`list_teams` returns empty), so it cannot inspect or deploy on the commander's behalf.
2. **`forum/page.tsx` is ~3170 lines** and still not split, despite being flagged repeatedly. A code-quality audit tonight identified specific low-risk extraction targets (a ~180-line block of pure, side-effect-free helper functions at module scope — owner-matching, status labels, date formatting — that could move to `src/lib/forum/reportHelpers.ts` verbatim with zero logic change). Not attempted tonight: real but not urgent, and this is the single highest-invariant-risk file in the app (see `FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md` §5) — don't refactor it without the commander available to test the forum regression baseline afterward (2026-08-20, aggregation 124/138, platoon breakdown 32/35·30/34·28/33·34/36, documented in that checkpoint file).
3. **Dead tables not removed**: `forum_daily_summaries` (migration 009, explicitly commented "legacy — do not build on it" but still has live RLS policies and is still queryable) and `forum_posts` (the free-form feed — actually still in active use tonight, do NOT remove this one without checking with the commander first, the "dead table" framing in the original plan may be stale). Not removed because dropping schema/data is destructive and unconfirmed.
4. **Dashboard metric count** — original plan wanted it cut to "3 metrics + one decision-needed callout." It currently has more than that (task/request/event breakdowns across several `MetricCard`s). Not changed — this is a UX/scope call about what the commander actually wants to see daily, not a technical fix, and should not be decided without him.
5. **"Lesson → action" doctrine feature** (`actionText`/`actionOwner`/`actionCheckAt`/`actionClosure` fields on `forum_daily_reports.content`, ported from the `PLUGA A APP` sibling's product rules) — a real missing feature from the original plan's Phase 3, not attempted tonight due to time. Contained scope (one schema addition + form fields), lower risk than the forum split.
6. **`companyReport.ts` has zero unit tests** despite being the app's own documented "most important regression surface." It's pure and trivially testable (no React/Supabase/Date.now() dependencies) — a good first task for whoever picks this up next.

## Gotchas that will bite you if you don't know them

- **Line endings**: editing files on this Windows machine via certain tool paths silently converts LF → CRLF, which breaks the test suite (two tests do literal source-text regex matching against `.tsx` files and assume LF). A `.gitattributes` (`* text=auto eol=lf`) was added tonight to have git normalize this going forward, but if you're editing directly (not through git), check `grep -c $'\r' <file>` after edits and normalize if needed. This bit two tests tonight and took real time to diagnose — don't skip this check.
- **Dev-mode HMR over a LAN-IP origin is unreliable** — the WebSocket HMR connection fails/serves stale bundles when the page was loaded via the LAN IP rather than `localhost`. This once caused a real "ReferenceError: X is not defined" for code that was correctly saved to disk — a hard reload (not just waiting) fixed it. This is a dev-only artifact; production builds have no HMR and won't exhibit it. Don't chase phantom bugs here without first trying a hard reload.
- **`report.content` / any `jsonb` column is untyped at the DB level.** A legacy row can hold a number where the app code expects a string (this happened for real — `present_count`/`total_count` stored as JSON numbers crashed the whole forum page on `.trim()`, with no error boundary catching it). `sanitizeReportContent()` in `forum/page.tsx` now guards this at the one place both the edit-draft and read-view paths funnel through — if you add a new `jsonb`-backed field anywhere, don't trust its type without going through an equivalent guard.
- **`users.unit_id` and `users.commanded_unit_id` both FK to `units.id`** — a PostgREST embed like `.select('...,units(name)')` is ambiguous between them and will error or guess wrong. If you ever try to collapse the profile-bootstrap query (`src/lib/supabase/profile.ts:fetchCurrentProfile`) from 2 round-trips to 1 via an embed (a real, identified, NOT-yet-attempted perf win), you need `units!unit_id(name)` to disambiguate, and you must test it against a real login before trusting it — this gates every single page's first paint, an error here breaks the whole app.

## Performance work done tonight

A dedicated performance audit ran and most of its high-impact findings were applied and verified live: `tasks`/`requests`/`schedule` page load functions were sequential-awaiting 3-6 independent Supabase queries each — now parallelized with `Promise.all` in two rounds (round 1 = queries independent of each other, round 2 = queries keyed off round-1 ids but independent of each other). Six unmemoized full-array-scan aggregations (dashboard event counts, tasks status counts, requests status counts, mentoring per-mentee entry lookup) now sit behind `useMemo`. Three missing indexes added (`tasks.created_at`, `requests.created_at`, `forum_posts(is_pinned, created_at)`). `admin`'s `select('*')` on `users` narrowed to actual used columns; same narrowing applied to the profile-bootstrap query (the join-collapse itself was identified but not attempted — see the ambiguous-FK gotcha above).

Not done: pagination/row caps on tasks/requests/schedule (fine at ~20 users and current data volume, will matter as history accumulates — dashboard already has `.limit(80)` as the reference pattern), skeleton loading states on admin/tracking/mentoring (currently spinners, not a real bug, just feels slightly slower than it is).

## If the commander reports something is broken

Check, in this order: (1) is the dev server actually running (`netstat -ano | grep :3000`)? (2) is `allowedDevOrigins` current for his phone's IP? (3) hard-reload before assuming a real bug — HMR staleness is a known false alarm generator. (4) check Supabase Staging logs via the MCP `query_logs` tool before guessing. He has been burned before by guessed diagnoses that turned out wrong (SMTP delivery saga) — verify against ground truth (DB queries, actual logs) before reporting a fix as done.
