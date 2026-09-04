# pluga-command-system — "המפקד"

"המפקד" (Hamefaked) is a Hebrew RTL command system for a single IDF infantry
company (פלוגה): tasks, requests, schedule/events, daily hierarchical forum
reports, soldier tracking, mentoring, and admin/approval — built on Next.js 16
(App Router) and Supabase (Auth/Postgres/RLS).

**Start here, not below:**
- [`AI_HANDOFF_CHECKPOINT.md`](AI_HANDOFF_CHECKPOINT.md) — current state, what's actually live, open items. The source of truth.
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

Never commit `.env.local` or real keys. See `AI_HANDOFF_CHECKPOINT.md` for
which Supabase project (`vmfihyritfmjycrfpxjn`, "Staging") is the one
actually in live use.

## Routes

Protected via `src/proxy.ts`:

```text
/dashboard  /tasks  /requests  /schedule  /forum
/tracking   /mentoring  /admin  /profile  /help
```

Auth/public:

```text
/login  /pending-approval
```

Auth is email-only OTP (invite-only, no passwords) — see the "Auth model"
section of `AI_HANDOFF_CHECKPOINT.md` for the full flow.

## Guardrails

- SQL is manual only — no automatic migration runs.
- Prefer additive migrations; do not rewrite old ones.
- Do not put service role keys in frontend code.
- Preserve Hebrew RTL.
- Commit/push only with explicit approval.

Full rules and invariants (write-conflict resolution, offline sync, role
normalization, RLS patterns, etc.) live in `AGENTS.md` — this list is not a
substitute for it.
