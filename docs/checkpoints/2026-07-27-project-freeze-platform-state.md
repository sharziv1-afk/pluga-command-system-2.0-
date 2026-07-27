# Project Freeze + Platform Truth Checkpoint — 2026-07-27

מסמך זה הוא נקודת החזרה המחייבת לפרויקט **"המפקד"**. הוא מקפיא את מצב
ה־Git, ‏PR #3, סביבת Supabase ותוכנית ה־UI כדי למנוע merge או deployment
שנשענים על הנחות חלקיות.

## 1. Executive Status

- **Current decision: `DO NOT MERGE`.**
- **Current work mode: frozen / documentation only.**
- `main` נקי ומסונכרן עם `origin/main` ב־`fec9a91 Expose invalid CommandField borders`.
- PR #3 פתוח, Ready for review, ולא מוזג. הוא עבר staging A–J ו־review, אך
  אינו מאושר ל־production.
- ה־staging כולל migration 016; ‏`main` ו־production אינם מאומתים ככוללים
  אותו.
- חיבור Supabase production ל־GitHub עם deploy ל־`main` הופך merge אפשרי
  לפעולת deployment/migration, ולכן אסור להחליט עליו מתוך ה־repo בלבד.
- עבודת UI/Product נעצרה. UI-1 הושלמה רק למסכים ציבוריים; protected QA חסום
  עד אבחון Auth נפרד.

## 2. Current Git State

| Item | State |
|---|---|
| Repository | `C:\dev\pluga-command-system` |
| Verified base branch | `main` |
| Verified base HEAD | `fec9a91 Expose invalid CommandField borders` |
| Base sync | `main = origin/main` after `git pull --ff-only origin main` |
| Checkpoint branch | `chore/project-freeze-checkpoint-2026-07-27` |
| Working tree before checkpoint | clean |
| PR #3 remote head | `03d36ee9cd79016741f85f96aa4c533a0931ef82` |

ה־checkpoint branch מקומי בלבד. אין push, merge, rebase או שינוי קוד במסגרת
הקפאה זו.

## 3. PR #3 Status

- PR: [#3 — Users RLS/Auth hardening](https://github.com/sharziv1-afk/pluga-command-system-2.0-/pull/3)
- Base: `main`
- Head: `fix/security-users-rls-auth-hardening`
- Head commit: `03d36ee Document PR3 staging validation results`
- State לפי ה־checkpoint הידני האחרון: Open, Ready for review, mergeable,
  checks passed; Supabase Preview skipped.
- ה־review הידני קיים אך GitHub עשוי לסווג אותו `COMMENTED`, לא `APPROVED`.
- Claude pre-red-team verdict: `APPROVE_REVIEW_NO_MERGE_YET`.
- Red-team verdict: `MERGE_NOT_DECIDABLE_FROM_REPO_ONLY`.
- Current decision: **`DO NOT MERGE`**.

הענף כולל שבעה commits צפויים בלבד:

```text
ea8b35f Add users RLS auth hardening migration
d1e630d Harden user registration profile writes
75e9ecd Align users RLS migration with live snapshot
8d0d67d Map profile claim conflicts during registration
bea15e2 Document users RLS staging deployment runbook
88df888 Document OTP email template requirement
03d36ee Document PR3 staging validation results
```

ה־diff מול `main` מוגבל ל:

```text
supabase/migrations/016_users_rls_auth_hardening.sql
src/app/(auth)/login/page.tsx
docs/deployment/users-rls-auth-hardening-runbook.md
docs/deployment/next-security-batches-decision-pack.md
PROJECT_HANDOFF_AI_CONTEXT.md
```

## 4. Platform Truth Table

| Surface | Verified state | Confidence / source | Operational meaning |
|---|---|---|---|
| Local Git / `main` | `fec9a91`, clean, synced | High — local Git verification | Safe documentation base; no PR #3 code |
| PR #3 branch | Remote head `03d36ee`; seven expected commits | High — `git ls-remote`, log and diff | Branch exists and is separate from `main` |
| PR #3 GitHub metadata | Open, Ready, mergeable, checks passed, not merged | High for saved manual checkpoint; live CLI unavailable | Re-verify in GitHub before any future action |
| GitHub integration | No webhooks found manually; GitHub Apps include Lovable, Supabase and Vercel | Medium/high — prior manual platform inspection | Apps can act without a repository webhook |
| Vercel | Existing `thepluton` demo points to `sharziv1-afk/thepluton`, not this repo | High — prior manual platform inspection | The old Vercel demo is not the direct PR #3 blocker |
| Supabase staging | `hamifkad-staging`; 001–015, seed and 016 applied manually; A–J passed | High — manual staging snapshots/tests | PR #3 runtime behavior is validated in staging |
| Supabase production | Connected to `sharziv1-afk/pluga-command-system-2.0-`, root `.`, production branch `main`, Deploy to production ON | High — prior manual platform inspection | Merge to `main` may apply migration 016 automatically |
| Repository `main` | No migration 016, `claim_own_profile`, guard trigger or PR #3 deployment docs | High — local tree/search | `main` is not aligned with staging |
| Authenticated UI QA | Protected routes not completed in UI-1 | High — local QA evidence | UI audit remains incomplete, not failed product QA |

Platform facts sourced from earlier manual dashboard inspection must be
re-verified in the dashboards before a future merge/deploy decision. No
dashboard was changed during this checkpoint.

## 5. Hard Stop Rules

Until a new explicit decision:

- **NO MERGE**
- **NO REBASE AND MERGE**
- **NO PRODUCTION MIGRATION**
- **NO SQL**
- **NO SUPABASE CHANGES**
- **NO UI CONTINUATION**
- **NO LOGIN PASSWORD GUESSING**
- no push from the checkpoint branch
- no commit to the PR #3 branch
- no production deployment
- no `.claude` sync or local-agent cleanup

## 6. Why We Stopped

The blocking issue is not a known PR #3 code defect. The blocking issue is
platform coupling:

1. PR #3 contains migration 016 and application code that depends on it.
2. Staging has migration 016 and passed the full A–J manual test matrix.
3. `main` does not contain migration 016 or the dependent code.
4. Supabase production is reportedly connected to this GitHub repository with
   deployment from `main` enabled.
5. Therefore, merging PR #3 may be both a Git merge and a production database
   deployment. That action is not safely decidable from the repository alone.

The safe response is to freeze, preserve evidence and require an explicit
production strategy before touching the PR.

## 7. Staging vs Production

### Staging — verified manually

- Project: `hamifkad-staging`.
- Baseline migrations 001–015 and seed applied.
- Migration 016 applied successfully.
- Five canonical `public.users` policies present.
- `is_commander` is `STABLE` with a safe `search_path`.
- `claim_own_profile`, `guard_users_sensitive_fields` and its trigger exist.
- Email OTP works through staging Mailtrap/SMTP with `{{ .Token }}`.
- Registration, self-escalation blocking, commander approval, access gating,
  profile claim, linked-email conflict, friendly errors and `last_login_at`
  all passed (A–J).

### Production — do not infer from staging

- Production is not known to include migration 016.
- A fresh production snapshot of policies, functions and triggers is required.
- A backup and explicit operator approval are required before any migration.
- Migration 016 must precede the application code if deployment proceeds.
- Do not copy staging assumptions, users or SMTP settings into production.

### Repository `main`

- Contains Batch A stabilization through `fec9a91`.
- Does not contain migration 016 or PR #3 runtime/docs changes.
- Must not be described as equivalent to the validated staging runtime.

## 8. Auth/Login Issue

UI-1 attempted a protected-route audit against the local app. Public/Auth
surfaces loaded, but protected routes could not be audited because no stable
authenticated session was available.

Observed local evidence:

- Next/dev logs contain `TypeError: fetch failed` with an `EACCES` cause.
- Login attempts reported errors around the existing-user login flow.
- `src/proxy.ts` calls `supabase.auth.getUser()` and redirects when no user is
  returned; it does not explicitly classify a Supabase error separately from
  an unauthenticated user.

Current diagnosis: **unproven; confidence medium**. It may be local
network/process access, Supabase connectivity or proxy/session error handling.
It is not evidence of a PR #3 regression. Do not change Auth, proxy, env or
passwords during the freeze. Resume this only as a separate read-only diagnosis.

## 9. UI/Product Plan Status

- UI-1 Visual/Mobile Audit: **partially completed**.
- Public/Auth surfaces: inspected.
- Protected dashboard/requests/tracking audit: blocked by authenticated access.
- UI-2 Shell/sidebar/mobile polish: not started.
- UI-3 Intro/help/onboarding explanations: not started.
- UI-4 לוחמים page: planning only.
- UI-5 Offline mode: planning only; no implementation or Supabase strategy
  change.

Do not resume UI implementation until the project is deliberately unfrozen.
The first UI action later is to complete the protected UI-1 audit with a
known-good staging account/session.

## 10. Agent Docs Status

- This tracked checkpoint supersedes stale “P0 Local Stabilization Batch A”
  current-state sections in the top-level agent docs.
- `README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `AGENTS.md`, `CLAUDE.md` and
  `PROJECT_SUMMARY.md` point here.
- `.ai-workspace/runs/` remains ignored and holds local operational evidence.
- `.claude/` is local tooling, not project truth. A prior audit reported 25
  managed files needing sync and 0 in sync; this drift was not changed.
- Repository docs and tracked `.ai-workspace` contracts remain authoritative.

## 11. Next Return Plan

1. Re-open this checkpoint and confirm PR #3 remains open, unmerged and blocked.
2. Choose exactly one production strategy:
   - **A — Git-only merge:** temporarily disable/disconnect Supabase production
     deploy integration, then separately plan migration and code deployment.
   - **B — Controlled production deployment:** keep integration enabled, but
     complete production preflight, backup and explicit approval before merge.
   - **C — Keep frozen:** leave PR #3 open and do static docs/UI planning only.
3. If choosing B, collect fresh production `pg_policies`,
   functions/triggers snapshots, backup, reconcile exact live names with 016,
   approve the operation, apply/verify 016 in a controlled window, then decide
   whether to merge/deploy code.
4. Run a separate read-only Auth diagnosis; do not guess credentials or mutate
   Supabase.
5. Complete protected UI-1 audit, then decide whether to start UI-2 or UI-3.

## 12. Copy-Paste Restart Prompt

```text
/GOAL

חזור לפרויקט "המפקד" מנקודת ה-freeze של 2026-07-27.

קרא תחילה:
- docs/checkpoints/2026-07-27-project-freeze-platform-state.md
- PROJECT_HANDOFF_AI_CONTEXT.md
- AGENTS.md
- CLAUDE.md

כללי פתיחה:
- אמת Git ו-working tree לפני פעולה.
- אמת ב-GitHub ש-PR #3 עדיין פתוח ולא מוזג.
- אל תמזג, אל תריץ SQL/migration ואל תיגע ב-Supabase עד בחירת strategy מפורשת.
- אל תניח ש-main, staging ו-production מסונכרנים.
- אל תמשיך UI protected QA לפני אבחון Auth read-only עם session ידוע.

החלטה ראשונה בלבד:
בחר A) Git-only merge לאחר נטרול Supabase deploy integration,
B) production preflight מלא לפני merge, או C) המשך freeze ותכנון סטטי בלבד.

עצור אחרי הצגת מצב אמת והמלצה אחת.
```
