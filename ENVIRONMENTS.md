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
| **What it actually is** | **the real system, in daily use** | **empty, safe to break** |
| Created | 2026-07-25 | 2026-05-20 |
| Tables | 20 | 18 |
| Functions | 12 | 9 |
| Migrations applied | 18 | 8 |
| Rows of company data | ~100 real | 0 |
| Auth accounts | 5 | 4 (orphans from an abandoned run) |

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

**SANDBOX is where things get tried.** Same schema, no real data. Break it
freely; if it gets into a bad state, it can be rebuilt from the migrations.

Flow for anything risky: try it in SANDBOX → confirm → apply to LIVE.

Until the sandbox is caught up (below), there is *no* safe place to try
anything, and every experiment lands on real data. That is the situation this
document exists to end.

---

## Bringing the sandbox up to the live schema

The sandbox is ten migrations behind. The gap was measured, not assumed:

- **Missing tables:** `mentoring_entries`, `tracking_weeks`
- **Missing columns:** `forum_daily_reports.updated_by`, `tasks.updated_by`,
  `tracking_items.week_id`
- **Missing functions:** `caller_outranks`, `force_updated_by`,
  `is_company_commander`
- Every other table matches exactly, compared by a hash of its column names
  and types — including `users`.

`supabase/sandbox/001_bring_sandbox_to_live_schema.sql` closes that gap. It is
migrations 023–032 in order, all idempotent, schema only — it inserts no users
and no company data.

**Run it in the SANDBOX project's SQL editor. Never in LIVE** (LIVE is already
at this state; running it there is a no-op at best).

Afterwards both projects should report the same table, function and column
signature. The verification query is at the bottom of this file.

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
  (select md5(string_agg(t||c, ',' order by t, c)) from (
     select table_name t, column_name||':'||data_type c
       from information_schema.columns where table_schema='public') x
  ) as schema_signature;
```

A matching `schema_signature` means the two databases have identical tables,
columns and types. It deliberately ignores data — the sandbox should stay
empty.
