# DESIGN.md — "המפקד"

The rules for every visual decision in this codebase. If a component or a page
disagrees with this file, the file wins — fix the component. Written for both
humans and AI agents touching `src/`.

This is Phase 2 of the approved launch plan: **same visual identity, refined
to a higher execution bar** (Apple-grade attention to spacing/type/motion/
states), not a new brand. No color-scheme swap, no per-user theming.

## 1. Color

### 1.1 The rule nobody had written down until now

Two oranges exist and they are **not interchangeable**:

```css
--brand:  #ff6b02   /* decorative only — logo, illustration accents, glow */
--action: #c2410c   /* the ONLY interactive color — buttons, links, focus meaning */
```

`--brand` fails WCAG AA on white (contrast ~2.9:1). `--action` is 5.18:1.
**Never** put `--brand` on text or on anything a user clicks, taps, or focuses.
`--brand` is for the logo mark, decorative glows (`.tactical-glow-orange`),
and the top-of-app-icon color. Everything a user *acts on* is `--action`.

### 1.2 Token layers

Primitive-free — this project uses semantic tokens directly (no `--orange-500`
scale underneath). Keep it that way; a primitive layer is unnecessary
indirection at this app's size. Every token below is defined once in `:root`
(light) and redefined only where it changes, in `:root[data-theme="dark"]`
and `:root[data-contrast="high"]`.

| Token | Role |
|---|---|
| `--color-app-bg` | Page background |
| `--surface` / `--surface-raised` / `--surface-muted` | Card / elevated card / recessed panel |
| `--text-primary` / `--text-secondary` / `--text-muted-accessible` | Body text hierarchy, all AA-checked |
| `--border-subtle` / `--border-strong` | Hairline dividers vs. emphasized borders |
| `--brand` | Decorative only (§1.1) |
| `--action` / `--action-hover` | The one interactive color |
| `--color-teal` | Secondary actions only (never primary CTAs) |
| `--color-success` / `--color-warning` / `--color-danger` / `--color-info` | Semantic status **ink** — text/icon on a 10–12% tint of itself. Flips per theme. |
| `--color-danger-solid` | Danger as a **filled** background under white text. Constant across themes. |
| `--focus-ring` | Keyboard focus outline |

**Status colors have two roles and they are not interchangeable.** Nearly
every use is coloured text or an icon sitting on a 10–12% tint of the same
colour, so those tokens are tuned as *inks* and must lighten on a dark
ground — a dark-blue ink on a dark surface measures under 2:1 and is the
exact regression this split exists to prevent. The one place a status colour
backs white text (`CommandButton`'s `danger` variant) uses
`--color-danger-solid`, which deliberately does not follow the ink. If you
ever add a filled success/warning/info button, add the matching `-solid`
token rather than reusing the ink.

### 1.3 Dark mode is not inverted light mode

Per the project's own history, `.21st/design.json` once captured dark values
while declaring `colorMode: light` — proof this distinction gets lost if it
isn't written down. Rules:

- Depth in dark mode comes from **surface lightness steps** (`--surface` <
  `--surface-raised`), not heavier shadows. Dark shadows are for separation
  from the page background only, not to fake elevation.
- Same hue/chroma for `--action` in both modes; only lightness may shift
  slightly for contrast. `--action-hover` stays `#a63d00` in both.
- Body text weight should not increase in dark mode — light-on-dark already
  reads heavier than dark-on-light at the same weight.
- Every raw hex or `rgba()` written for a light-mode surface (borders, icon
  buttons, glow backgrounds) needs a `:root[data-theme="dark"]` sibling rule.
  Grep for `rgba(2, 1, 8,` and `rgba(255, 255, 255,` before shipping any new
  component — those are the light-mode neutral-tint patterns that need a dark
  counterpart.

### 1.4 High contrast is an accessibility mode, not a "theme"

`:root[data-contrast="high"]` — for outdoor glare and low-vision use, not a
personalization option sitting next to color schemes.

What it actually changes today, stated precisely rather than aspirationally:

- `--border-subtle` and `--border-strong` become **opaque** colours (not
  alpha), and cards, dialogs, icon buttons and every form control get a
  1.5px border in `--border-strong`.
- Secondary/muted text darkens (light) or lightens (dark).
- The four status inks move to AAA-range values against their own tint
  (measured ≥ 7:1 on the surfaces this app renders).
- The focus ring goes to pure black / pure white.

What it does **not** do: it does not push every colour pair in the app to
7:1 — `--action` on white stays 5.18:1 (AA), and filled buttons keep their
white-on-solid treatment. Don't write "AAA everywhere" in this file again
unless someone has actually measured it everywhere.

The component-level border rules for this mode live at the **end** of
`globals.css` and must stay there: the legacy dark-mode block hardcodes
`border-color … !important` at the same specificity, so anything earlier
loses in dark+high-contrast. There is a comment on the block saying so.

### 1.5 What this project explicitly rejected (see prior design-direction review)

- **No user-selectable accent-color picker.** The token migration isn't
  complete enough for every screen to reflect a swapped color, and a 20-user
  internal tool doesn't need per-user branding. Revisit only after §3
  (token migration) is 100% done across all six heavy pages.
- **No decorative background gradients/blobs** on operational screens
  (dashboard, tasks, requests, forum). This is a tool used under time
  pressure; decoration competes with signal. The existing subtle radial
  wash in `body`/`.command-page-shell` is the ceiling, not a floor to build
  on.
- **No warm-cream palette swap.** Flagged in review as the generic
  "AI-generated design" cliché (warm cream + soft gradient). Current
  cool-neutral background stays.

## 2. Typography

### 2.1 Scale (product register — fixed `rem`, not fluid `clamp()`)

Five sizes mapped to semantic roles. **Apply them through the utility
classes**, not the raw variables:

| Class | Size token | Size | Line-height | Role |
|---|---|---|---|---|
| `.text-caption` | `--fs-caption` | 0.75rem (12px) | 1.4 | Timestamps, metadata, badge text |
| `.text-meta` | `--fs-meta` | 0.8125rem (13px) | 1.45 | Secondary UI, table cells, sublabels |
| `.text-body-ui` | `--fs-body` | 0.9375rem (15px) | 1.55 | Default body/UI text |
| `.text-subheading` | `--fs-subheading` | 1.0625rem (17px) | 1.35 | Card titles, section headings |
| `.text-heading` | `--fs-heading` | 1.375rem (22px) | 1.25 | Page titles |

**The size tokens are named `--fs-*` on purpose.** The obvious names
(`--text-body` etc.) are unavailable: `--text-primary`, `--text-secondary`
and `--text-muted-accessible` already exist as **color** tokens, and
Tailwind v4's `--text-*` theme namespace is the font-size namespace, so
declaring a size under those names would collide with a color and silently
break one of the two. Never introduce a size token named `--text-*` here.

There is no `--text-kpi` token. Big KPI figures use the `.command-kpi`
class, which sets only `tabular-nums`, weight 700, tight tracking and
`line-height: 1` — the size comes from the call site, deliberately, because
the two KPI contexts differ: `MetricCard`'s compact tiles use `text-2xl`
and the dashboard's larger summary tiles use `text-[2rem] sm:text-3xl`.
Those two are the sanctioned exception to the "no arbitrary sizes" rule
below; everything else maps to the table.

This is a hand-tuned scale, not a strict modular one — the steps are
1.08 / 1.15 / 1.13 / 1.29, tightened at the small end where a dense Hebrew
RTL operational UI needs finer gradations, and opened at the top so page
titles separate clearly. Don't "correct" it to a uniform ratio without
re-checking every migrated screen.

Two deliberate departures from `typeset.md`, both product calls rather than
oversights: body text is 15px rather than its 16px floor (density matters
in a table-heavy command tool, and the mobile rule in `globals.css` already
forces 16px on every form field to stop iOS zoom), and line-heights run
slightly looser than its Latin defaults because Hebrew has less
ascender/descender variance. If small-screen readability testing says 15px
is too tight in the field, raising `--fs-body` is a one-line change.

**Kill immediately on sight**: any `text-[Npx]` arbitrary Tailwind value.
There were 100 of these before this round (including a `text-[8px]`, below
any reading threshold). Every one maps to a role above — if none fits, that's
a sign the layout needs rethinking, not a new arbitrary size.

### 2.2 Weight roles (the 92%-bold problem)

Before this round: 258 `font-black` (900) + 221 `font-bold` (700) vs. 43
`font-semibold` (600) and 1 `font-medium` (500) app-wide. When almost
everything is heaviest-or-heavy, nothing reads as emphasized — this is the
single biggest reason the product reads as "a website" instead of "a
premium app."

Four roles, four weights, each with exactly one job:

| Weight | Role |
|---|---|
| 400 (Regular) | Body copy, descriptions, table cell values |
| 500 (Medium) | Secondary labels, sublabels, metadata |
| 600 (Semibold) | Card titles, form labels, active nav item, badge text |
| 700 (Bold) | Page headings, KPI numbers, primary CTA text |

`font-black` (900) is **gone from `src/`** and must not come back — the
rollout is complete, and `grep -r font-black src` returning anything is a
regression. Weight was decided per call site rather than swept, because
rewriting weight in isolation flattens hierarchy instead of fixing it: the
figures moved to `.command-kpi`, real page headings kept 700, and the long
tail of card titles, form labels and chips went to 600.

Distribution across `src/` now: 269 semibold, 219 bold, 1 medium, the rest
regular — against the 258 `font-black` + 221 `font-bold` vs. 43 semibold
that opened Phase 2.

### 2.3 Font loading

Rubik loads **four weights** (400/500/600/700) × 2 subsets, matching the
four roles above. It used to load seven (300–900) ≈ 14 files; 300, 800 and
900 were dropped once `font-black` hit zero, roughly halving the font
payload.

Do not re-add a weight without adding the call sites that need it, and do
not remove one while call sites still ask for it — a missing weight gets
synthesised by the browser and looks worse than the real face.

### 2.4 Universal rules

- `tabular-nums` on every KPI number and anything in a table column of
  numbers (already the pattern in `.command-kpi` — extend it, don't
  reinvent it).
- Small all-caps or badge-style labels get `letter-spacing: 0.04em`.
- Body text containers cap at `65ch` where they hold prose (request/task
  descriptions, forum free-text fields); tables and cards are exempt.

## 3. Component rules

### 3.1 Buttons — one implementation

`CommandButton` (`src/components/ui/CommandButton.tsx`) is canonical: it
already has `forwardRef`, a `loading` state, an `icon` slot, and five
semantic variants (`primary`/`teal`/`ghost`/`subtle`/`danger`). `GlossyButton`
is not deleted (11 consumer files use its `cyan`/`orange`/`slate` API) — its
internals delegate to `CommandButton` so there is exactly one styling
implementation. New code always reaches for `CommandButton` directly;
`GlossyButton` is legacy-API-only.

The legacy API passes an icon and a label together **as children**, so
`GlossyButton` wraps children in an `inline-flex` row. That wrapper is not
cosmetic: Lucide renders block-level SVGs, and `CommandButton` wraps
children in a plain inline `<span>`, so removing it stacks every icon above
its label. `CommandButton`'s own `icon` prop has no such problem — it is
rendered as a flex sibling of the label.

### 3.2 Modals — one implementation

`CommandOverlay`/`CommandConfirmDialog` (`src/components/ui/CommandDialog.tsx`)
are canonical: native `<dialog>`, real focus trap, Escape-to-close, top-layer
stacking, RTL-safe, no dependency. Every `window.confirm()` call becomes a
`CommandConfirmDialog` (9 usages across 6 files today). Every hand-rolled
`fixed inset-0` modal becomes a `CommandOverlay` (`variant="dialog"` for
centered, `variant="sheet"` for a side/bottom sheet — already used for long
forms).

Two rules that a hand-rolled modal usually got right and a careless port
loses:

- **A confirm dialog whose action is in flight must block every dismissal
  path, not just its buttons.** `loading` on `CommandConfirmDialog` sets
  `dismissible={false}` (Escape + backdrop) *and* guards `onClose` (the
  header X). Otherwise Escape hides the dialog while the write is still
  running — which for the forum's publish-and-close means the day's reports
  keep closing behind an invisible dialog.
- **The description must be linked, not merely rendered.** `CommandOverlay`
  sets `aria-describedby` from its own `description` prop; a caller that
  renders its own description body passes `describedById` instead. A dialog
  with a visible warning and no accessible description is an accessibility
  regression even though it looks identical.

### 3.3 Interactive states — all eight, every time

Every clickable/focusable element needs: default, hover, `:focus-visible`
(never bare `:focus` — keyboard users don't get hover), active/pressed,
disabled, loading (where applicable), error, success. `CommandButton` and
`CommandIconButton` already implement the ring-based focus-visible pattern
(`focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]`) — copy that
pattern exactly for any new interactive primitive; don't invent a second
focus treatment.

### 3.4 Status color always carries a second signal

`StatusBadge` and any status-colored UI never relies on hue alone (color
blindness, and required for high-contrast mode per §1.4) — pair color with
the status *text* (already true) and, where space allows, an icon.

## 4. Motion

Existing tokens stay canonical — don't add new durations/easings without
updating this table:

```css
--motion-fast: 120ms;   /* hover, focus, small state changes */
--motion-base: 160ms;   /* card transitions, panel reveals */
--motion-slow: 240ms;   /* page transitions */
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-emphasized: cubic-bezier(0.2, 0, 0, 1.15);
```

Respect `prefers-reduced-motion` everywhere (already global in
`globals.css`). Never animate layout properties (`width`/`height`/`top`/
`left`) — animate `transform`/`opacity`/`filter` only.

## 5. Anti-patterns — reject on sight

Pulled from the impeccable skill's audit criteria; treat these as an
automatic P1 in review:

- Decorative gradient blobs or "mesh" backgrounds on operational screens.
- `border-left`/`border-right` wider than 1px used as a colored "accent
  stripe" on a card — use a hairline border, a background tint, or a
  leading glyph instead.
- Gray text on a colored background (looks washed out — darken the same
  hue instead).
- Nested cards (a card inside a card with its own shadow/border).
- `outline: none` without a `:focus-visible` replacement.
- Gradient text, glassmorphism as a base surface (glass is an accent per
  the existing `.command-glass-accent` opt-in class, never the default card),
  emoji as section markers, or a generic purple-blue gradient hero.
- **A literal `bg-white/NN` on any surface.** It stays white on a dark page.
  The legacy `[class*="bg-white"]` override in `globals.css` looks like it
  covers this, and it does match — but it loses in the cascade, so it is not
  a safety net. Use `--surface`, `--tactical-glass` or
  `--tactical-strong-glass`, all of which flip per theme.
- **Raw Tailwind palette classes for status** (`text-emerald-700`,
  `bg-blue-500/10`, `border-red-200`…). Their dark treatment came only from
  the legacy `[class*="text-blue-700"]` overrides, which stop matching the
  moment anything about the class changes — this is what caused the
  StatusBadge dark-mode regression. Use the semantic tokens.

## 6. Accessibility floor

- WCAG AA (4.5:1 body text, 3:1 UI components) everywhere; AAA (7:1) under
  `data-contrast="high"`.
- Touch targets ≥ 44×44px — the existing `.touch-target` utility and the
  `max-width: 640px` breakpoint rule in `globals.css` already enforce this;
  don't build a new interactive element without it.
- Never disable pinch-zoom (`user-scalable=no`) or cap `maximum-scale`.

## 7. State of the rollout

**Done.** `src/` is at zero raw hex (the one exception is `themeColor` in
`app/layout.tsx`, which is browser chrome), zero `font-black`, zero
`bg-white/NN` and zero arbitrary `text-[Npx]`. All six heavy pages
(dashboard, tasks, requests, tracking, schedule, forum) plus admin,
profile, help, the auth screens and the shared panels are migrated. The
font load is trimmed to four weights. Dark mode and high contrast are
implemented and measured.

Keep it that way with four greps — any hit is a regression:

```bash
grep -rE '#[0-9A-Fa-f]{3,8}\b' src --include=*.tsx   # expect only layout.tsx themeColor
grep -r 'font-black' src --include=*.tsx             # expect none
grep -rE 'bg-white/[0-9]+' src --include=*.tsx       # expect none
grep -rE 'text-\[[0-9]+px\]' src --include=*.tsx     # expect none
```

**Still open.**

- Three hand-rolled modals that are full create/edit forms (tasks,
  schedule ×2) and the dashboard's anchored quick-create popover. The
  popover is deliberately not a centred dialog; converting it to
  `CommandOverlay` as-is would change its position and behaviour, not just
  its style.
- Two `window.confirm` calls in the forum's `requestDailyScopeTransition`.
  They sit inside `canTransitionDraft`'s synchronous control flow, which is
  covered by tests; converting them is a behavioural change, not a styling
  one.
- User-facing terminology consistency (בקשה/דרישה/פערים etc.) — a content
  problem, not a token one.
- Two `<h1>` per page: the sidebar brand wordmark and the page title both
  use `<h1>`. Fixing it means changing heading semantics, which affects
  screen-reader navigation, so it wants a deliberate decision rather than a
  drive-by edit.

**Measured contrast** (composited against real ancestor backgrounds, oklab
tints converted properly): light 5.07–6.79, dark 7.07–11.85, light+high
10.33–12.98, dark+high 8.45–16.06.

A caution for whoever verifies this next: in this app `getComputedStyle`
can return stale values for elements inside the `backdrop-filter` nav after
a runtime theme flip, and for `display:none` subtrees such as the mobile
bottom nav at desktop widths. Both produced convincing false failures.
Measure on a fresh load, at a viewport where the element is actually
rendered, and treat the screenshot as ground truth.
