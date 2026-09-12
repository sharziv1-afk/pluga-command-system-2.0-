# Environments — which project is which

**Read this before touching any database.** The Supabase project *names* do not
match what the projects actually are, and the mismatch is dangerous: the one
called "pluga-command-system" sounds like the real system and is not.

Verified against both projects on 2026-09-06.

---

## The two projects

| | **LIVE** | **SANDBOX** |
|---|---|---|
| Project ref | `vmfihyritfmjycrfpxjn` | `hjltpajvqhnygjybtivd` |
| Supabase name today | `hamifkad-staging` | `pluga-command-system` |
| **What it actually is** | **the real system, in daily use** | **safe to break — no company records** |
| Created | 2026-07-25 | 2026-05-20 |
| Tables | 20 | 20 (caught up 2026-09-06) |
| Functions | 12 | 12 |
| Policies | 72 | 72 |
| Rows of company data | ~100, all seeded 2026-09-03 | leftovers from May-July |
| Auth accounts | 5 | 4 (orphans from the abandoned run) |

**Counting caveat:** `pg_stat_user_tables.n_live_tup` reports 0 for the
sandbox because those tables were never analysed. It is an estimate, not a
count — a real `count(*)` finds 315 audit_logs, 44 forum_daily_reports, 14
users and assorted content left over from when this project was the active
one. Use `count(*)` when the answer matters.

The names are backwards for a boring historical reason: the project created
first (`pluga-command-system`) was abandoned early, and the second one
(`hamifkad-staging`) became the product. Nobody renamed them.

### Rename them

Supabase project names are display labels — renaming changes nothing about the
data, the URL, the keys or the connection. Do it in the dashboard
(Project Settings → General → Project name):

- `hamifkad-staging` → **`hamifkad-production`**
- `pluga-command-system` → **`hamifkad-sandbox`**

Until that is done, the table above is the authority, not the label.

---

## The rule

**LIVE holds the company's real data.** The מ״פ signs in against it every day.
Nothing is tried there first. No schema change, no bulk update, no experiment.

**SANDBOX is where things get tried.** Identical schema, and nothing in it is
a company record — what it holds is leftovers from when it was the active
project in May-July. Break it freely; it can be rebuilt from the migrations.

Flow for anything risky: try it in SANDBOX → confirm → apply to LIVE.

Before 2026-09-06 there was no safe place to try anything and every
experiment landed on real data. That is what this document ends.

---

## Sandbox catch-up — DONE (2026-09-06)

Migrations 023-032 were applied to the sandbox, plus one policy
(`requests: select own unit`) that predated them and had never reached it.
Both databases now report identical signatures:

```
tables 20 | functions 12 | policies 72 | tables_without_rls 0
schema_sig  ae3ba9a6252830e50c2fd124d5b433b0
func_sig    f89628f87f3aa90ec13bd9488458f924
policy_sig  ce4dd9b4d9463886eca704864d57c086
```

**Lesson worth keeping:** the first parity check compared tables, columns
and functions and passed — while a policy was still missing. Schema equality
is not access equality. Always compare `policy_sig` too; the query at the
bottom of this file does.

The gap that was closed, for the record:

- **Missing tables:** `mentoring_entries`, `tracking_weeks`
- **Missing columns:** `forum_daily_reports.updated_by`, `tasks.updated_by`,
  `tracking_items.week_id`
- **Missing functions:** `caller_outranks`, `force_updated_by`,
  `is_company_commander`
- Every other table matches exactly, compared by a hash of its column names
  and types — including `users`.

`supabase/sandbox/001_bring_sandbox_to_live_schema.sql` is that gap as one
idempotent script, kept for the record and for rebuilding a sandbox from
scratch. **It is for the SANDBOX only** — LIVE is already at this state.

The sandbox still holds its own old data (see the counting caveat above). It
is harmless and unrelated to the company's real records, but it is not a
clean slate. Clearing it is a separate decision.

---

## Parity re-audit — 2026-09-13: three signatures were not enough

Every previous round called the two projects "twins" on the strength of three
md5 signatures (schema, functions, policies). That was too few, and the
function signature as computed did not include function *bodies*. Re-ran the
comparison across **eleven** catalogs:

| Catalog | LIVE | SANDBOX | Match |
|---|---|---|---|
| tables (+ RLS flag) | 17 | 17 | ✅ |
| columns | 197 | 197 | ✅ |
| policies | 72 | 72 | ✅ |
| triggers | 19 | 19 | ✅ |
| event triggers | 7 | 7 | ✅ |
| indexes | 86 | 86 | ✅ |
| constraints | 78 | 78 | ✅ |
| grants | 476 | 476 | ✅ |
| extensions | 5 | 5 | ✅ |
| enums | 33 | 33 | ✅ |
| **functions** | 12 | 12 | ❌ **different bodies** |

Two functions diverged:

1. **`is_commander`** — LIVE 985 chars, SANDBOX 426. The sandbox was running a
   pre-`002` version using `exists(...)` over every matching row instead of
   `limit 1` into locals. On today's data they agree; given two rows sharing an
   `auth_user_id` they need not. Fixed by
   `migrations/034_sandbox_is_commander_parity.sql` — a no-op on LIVE, which
   already matches the repo, and the correction on the sandbox. **Run it on
   both**, so afterwards each is provably the repo's version rather than
   assumed to be.
2. **`set_updated_at`** — 196 vs 191 chars, identical logic, `\r\n` vs `\n`
   line endings. Cosmetic; left alone deliberately rather than churning a
   trigger function over whitespace.

### The gap none of the SQL signatures could ever have caught

**Edge Functions are not in the Postgres catalog**, so no schema comparison
sees them:

| | LIVE | SANDBOX |
|---|---|---|
| Edge Functions | `send-email` (v3, ACTIVE) | **none** |

The sandbox therefore **cannot send a login code at all** — Supabase Auth's
Send Email hook has nothing to call. Nobody can sign in to the sandbox, which
is worth knowing before anyone tries to rehearse anything there.

**Check these by hand when comparing environments; SQL will not tell you:**
Edge Functions, Auth hooks, Auth providers, project secrets, storage buckets,
and scheduled jobs.

### Deployed code drifted from the repo

`supabase/functions/send-email/index.ts` in git reads secrets as
`Deno.env.get("RESEND_API_KEY") ?? ""`. The **deployed** v3 does not — it
carries a live Resend API key and the `v1,whsec_...` hook secret as hardcoded
fallbacks. Neither value appears in any commit on any branch (verified with
`git log --all -S`), so nothing leaked to GitHub; the exposure is limited to
anyone with Supabase project access.

Do **not** simply redeploy the repo version to fix this. If the dashboard
secrets were never actually set, the `?? ""` version authenticates with an
empty key and **every login email stops working**. Order: confirm both secrets
exist under Project Settings → Edge Functions → Secrets, redeploy, then send
yourself a code to prove it still arrives.

---

## Which project the app talks to

`.env.local` (git-ignored) holds two variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key for that project>
```

That pair is the only thing that decides which database the app uses. The
deployed site will point at **LIVE**. To work against the sandbox locally,
point them at SANDBOX — and remember to point them back.

There is no service-role key anywhere in this codebase, and there must never
be one: it bypasses every row-level security rule.

---

## Users, before going public

LIVE currently holds ~21 user rows. 19 of them have no linked auth account —
those are **invitations**: rows the commander created so that person can claim
them by signing in with a matching email. They are not active accounts and
they cannot see anything; `current_app_user_id()` requires a linked, active,
approved profile.

If the intent is to launch with only the commander's own account and add
people deliberately afterwards, the unclaimed invitation rows can be removed.
**That is a destructive change to live data and is not done casually** — see
the checklist in `QA_CHECKLIST.md` and get it confirmed explicitly first.

---

## Verification query

Run in both projects; the outputs should match.

```sql
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_type='BASE TABLE') as tables,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public') as functions,
  (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid
     join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') as policies,
  (select md5(string_agg(t||c, ',' order by t, c)) from (
     select table_name t, column_name||':'||data_type c
       from information_schema.columns where table_schema='public') x) as schema_sig,
  (select md5(string_agg(proname, ',' order by proname))
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public') as func_sig,
  (select md5(string_agg(c.relname||'::'||p.polname, ',' order by c.relname, p.polname))
     from pg_policy p join pg_class c on c.oid=p.polrelid
     join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') as policy_sig,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) as tables_without_rls;
```

All three signatures must match. `schema_sig` alone is not enough — that is
exactly the check that passed while a policy was missing. It deliberately
ignores data.
