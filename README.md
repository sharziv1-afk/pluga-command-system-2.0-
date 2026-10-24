# pluga-command-system — "המפקד"

"המפקד" (Hamefaked) is a Hebrew RTL command system for a single IDF infantry
company (פלוגה): tasks, requests, schedule/events, daily hierarchical forum
reports, soldier tracking, mentoring, and admin/approval — built on Next.js 16
(App Router) and Supabase (Auth/Postgres/RLS).

Live: <https://pluga-command-system-2-0.vercel.app> (every merge to `main` deploys to Vercel Production).

**Start here:**
- [`WORKSPACE_MODE.md`](WORKSPACE_MODE.md) — current live state; the only status ledger.
- [`AGENTS.md`](AGENTS.md) — durable rules and invariants, plus the documentation map and working rules.
- [`ENVIRONMENTS.md`](ENVIRONMENTS.md) — which Supabase project is LIVE and which is the sandbox (the names are backwards).
- [`docs/PRODUCT_OVERVIEW.md`](docs/PRODUCT_OVERVIEW.md) — Hebrew product tour: roles, the ten screens, sign-in, offline.
- [`docs/USER_PROVISIONING.md`](docs/USER_PROVISIONING.md) — auth email delivery and adding users.
- [`docs/QA_CHECKLIST.md`](docs/QA_CHECKLIST.md) — per-release read-only QA by role.
- [`docs/checkpoints/`](docs/checkpoints/) — dated records of production work; [`FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md`](docs/checkpoints/FORUM_DAILY_STRUCTURED_FLOW_CHECKPOINT.md) is required reading before touching `forum/page.tsx`.
- [`docs/archive/`](docs/archive/) — retired handoffs, prompts and the old `.ai-workspace` toolkit. History only.

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

All ten modules are active (PR #14), in the order defined by `navigationItems` in
`src/data/navigation.ts`: `/forum` first, then `/dashboard`, `/tasks`, `/requests`
(with the gaps tab), `/schedule` and `/tracking`. Mentoring is מ״פ-only; admin is
מ״פ/סמ״פ-only.

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
change/reset UI). Codes are delivered through Gmail SMTP configured in Supabase —
see `AGENTS.md` and [`docs/USER_PROVISIONING.md`](docs/USER_PROVISIONING.md).

## Guardrails

- SQL is manual only — no automatic migration runs.
- Prefer additive migrations; do not rewrite old ones.
- Do not put service role keys in frontend code.
- Preserve Hebrew RTL.
- Commit/push only with explicit approval.

Full rules and invariants (write-conflict resolution, offline sync, role
normalization, RLS patterns, etc.) live in `AGENTS.md` — this list is not a
substitute for it.
