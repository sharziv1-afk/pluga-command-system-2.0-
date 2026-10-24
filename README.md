# pluga-command-system — "המפקד"

"המפקד" (Hamefaked) is a Hebrew RTL command system for a single IDF infantry
company (פלוגה): tasks, requests, schedule/events, daily hierarchical forum
reports, soldier tracking, mentoring, and admin/approval — built on Next.js 16
(App Router) and Supabase (Auth/Postgres/RLS).

**Start here, not below:**
- [`WORKSPACE_MODE.md`](WORKSPACE_MODE.md) — current live mode, release state, QA limits, and exact steps to re-enable modules.
- [`M/M permissions and rollup audit`](docs/checkpoints/2026-10-21-mm-permissions-rollup-audit.md) — live policy findings, rollup comparison, and the owner/closed-report hardening release status.
- [`2026-10-21 squad view release`](docs/checkpoints/2026-10-21-hide-squad-reports-release.md) — shipped UI change, production verification, preserved data, and rollback guidance.
- [`2026-10-21 forum QA`](docs/checkpoints/2026-10-21-forum-live-demo-qa.md) — user-authorized live demo, saved company rollup, refresh behavior, and verification limits.
- [`AI_HANDOFF_CHECKPOINT.md`](AI_HANDOFF_CHECKPOINT.md) — technical handoff and historical implementation detail; older sections are explicitly labeled.
- [`AGENTS.md`](AGENTS.md) — durable rules and invariants that must not be broken.
- [`FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`](FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md) — the forum's regression baseline and six invariants; read before touching `forum/page.tsx`.
- [`docs/archive/`](docs/archive/) — retired checkpoint history (old `README.md` journal, `PROJECT_SUMMARY.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`). History only, not current state.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) ·
Tailwind CSS 4 · Supabase (Auth, Postgres, RLS). Six runtime dependencies
total — see `package.json`.

**Critical:** this project uses `src/proxy.ts` (Next 16's renamed
middleware), not `middleware.ts`.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000/login`.

```bash
npm run check   # test + lint + typecheck + build, in that order — must pass clean before commit
```

Do not run `npm audit fix --force`.

## Environment variables

Create `.env.local` from `.env.example`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Never commit `.env.local` or real keys. Read `ENVIRONMENTS.md` before any database work; its refs and snapshots must be re-verified before use.

## Moving to another machine

The repository can be cloned with:

```bash
git clone https://github.com/sharziv1-afk/pluga-command-system-2.0-.git
cd pluga-command-system-2.0- && npm install && cp .env.example .env.local
```

Then use credentials intended for the selected environment. Do not copy Production values into Preview or local QA by default; use a dedicated staging project for write tests. Never print or commit `.env.local`.

What deliberately does **not** travel, and why that is correct:

| Not in git | Why it doesn't matter |
|---|---|
| `node_modules/` | `npm install` rebuilds it from `package-lock.json` |
| `.next/` | build output |
| `.env.local` | secrets stay out of git; `.env.example` lists the keys |
| `smtp password.png` | **must never be committed** — verified absent from every commit on every branch with `git log --all -S` |

Before switching machines, check nothing is stranded locally:

```bash
git status --short && git log --branches --not --remotes --oneline
```

The second command lists commits that exist **only on this machine**. A
`wip/*` branch with no upstream is invisible to a fresh clone — push it, or
accept losing it.

## Routes

The restoration working tree enables the existing routes, with `/forum` first,
then `/dashboard`, `/tasks`, `/requests`, `/schedule`, and `/tracking`.
Mentoring remains commander-only; admin navigation remains commander/deputy-only.
The gaps tab is restored within requests. This is not a deployment claim:
see [`WORKSPACE_MODE.md`](WORKSPACE_MODE.md) and the
[restoration checkpoint](docs/checkpoints/2026-10-23-platform-restoration.md)
for the verified environment and remaining QA limits.

The leading forum currently shows one M/M summary slot per platoon, without
squad report slots in company/platoon views. Historical squad data and existing
squad users' own forms remain intact. The presentation switch and restoration
steps are documented in [`WORKSPACE_MODE.md`](WORKSPACE_MODE.md).

Protected via `src/proxy.ts`:

```text
/dashboard  /tasks  /requests  /schedule  /forum
/tracking   /mentoring  /admin  /profile  /help
```

Auth/public:

```text
/login  /pending-approval
```

Auth is invite-only email OTP, plus password sign-in for Auth users already
linked to an active profile (PR #15, 2026-10-24; no sign-up or password
change/reset UI) — see `AGENTS.md` and the "Auth model" section of
`AI_HANDOFF_CHECKPOINT.md`.

## Guardrails

- SQL is manual only — no automatic migration runs.
- Prefer additive migrations; do not rewrite old ones.
- Do not put service role keys in frontend code.
- Preserve Hebrew RTL.
- Commit/push only with explicit approval.

Full rules and invariants (write-conflict resolution, offline sync, role
normalization, RLS patterns, etc.) live in `AGENTS.md` — this list is not a
substitute for it.
