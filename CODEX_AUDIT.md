# Codex audit — "המפקד" Phase 2 (design system)

Repo: `C:\DEV\pluga-command-system`. Next.js 16 + Supabase, Hebrew RTL, in
daily production use by one commander. **Review only — do not edit, commit
or run migrations without being asked.** Report findings with file:line.

Scope: `git diff a7308f8..HEAD` (Phase 2). Prior external audit already ran
at `57ef4a4`; its six findings are fixed in `d541635`. Focus on what came
after, and on whether those fixes are actually correct.

## What was done

Goal was "same visual identity, higher execution quality" — no re-theme.

1. `DESIGN.md` (new, repo root) is the spec. Read it first; it is also a
   claim surface — check it against the code.
2. Type scale `.text-caption/.text-meta/.text-body-ui/.text-subheading/.text-heading`
   + `.command-kpi`, in `@layer components` in `globals.css`. Named `--fs-*`
   because `--text-*` collides with existing colour tokens and with
   Tailwind v4's font-size namespace.
3. Weight roles: 400/500/600/700. `font-black` removed everywhere; Rubik
   now loads 4 weights (was 7).
4. Semantic colour tokens are **on-surface inks** with light/dark/high-contrast
   values. `--color-danger-solid` is separate for white-on-fill (the danger
   button), since the ink lightens in dark.
5. Dark mode existed already; high contrast (`data-contrast="high"`,
   `ContrastToggle`) is new.
6. All raw hex, `font-black`, `bg-white[/NN]`, `text-[Npx]` and raw
   Tailwind palette classes are gone from `src/`. Verify:

```bash
grep -rE '#[0-9A-Fa-f]{3,8}\b' src --include=*.tsx        # only layout.tsx themeColor
grep -rE 'bg-white(/[0-9]+)?\b|text-\[[0-9]+px\]' src --include=*.tsx
grep -rE '(text|bg|border)-(emerald|red|blue|amber|slate|zinc)-[0-9]' src --include=*.tsx
```

## Where the risk actually is

- **`#FF6B02` was mapped by judgement, not mechanically** — decorative →
  `--brand`, interactive → `--action`, text/meaningful → `--color-action-on-surface`.
  `--brand` is 2.85:1 on white and must never carry text. Check every
  `var(--brand)` and `var(--action)` use for a wrong call.
- **`font-black` was mapped by judgement too** — figures → `.command-kpi`,
  real page headings → 700, everything else → 600. Look for a heading that
  lost hierarchy or a figure that is no longer prominent.
- **`globals.css` has a legacy `[class*="..."]` override block** that
  rewrites colours per theme. It is fragile and partly dead now. It caused
  two real bugs already: it fixes text but not background (so
  `bg-red-50 + text-red-700` was invisible in dark), and its `!important`
  rules beat later same-specificity rules. Check whether the high-contrast
  block at the **end** of the file still wins, and whether any of that
  legacy block is now dead and misleading.
- **`statusStyles`/`priorityStyles`/`toneClasses`/`statusDotTone`** in
  tasks/tracking/dashboard/forum were rebuilt on semantic tokens. Confirm
  the status→tone mapping is semantically right, not just compiling.
- **Layering.** The scale classes must stay in `@layer components`; as
  unlayered rules they beat all utilities and killed responsive
  `sm:text-*`. Confirm no other unlayered rule in `globals.css` has the
  same problem.

## Verification notes (save yourself time)

- `npm run check` = test + lint + typecheck + build. Was green at HEAD.
- Contrast measured after fixes: light 5.07–6.79, dark 7.07–11.85,
  light+high 10.33–12.98, dark+high 8.45–16.06. **Re-measure independently.**
  Tailwind emits `/10` tints as `oklab()` — parsing those components as RGB
  gives nonsense. Composite over real ancestor backgrounds.
- `getComputedStyle` returns **stale** values for elements inside the
  `backdrop-filter` nav after a runtime theme flip, and for `display:none`
  subtrees (the mobile bottom nav at desktop width). Both produced
  convincing false failures. Use a fresh load, a viewport where the element
  is really rendered, and trust the screenshot.
- Login is email OTP to `sharziv1@gmail.com`; the code arrives via the
  Resend API (list recent sent emails). Dev server: `npm run dev`, port 3010.
- Staging holds real data. Open and cancel dialogs; do not confirm
  destructive actions. Never run "publish and close forum".

## Known-open (don't report as new)

Three form modals + the dashboard's anchored quick-create popover are still
hand-rolled; two `window.confirm` remain in the forum's
`requestDailyScopeTransition` (synchronous control flow covered by tests);
terminology (בקשה/דרישה/פערים) is unaddressed; there are two `<h1>` per page
(sidebar wordmark + page title). The documented forum baseline `2026-08-20`
no longer exists in Staging — only `2026-09-08` has data.

## What I want back

Ranked findings with file:line and a concrete fix, separating **confirmed**
(you reproduced it) from **suspected** (reasoned from code). Explicitly say
where `DESIGN.md` overstates what the code does. If nothing is wrong in an
area, say so in one line rather than restating the code.
