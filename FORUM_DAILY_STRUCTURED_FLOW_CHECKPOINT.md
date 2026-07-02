# Forum Daily — Structured Company Flow Checkpoint & Next Work Plan

Authoritative checkpoint for the **Forum Daily Structured Company Flow** round, plus the
prioritized work plan (P0–P3), the standing QA checklist, and the risk matrix.

This file is the single source of truth for "where the Forum Daily round closed and what comes
next." The other docs (`README.md`, `PROJECT_HANDOFF_AI_CONTEXT.md`, `PROJECT_SUMMARY.md`,
`AGENTS.md`, `CLAUDE.md`) point here instead of duplicating the full detail.

---

## 1. Checkpoint (verified)

```text
Branch:        main
HEAD / origin: cdcd99f Fix forum WhatsApp preview platoon mapping
Sync:          main is in sync with origin/main (push completed)
Working tree:  clean
Round:         Forum Daily Structured Company Flow — COMPLETED
Commits since previous checkpoint (16da109): 19
```

This round closed the structured מ״פ (company commander) report, deterministic per-field
aggregation, correct platoon owner mapping, the `created_by` vs `owner_user_id` ownership split,
WhatsApp short/detailed preview mapping, and the publish/close/reopen + read-only-after-close
lifecycle.

> **Post-round addendum — Mobile Release Readiness follow-up (HEAD `8422726`, UI/CSS only).**
> After this round closed, a mobile-readiness follow-up (`1f09c50` + `8422726`, pushed
> `53d4856..8422726`) made one additive change to the WhatsApp preview: `generateWhatsappText`
> now emits the company manpower total (e.g. `124/138`) in both short and detailed modes, summed
> from the mapped platoons via the same `assignPlatoonReports` path as `aggregateCompanyStructured`
> (so the preview total can never diverge from the aggregation, and no platoon is swapped). The
> deterministic aggregation in `src/lib/forum/companyReport.ts`, owner mapping, platoon assignment,
> and the publish/close/reopen lifecycle were **not** changed. Verified by browser QA on
> `2026-08-20` (short/detailed both show `124/138` + platoon counts, platoons 1–4 correct) and by
> `npm run lint` / `tsc --noEmit` / `npm run build`. The project also moved off OneDrive — work
> only from `C:\dev\pluga-command-system`.

> **Post-round addendum 3 — Forum Daily Collapsed Hierarchy (HEAD `273e49b`, UI/presentation only).**
> Forum Daily node list redesigned from a flat list with inline group labels to a collapsed/accordion
> hierarchy (`273e49b Add collapsed hierarchy to forum daily list`, on top of `b403691 Document CSS
> smoothness checkpoint`). A new `DailyNodeGroupView` type and `dailyNodeGroups` memo group the
> existing `dailyNodes` by their `group` field (pure presentation layer — no new DB queries, no
> owner mapping changes, no aggregation changes, no WhatsApp logic changes). State
> `groupToggles: Record<string, boolean>` records per-group user overrides within a session.
> Top-level groups: מחלקה 1–4, מפל״ג, פלוגה, דוחות קיימים (when present). Each group renders as an
> accessible button (`aria-expanded`) with a rotating chevron and a submission counter badge
> (הוגשו X/Y, N בטיפול). Default: מ״פ (canSeeAll) starts with only the selected group expanded;
> non-commanders start fully expanded. Child node JSX is structurally identical to the original.
> `Fragment` import removed; `ChevronDown` added. WhatsApp generation, owner mapping, aggregation,
> lifecycle actions (submit/close/reopen/reset/delete), and all Supabase queries are **unchanged**.
> **QA (Code X + מ״פ live):** lint 0, tsc clean, build 19 pages; 390/430/768/1366 — no overflow,
> expand/collapse correct, date `2026-08-20` → 7 groups הוגשו X/X, WhatsApp `124/138`, platoon
> counts `32/35 / 30/34 / 28/33 / 34/36`, UPDATED marker, no swap, lifecycle buttons intact, touch
> targets ≥44px, console clean. **מ״מ 1 live QA passed** (סגן שולי, מחלקה 1, date `2026-08-20`,
> viewports 390/430/1366): saw only "המחלקה שלי" group (children: דיווחי מ״כים + סיכום מחלקתי);
> did not see מחלקה 2–4/מפל״ג/פלוגה/WhatsApp node/foreign דוחות קיימים/company totals (`124/138`);
> expand/collapse correct; counter `הוגשו 1/2`; group header 47px, cards 69–108px; RTL correct;
> `ערוך דוח` disabled (closed); commander actions not visible; no Supabase/RLS errors; console clean.
> **Note P3 (not a regression):** `פתח נעילה`/`אפס דוח`/`מחק דוח` visible for מ״מ on their own
> closed report — matches existing code, not caused by hierarchy change, not fixed in this round.
> Docs in push range `273e49b..c7d44f3`.

> **Post-round addendum 2 — CSS Smoothness Batch 1 (HEAD `2127e79`, UI/CSS only).**
> A cross-app CSS smoothness pass (`2127e79`, on top of `75fb9ae Fix remaining mobile touch
> targets`) replaced `transition-all` with the focused Tailwind `transition` class, lightened the
> MobileHeader sticky blur (`backdrop-blur-2xl` → `backdrop-blur-md`), added mobile-only (≤640px)
> lighter glass blur/shadow, and added a global `prefers-reduced-motion` rule.
> **No Forum Daily file was touched:** `forum/page.tsx`, `src/lib/forum/companyReport.ts`, owner
> mapping, aggregation, WhatsApp generation, and the publish/close/reopen lifecycle are unchanged.
> The standing Forum QA was re-verified live on `2026-08-20` after the change (short/detailed
> WhatsApp `124/138`; platoons `32/35`, `30/34`, `28/33`, `34/36`; the מחלקה 2 `UPDATED` marker;
> no platoon swap; clean console). Known Batch 2 note: the two new mobile `backdrop-filter` rules
> reach browsers as `-webkit-`-only (the minifier keeps the last declaration written), so the blur
> reduction is live on Safari/iOS and inert on Chrome — no regression either way. Next planned
> Forum round: hierarchy/collapsed UI redesign of the Forum Daily node list (top-level platoon /
> staff groups, drill-down to subordinate reports).

### Round commits (newest → oldest)

```text
cdcd99f Fix forum WhatsApp preview platoon mapping
acd2345 Fix forum report ownership for commander-created slot reports
92af9b9 Fix forum owner mapping for staff and squad placeholders
5965615 Document forum QA owner mapping requirements
604c8cd Polish structured company report state handling
9699284 Improve forum company report dialog accessibility
ba903b2 Fix forum date input state update
996bccb Make company report a structured מ״מ-style form
e8f2161 Add structured per-field company aggregator
023fb96 Polish company report status line for in-progress reports
43d4a08 Add publish and close flow for forum daily reports
ba554e6 Add company final report editor to forum daily
c82492c Add deterministic company report generator helpers
```

---

## 2. What closed in this round

- **Structured מ״פ report** — the company summary is now a structured form (not a free textarea),
  modeled like the מ״מ form. Fields include מצבה, כוח אדם, כוננות, רפואה, ת״ש, בטיחות, משמעת,
  לוגיסטיקה, בקשות אישיות, רצוי/מצוי, רשת וידע, לקחים יומיים, פעולות להמשך, הערה אישית, דגשי מ״פ,
  ולו״ז ודגשים להפצה.
- **Deterministic aggregation** — `aggregateCompanyStructured()` rolls platoon reports up into the
  company form per-field, with summed `present_count`/`total_count`. No AI is part of the fixed
  flow.
- **Owner mapping** — platoon assignment is by `owner_user_id` + role/unit of the report owner.
  `metadata.node_label` is a last-resort fallback only; assignment is **never** by array index.
- **Ownership split** — `created_by` (who performed the action) is kept distinct from
  `owner_user_id` (the slot/report owner). Commander-created-for-subordinate reports keep
  `created_by = commander`, `owner_user_id = subordinate`.
- **WhatsApp preview mapping** — short and detailed previews now use the same
  `assignPlatoonReports` / `findPlatoonSummaryOwner` path as the aggregation, so platoons
  1/2/3/4 are mapped consistently (the `cdcd99f` fix).
- **Lifecycle** — publish/close, reopen, and read-only-after-close all work; closing also runs the
  existing best-effort carry-forward to the next Jerusalem day.

### Status semantics

- `submitted` and `closed` are **final**.
- `draft` / `in_progress` reports can still enter the company aggregation, tagged
  `[בטיפול — טרם הוגש סופית]`.
- A missing platoon report shows `[לא הוגש דוח]`.

---

## 3. Sensitive code map (do not break without full QA)

Verified by read-only code audit. Two files carry the whole flow.

### `src/lib/forum/companyReport.ts` (pure module — no React/Supabase/side effects)

| Symbol | Lines | Role |
|---|---|---|
| `resolvePlatoonNumber` | 141–158 | Resolves a report's platoon (1–4): owner match first, `metadata.node_label` regex last. **Never** by `unit_id` or array index. |
| `assignPlatoonReports` | 173–189 | Single source of truth mapping platoon reports → `Map<number, report>` + `unidentified`. Shared by aggregation **and** WhatsApp. |
| `aggregateCompanyStructured` | 266–330 | Sums present/total, rolls up per-field text, returns stats + warnings. `commander_closing` stays manual. |
| `buildCompanyReport` | 335–529 | Generates the full company summary text. |
| `MISSING_REPORT` / `IN_PROGRESS_TAG` | 83 / 84 | `[לא הוגש דוח]` / `[בטיפול — טרם הוגש סופית]`. |

### `src/app/(protected)/forum/page.tsx` (all UI, state, Supabase I/O)

| Symbol | Lines | Role |
|---|---|---|
| `findPlatoonSummaryOwner` / `findSquadCommanderOwner` / `findStaffOwner` | 234–290 | Match active+approved owners to structural slots by role + unit. |
| `dailyNodes` | 461–633 | Builds structural slots + dynamic "existing reports" nodes; filters a report out of the fallback once a structural slot represents it. |
| `findReportForNode` | 651–671 | Match order: `reportId` → owner/level → owned → staffRole → company. |
| `generateWhatsappText` | 702–805 | Reuses `assignPlatoonReports` / `findPlatoonSummaryOwner` so WhatsApp cannot diverge from aggregation. |
| `persistCompanyReportContent` | 1778–1861 | Safe merge write (`{ ...existing, ...patch }`) of the company report content. |
| `publishAndCloseForum` | 1897–1957 | Saves the final company form, bulk-closes the day, runs carry-forward. |
| `carryForwardClosedReport` | 1409–1472 | Best-effort next-day draft on close (insert only, `23505` skipped, never blocks). |

Audit actions added by this round (best-effort, in `src/lib/audit.ts`):
`forum_company_report_saved`, `forum_daily_forum_published`, `forum_daily_report_carried_forward`.

---

## 4. QA that passed

- **Full Structured Company Forum Flow QA** — date `2026-08-20`.
- **Focused WhatsApp Preview QA** — after `cdcd99f`.

What was verified:

- owner mapping; ownership (`created_by` ≠ `owner_user_id`)
- מ״כ reports, מ״מ reports, staff / מפל״ג
- structured מ״פ report fill
- aggregation **124 / 138** (present / total) on the QA data set
- מ״מ 3 tagged `[בטיפול — טרם הוגש סופית]`
- מ״מ 2 "UPDATED" text appeared after refresh
- save/reload, publish/close, read-only after close, reopen → re-close
- WhatsApp preview short + detailed correct; מחלקה 1/2/3/4 mapped correctly
- dashboard load, tracking load, console clean
- `npm run lint`, `npx tsc -p tsconfig.json --noEmit`, `npm run build` all green

---

## 5. Product & architecture decisions that must not be broken

1. **The מ״פ report is a structured form**, not a free textarea.
2. **Aggregation is deterministic.** AI is not part of the fixed flow. AI may only ever be an
   optional, explicitly user-approved action (e.g. "improve wording") — never automatic.
3. **Platoon source of truth = `owner_user_id` + role/unit.** `metadata.node_label` is a
   last-resort fallback only. Never map by array index
   (`platoonReports.forEach((report, index) => 'מחלקה ' + (index + 1))` is forbidden — it swapped
   מחלקה 1/2 content historically).
4. **`created_by` ≠ `owner_user_id`.** `created_by` is the actor; `owner_user_id` is the report
   owner. Keep both distinct on every insert.
5. **`submitted` / `closed` are final**; `draft`/`in_progress` enter aggregation tagged
   `[בטיפול — טרם הוגש סופית]`; missing = `[לא הוגש דוח]`.
6. **Do not remove the "existing reports" fallback** until legacy/unmatched reports are understood.

---

## 6. Open items (non-blocking)

| # | Item | Where (verified in code) | Class | Suggested fix |
|---|---|---|---|---|
| 1 | Duplicate dynamic company node after saving the company report — a "שחר ברנע · מ״פ · פלוגה · company · דוח קיים" node appears alongside the structural "סיכום פלוגתי" slot. | `dailyNodes` filter `forum/page.tsx:495–502` excludes `platoon`/`squad`/`staff` from the dynamic list but `report_level === 'company'` falls through to `return true`. | UX cleanup | Exclude `report_level === 'company'` in the dynamic-node filter. |
| 2 | Unsaved company draft resets when switching slots — an aggregated-but-unsaved draft is overwritten on slot change. | `useEffect` `forum/page.tsx:972–975` re-runs `setReportDraft(draftFromReport(selectedReport))` on every `selectedReport` change. | UX improvement | Autosave or warn before slot switch; or gate the `useEffect` by level/owner. |
| 3 | Docs checkpoint lag — context docs trailed this round by 19 commits. | (this checkpoint) | Docs | Addressed by this round of doc updates. |
| 4 | No automated regression tests for the pure aggregation/mapping module. | `companyReport.ts` is pure → ideal for unit tests. | Optional / future | See §7 P1. |

---

## 7. Work plan — P0 / P1 / P2 / P3

Tool legend: **Code X** = implementer, **Claude Code** = deep planning / docs / review,
**Claude Chrome** = connected visual/browser QA.

### P0 — Protect / critical maintenance (do not break)

These are not tasks to "do" — they are invariants to guard on every future change.

| Guard | Why | Tests required |
|---|---|---|
| Owner mapping (`resolvePlatoonNumber`, `assignPlatoonReports`) | A regression silently swaps platoon content | Browser QA + (future) unit tests; never map by index/`unit_id` |
| Ownership (`created_by` vs `owner_user_id`) | Breaks aggregation, permissions, history | Verify both columns on every insert path |
| WhatsApp preview mapping (`generateWhatsappText`) | Must stay consistent with aggregation | Parity check vs `aggregateCompanyStructured` |
| Structured aggregation (`aggregateCompanyStructured`) | Core company report correctness | Aggregation 124/138 regression on QA data |
| Lifecycle (publish/close/reopen, read-only after close) | Editing after close / blocked close | Browser QA full lifecycle |
| RLS / Auth / `src/proxy.ts` / migrations | Security & access | No change without snapshot + explicit plan |

### P1 — Recommended immediate tasks

| # | Task | Why | Scope | Likely files | Risk | Tests | Browser QA | DB/RLS | Tool | Suggested commit |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Docs checkpoint** | Context docs were 19 commits behind; new agents must not see a stale/contradictory state | Update checkpoint + decisions + open items + roadmap; add this file | Markdown docs only | Low | `git status`/`git diff` only | No | No | Claude Code | `Document forum daily structured flow checkpoint` |
| 2 | **Duplicate dynamic company node cleanup** | Confusing duplicate of the structural "סיכום פלוגתי" slot | Exclude `report_level === 'company'` in `dailyNodes` filter (495–502) | `forum/page.tsx` | Medium (touches node list) | lint/tsc/build + browser QA | Yes | No | Code X | `Hide duplicate dynamic company node in forum daily` |
| 3 | **Unsaved company draft protection** | Aggregated-but-unsaved draft is silently lost on slot switch | Autosave-on-switch OR warn before discard; or gate `useEffect` (972–975) by level/owner | `forum/page.tsx` | Medium (state lifecycle) | lint/tsc/build + browser QA | Yes | No | Code X | `Protect unsaved company report draft on slot switch` |
| 4 | **Regression tests for `companyReport.ts`** | Pure module; cheap, high-value safety net for mapping/aggregation | Unit tests for `resolvePlatoonNumber`, `assignPlatoonReports`, `aggregateCompanyStructured` (owner-first, label fallback, never index; `[בטיפול]` vs `[לא הוגש דוח]`; present/total sum) | new test file + test runner wiring | Low (no product code change) | the tests themselves | No | No | Code X (impl) + Claude Code (plan) | `Add forum company report aggregation unit tests` |
| 5 | **Standing Forum Daily QA checklist** | Repeatable regression safety for every future forum change | Adopt §8 checklist as the canonical pre-commit gate | Markdown docs only | Low | n/a | n/a | No | Claude Code | (folded into docs checkpoint) |

### P2 — UX / product polish

| # | Task | Why | Scope | Risk | Tool |
|---|---|---|---|---|---|
| 1 | Remove dev-facing "UI-gated…" text from the daily forum | Dev language leaks into the user UI | Copy-only | Low | Code X |
| 2 | Clearer distinction between a structural slot and an "existing report" | Reduce slot/report confusion | UI labeling | Low–Med | Code X + Chrome QA |
| 3 | Better status labels & empty/loading/error states | Operational clarity | UI states | Low | Code X |
| 4 | Missing fields polish (לו״ז מחר, חריגים/פערים) + placeholders/labels | Completeness of the report form | UI form | Low–Med | Code X + Chrome QA |
| 5 | Responsive polish (date input tight at 390px, disclosure glyph) | Mobile readability | CSS/layout | Low | Code X + Chrome QA |

### P3 — Future capabilities (require explicit approval + planning)

| # | Task | Notes |
|---|---|---|
| 1 | Optional AI "improve wording" action | **Opt-in only, explicit user approval per use.** Never part of the fixed deterministic flow. |
| 2 | Export / sharing of the company report | Beyond WhatsApp text |
| 3 | Dashboard insights from forum data | Read-only analytics |
| 4 | Deeper tracking integration | Cross-module |
| 5 | Audit UX surface | Real `audit_logs` view |
| 6 | Real MK→MM→MP hierarchy mapping + hierarchy RLS | Requires data model + Supabase snapshot + planning. No faked hierarchy in UI or RLS. |
| 7 | Forum wiring to `commanded_unit_id` | Foundation exists (013); not wired into visibility/RLS. |

Keep tasks small and individually closeable. Do not bundle large undefined work.

---

## 8. Standing Forum Daily QA checklist

### 8.1 Git preflight

```bash
git status --short
git branch --show-current
git log --oneline -8
```

### 8.2 Static checks (after any code change)

```bash
npm run lint
npx tsc -p tsconfig.json --noEmit
npm run build
```

### 8.3 Browser QA (Claude Chrome, connected)

1. Sign in as **שחר ברנע · מ״פ · פלוגה**.
2. Open Forum Daily.
3. Select the QA date.
4. Create / open מ״כ reports.
5. Create / open מ״מ reports.
6. Open staff slots.
7. Fill the structured מ״פ report.
8. Run aggregation.
9. Save / reload.
10. Publish / close.
11. Confirm read-only after close.
12. Reopen.
13. WhatsApp preview — short.
14. WhatsApp preview — detailed.
15. Dashboard load.
16. Tracking load.
17. Console clean.

### 8.4 Regression assertions

- Aggregation is **124 / 138** on the QA data set.
- מחלקה 1 does **not** receive מחלקה 2 content (no index-based swap).
- מחלקה 2 includes the "UPDATED" text.
- `draft` / `in_progress` are tagged `[בטיפול — טרם הוגש סופית]`.
- A missing platoon shows `[לא הוגש דוח]`.
- A `closed` report stays read-only (unless reopened).
- WhatsApp short/detailed map the same platoon as the aggregation.

---

## 9. Risk matrix

| Change area | Risk | Required before touching |
|---|---|---|
| Owner mapping (`resolvePlatoonNumber` / `assignPlatoonReports`) | High — silent platoon content swap | Full browser QA + regression assertions; never index/`unit_id` |
| WhatsApp preview (`generateWhatsappText`) | High — diverges from aggregation | Parity vs aggregation + short/detailed QA |
| Status flow (publish/close/reopen) | High — edit-after-close or blocked close | Full lifecycle QA |
| RLS / Auth | Critical — access & security | Supabase snapshot + explicit plan; SQL manual only |
| Schema / migrations | Critical — data integrity | Additive only, manual SQL, snapshot, plan |
| Dashboard / tracking | Medium — cross-module load regressions | Load smoke test, console clean |
| `dailyNodes` filter | Medium — duplicate/missing nodes | Browser QA of slot list + existing-reports fallback |

---

## 10. Guardrails (carry into the next round)

- No push without explicit approval.
- No SQL without explicit approval; SQL is manual-only.
- No RLS / Auth / `src/proxy.ts` / migration changes without a Supabase snapshot + explicit plan.
- No `git add -A`; stage specific files only.
- No `git reset` / `rebase` / `checkout` of work.
- No broad refactor.
- Do not mix docs changes with product-code changes in one commit.
- Keep Hebrew RTL and the Light Gloss Command System intact.
- If the Git state does not match this checkpoint, stop and report before acting.
