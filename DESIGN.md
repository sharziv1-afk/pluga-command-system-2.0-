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
| `--color-success` / `--color-warning` / `--color-danger` / `--color-info` | Semantic status — meaning never changes per screen |
| `--focus-ring` | Keyboard focus outline |

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
personalization option sitting next to color schemes. Rules when active:
borders go from `--border-subtle` (8% alpha) to solid, opaque; text contrast
targets AAA (7:1) not just AA; status colors gain a border in addition to
fill (never rely on color alone — same reason icons always accompany
`StatusBadge` color).

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

Five sizes, ratio ~1.2, mapped to semantic roles, not raw pixel names:

| Token | Size | Line-height | Role |
|---|---|---|---|
| `--text-caption` | 0.75rem (12px) | 1.4 | Timestamps, metadata, legal |
| `--text-secondary` | 0.8125rem (13px) | 1.45 | Secondary UI, table cells, sublabels |
| `--text-body` | 0.9375rem (15px) | 1.55 | Default body/UI text |
| `--text-subheading` | 1.0625rem (17px) | 1.35 | Card titles, section headings |
| `--text-heading` | 1.375rem (22px) | 1.25 | Page titles |

(A dedicated `--text-kpi` at 1.75rem/1.15 stays for `MetricCard`'s big
numbers — the one place a 6th size earns its keep.)

Hebrew note: line-heights here run slightly looser than the Latin-web
defaults typeset.md suggests, because Hebrew glyphs have less descender/
ascender variance and benefit from a touch more breathing room at small
sizes — verified against the existing `--text-muted` (13px) usage, which
already reads comfortably at 1.45–1.5.

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

`font-black` (900) is retired from new/refactored code. It's still loaded
(seven weights, see §2.3) because 258 existing call sites use it — those
migrate page-by-page as part of the §3 token rollout, not in one blind pass.
Rewriting weight in isolation, without also checking size/color/spacing in
context, produces flattened hierarchy instead of fixed hierarchy — every
migrated screen gets a real visual check, not a find-and-replace.

### 2.3 Font loading

Rubik stays (already brand-appropriate for Hebrew, already loaded). Current
load is 7 weights × 2 subsets (hebrew+latin) ≈ 14 files. Once §2.2's rollout
retires `font-black`/900 usage app-wide, drop weight `300` and `900` from
`next/font/google`'s `weight` array in `layout.tsx` — do this only after
the grep for `font-black` returns zero, not before, or the remaining call
sites synthetic-bold and look worse than they do today.

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
is not deleted (13 call sites reference its `cyan`/`orange`/`slate` API) —
its internals now delegate to `CommandButton` under the hood so there is
exactly one styling implementation. New code always reaches for
`CommandButton` directly; `GlossyButton` is legacy-API-only.

### 3.2 Modals — one implementation

`CommandOverlay`/`CommandConfirmDialog` (`src/components/ui/CommandDialog.tsx`)
are canonical: native `<dialog>`, real focus trap, Escape-to-close, top-layer
stacking, RTL-safe, no dependency. Every `window.confirm()` call becomes a
`CommandConfirmDialog`. Every hand-rolled `fixed inset-0` modal becomes a
`CommandOverlay` (`variant="dialog"` for centered, `variant="sheet"` for a
side/bottom sheet — already used for long forms).

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

## 6. Accessibility floor

- WCAG AA (4.5:1 body text, 3:1 UI components) everywhere; AAA (7:1) under
  `data-contrast="high"`.
- Touch targets ≥ 44×44px — the existing `.touch-target` utility and the
  `max-width: 640px` breakpoint rule in `globals.css` already enforce this;
  don't build a new interactive element without it.
- Never disable pinch-zoom (`user-scalable=no`) or cap `maximum-scale`.

## 7. What's still open after this round

- `.21st/design.json` regenerated to match this file (§1, fixed the
  light/dark mismatch it previously had).
- Full weight-role migration (§2.2) happens page-by-page as each of the six
  heavy pages gets its token pass — not finished by this document alone.
- User-facing terminology consistency (בקשה/דרישה/פערים etc.) is tracked
  separately; not a visual-token concern.
