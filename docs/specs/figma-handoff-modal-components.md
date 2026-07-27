# Figma Handoff — UseCaseModal Components

**Project:** rive-site redesign · **Source of truth:** the code, as built
**Date:** 2026-07-26 · **Companion to:** `usecase-modal-system-spec.md`

---

## How to read this document

Every value below was read from the shipped component files, not from the build
spec. Where the two disagree, **the code wins and Figma should follow the code** —
see [As-built deviations](#as-built-deviations) for the full delta list.

Values are given as **semantic token names**, because that is what the Figma
components must bind to. Resolved values appear in parentheses *for reference only*
— never type a hex or px into Figma where a token exists. Dark mode is the only
shipped theme.

Token reference (dark):
`--surface-canvas` #000000 · `--surface-default` #121212 · `--surface-raised` #1D1D1D ·
`--surface-overlay` #262626 · `--text-primary` #FFFFFF · `--text-heading` #F1F1F1 ·
`--text-secondary` #AAAAAA · `--text-muted` rgba(255,255,255,.6) ·
`--text-accent` / `--accent-default` / `--focus-ring` #FFA41C ·
`--border-subtle` rgba(255,255,255,.1) · `--border-default` #262626
`--radius-sm` 4 · `--radius-md` 8 · `--radius-lg` 16 · `--radius-pill` 9999
`--space-1..32` 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128
`--font-display` Tomorrow · `--font-body` Inter · `--font-mono` JetBrains Mono
`--font-size-h1` 40 · `--font-size-h2` 24 · `--font-size-stat` 28 ·
`--font-size-eyebrow` 14 · `--font-size-body` 16 · `--font-size-body-sm` 14 ·
`--font-size-caption` 13
`--duration-base` 240ms · `--ease-standard` cubic-bezier(0.2, 0, 0, 1)

Every interactive component shares one focus treatment:
**`outline: 2px solid var(--focus-ring)` at `outline-offset: 2px`** (`:focus-visible`
only — never on mouse click). Build it as a Figma focus variant on each.

---

## 1. ModalSheet

The rising card. Bottom bleeds off-viewport — this is sheet grammar, not card
grammar, so **only the top corners round**.

| Property | Token / value |
|---|---|
| Width | `min(1120px, 100% - 2 × var(--space-6))` |
| Top offset (sliver) | `clamp(64px, 8vh, 120px)` — the receded page stays visible above |
| Min height | `calc(100vh - sliver + var(--space-24))` — always taller than the viewport |
| Surface | `--surface-default` |
| Border | 1px `--border-default` |
| Radius | `--radius-lg --radius-lg 0 0` (16 16 0 0) |
| Padding | `--space-16 --space-16 --space-24` (64 / 64 / 96) |
| Text colour | `--text-primary` |
| Internal gap | `--space-6` (24) between body blocks |

**Mobile (≤640px):** width 100%, top offset **48px** (literal), padding
`--space-6 --space-4 --space-16` (24 / 16 / 64), drag handle shown.

### Close button — `.modal-sheet__close`
Sticky at `top: var(--space-6)`, right-aligned, `z-index: 1` so it stays reachable
down a 2,600px sheet.

| State | Fill | Glyph |
|---|---|---|
| Default | `--surface-raised` | `--text-secondary` |
| Hover | `--surface-overlay` | `--accent-default` |
| Focus | as default + shared focus ring | — |

36 × 36, `--radius-pill`, no border. Glyph is a 16×16 inline SVG ✕,
`stroke-width: 1.5`, `stroke-linecap: round`. Transition
`--duration-base`/`--ease-standard` on colour and background.

### Drag handle — `.modal-sheet__handle`
Mobile only. 36 × 4, `--radius-pill`, `--border-default`, centred at
`top: var(--space-3)`. **Visual affordance only** — swipe-to-dismiss is not built.

### Type
| Element | Font | Size | Colour | Notes |
|---|---|---|---|---|
| Eyebrow | `--font-display` | `--font-size-eyebrow` | `--text-accent` | uppercase, `letter-spacing: .08em` |
| Title (H2) | `--font-display` | `clamp(--font-size-h2, 4vw, --font-size-h1)` | `--text-heading` | weight 500, line-height 1.1 |

### Scrim (behind the sheet)
Full-viewport, fixed. `background: color-mix(in srgb, var(--surface-canvas) 45%, transparent)`
plus `backdrop-filter: blur(20px)`. **`pointer-events: none`** — clicks pass through
to the overlay, which owns dismissal. In Figma: a black fill at 45% with a 20px
background blur.

---

## 2. StateRail

Pill group that is simultaneously live status readout and control. Semantics:
`role="radiogroup"` with `role="radio"` children, roving tabindex (one tab stop),
arrows/Home/End select as they move.

| Property | Token / value |
|---|---|
| Group gap | `--space-2` (8) |
| Pill padding | `--space-2 --space-4` (8 / 16) |
| Pill radius | `--radius-pill` |
| Typeface | `--font-mono`, `--font-size-caption`, **lowercase** |
| Layout | wrapped row; **column** at ≥900px (sits beside a capped square canvas) |

### Pill states — build all four as variants

| State | Fill | Border | Label |
|---|---|---|---|
| **Default** | `--surface-raised` | 1px `--border-default` | `--text-secondary` |
| **Hover** | `--surface-raised` | 1px `--text-secondary` | `--text-primary` |
| **Active** (current value) | `--surface-raised` *(unchanged)* | 1px `--accent-default` | `--accent-default` |
| **Focus** | as current state | as current state | + shared focus ring |

**Active is outline-only — deliberately not a filled amber pill.** On a dark canvas
a filled accent shouts; an outline reads as "this is the live value". Note the fill
never changes across states; only border and label colour do.

Transition: `--duration-base`/`--ease-standard` on colour and border-colour.
Labels are the file's own enum values, so they are lowercase by data, not by
transform alone.

---

## 3. CreditChip

One component, **two provenance variants**. Text is composed, not free-form:

- **Community:** `{file} · by {creator} · from the community`
- **First-party:** `{file} · by {creator}` — must **not** claim community provenance

| Property | Token / value |
|---|---|
| Typeface | `--font-mono`, `--font-size-caption` |
| Colour | `--text-secondary` → `--text-accent` on hover |
| Decoration | none (it is a link when a URL exists) |
| Focus | shared focus ring |

**Two further states to build:**
- **Linked** (has `href`) → renders as `<a>`, hover colour applies.
- **Unlinked** (no `href` yet) → renders as plain text, no hover. Never a dead `#`.

The licence string lives only in `title` + `aria-label`, never as visible copy.
For a CC-licensed community file the chip is a **legal requirement** and ships in
every state including mobile.

**Placement:** in the hero's `figcaption`, laid out
`justify-content: space-between` against the caption text, `padding-top: --space-3`.
At ≤640px the caption stacks to a column and the chip left-aligns.

---

## 4. ProofCard

| Property | Token / value |
|---|---|
| Grid | `repeat(auto-fit, minmax(240px, 1fr))`, gap `--space-4` |
| Padding | `--space-6` (24) |
| Surface | `--surface-raised` |
| Border | 1px `--border-subtle` |
| Radius | `--radius-md` (8) |
| Internal gap | `--space-2` (8) |

Stacking order inside the card is **source → stat → claim**.

| Element | Font | Size | Colour | Notes |
|---|---|---|---|---|
| Source | `--font-display` | `--font-size-eyebrow` | `--text-secondary` | uppercase, `.08em` |
| Stat | `--font-display` | `--font-size-stat` | `--text-accent` | weight 700, lh 1.1 |
| Claim | `--font-body` | `--font-size-body-sm` | `--text-primary` | lh 1.45 |

**Two variants required:**
- **Without `href`** — source is a `<span>`, inert.
- **With `href`** — source becomes a link with a trailing ` →`, hover
  `--text-accent`, shared focus ring. Used only where a real public artifact
  exists; it is evidence, not decoration.

Stat is optional and independent of `href`.

### Pull quote (same component family)
`padding-left: --space-6`, `border-left: 2px solid var(--accent-default)`.
Quote text `--font-display` at `--font-size-h2`, lh 1.25, `--text-heading`;
attribution `--font-body` at `--font-size-body-sm`, `--text-secondary`, separated
by `--space-3`. Reel-to-quote gap is `--space-8` (32).

---

## 5. BentoCell — Campaigns (retitled)

Base cell is the existing `BentoCell` component; this documents the **expanding**
variant and the current Campaigns copy.

**Copy as shipped:**
- Eyebrow `CAMPAIGNS` · Title **"Wrapped moments, made personal"**
- Description **"Interactive year-in-review campaigns, personalized for millions."**
- Size `wide`, `grid-column: 1 / -1`, `grid-row: 3`

| Base cell | Token / value |
|---|---|
| Surface | `--surface-default` → `--surface-raised` on hover |
| Border | 1px `--border-subtle` → `--border-default` on hover |
| Radius | `--radius-lg` (16) |
| Padding | `--space-4` (16), gap `--space-3` |
| Eyebrow | `--font-display`, `--font-size-eyebrow`, `--text-accent`, uppercase `.08em` |
| Title | `--font-display`, 20px (24px when `size=large`), lh 1.15, `--text-heading` |
| Description | `--font-body`, `--font-size-body-sm`, `--text-secondary`, lh 1.4 |

### Expand affordance — `+` (cells that open a modal)
| Property | Token / value |
|---|---|
| Size | 32 × 32, `--radius-pill` |
| Position | absolute, `right/bottom: var(--space-4)` |
| Default | `--surface-raised` fill, `--text-secondary` glyph |
| Hover (cell) | `--surface-overlay` fill, `--accent-default` glyph |
| Glyph | `+`, `--font-body` at `--font-size-body`, lh 1 |

The `→` arrow of the navigating variant is **removed** on expanding cells — the `+`
replaces it, because an arrow reads as "leaves the page". The whole cell is the hit
target; the `+` is a signpost. A visually-hidden `— Explore {name}` string is
appended inside the cell so the affordance joins the accessible name instead of
replacing the visible title (WCAG 2.5.3). Nothing to draw in Figma, but do not add
an `aria-label` in its place.

---

## 6. Motion — final tuned values

The signature is **two-speed**: the scrim snaps while the sheet glides. Exits are
always faster than entrances, and the sheet leads the scrim out.

| Track | Property | Duration | Easing |
|---|---|---|---|
| **Scrim in** | opacity 0 → 1 | **250ms** | `ease-out` |
| **Sheet in** | translateY **6vh** → 0 | **800ms** | **`cubic-bezier(0.22, 1, 0.36, 1)`** (easeOutQuint) |
| **Sheet in** | opacity 0 → 1 | **200ms** | `ease-out` |
| **Sheet out** | opacity → 0, translateY 0 → **4vh** | **240ms** | `ease-in` |
| **Scrim out** | opacity → 0 | **240ms**, delayed **60ms** | `ease-out` |
| **Reduced motion** | crossfade both, no travel | **150ms** | `ease` |

Supporting values: scrim opacity **0.45**, scrim blur **20px**, sliver
`clamp(64px, 8vh, 120px)`.

Behavioural dials (no Figma equivalent, listed for completeness): ghost idle delay
**6000ms**, hover preload delay **300ms**, state dwell **3500ms**, cycle resume
delay **8000ms**.

All of these are live DialKit controls — see `useModalDials.ts`. The numbers above
are the baked defaults after tuning.

### Rules the motion must keep
1. **Two-speed or it is not this modal.** Fast scrim against slow sheet is the feel;
   matching their durations flattens it.
2. **Exits beat entrances.** 240ms out against 800ms in.
3. **Reduced motion crossfades** — it never slides, and the blur jump-cuts rather
   than animating.
4. **A hint never promises what a paused machine cannot deliver.** Static
   invitations are gated on the state machine actually running.

---

## As-built deviations

Follow this column, not the build spec. Each was a deliberate decision made while
building; the spec text was not always retrofitted.

| # | Spec said | As built | Why |
|---|---|---|---|
| 1 | Sheet radius **20px** | **`--radius-lg` (16px)** | No 20px radius token exists. Token discipline outranks the spec's raw px. Add a `--radius-xl` in Figma first if 20 is wanted. |
| 2 | Mobile padding **20px** side | **`--space-4` (16px)** | Same reason — nearest token. |
| 3 | Sheet travel **6% / 4%** | **6vh / 4vh** | CSS `translateY(%)` resolves against the *element's* height, and the sheet is taller than the viewport — so `%` made the dial lie. `vh` matches the documented "% of viewport" intent. |
| 4 | Surfaces named `--surface-1/2/3` | `--surface-default` / `--surface-raised` / `--border-default` | Mapped by exact hex to the real semantic token names. |
| 5 | Scrim `rgba(0,0,0,0.45)` | `color-mix(in srgb, var(--surface-canvas) 45%, transparent)` | Keeps the colour token-tracked; only the alpha is a dial. |
| 6 | `sheet-in-duration` + `sheet-in-ease` as two dials | **one DialKit transition control** | It *is* the bezier editor the spec asked for, with a live curve preview, and it bundles the duration. |
| 7 | Pull quote is "Game UI only" | Also on **Campaigns** | There the founder quote is the anchor proof, not a garnish. Other lite modals still carry none. |
| 8 | Hero slot always present | **Optional** | Campaigns is designed heroless — claim → proof → CTA. `type: "pending"` is now strictly the missing-asset fallback, not a content state. |
| 9 | Hero container has a surface | **Chrome-free while the canvas is live** | The artwork's own background is its body; a panel behind it read as a second, competing panel. The surface box is scoped to the fallback state, which needs something to sit its label on. |
| 10 | Ghost cursor on community heroes | **Only Health Bar** | The ghost is hover-only. Automotive and the reticle are click-gated, and the reticle already tracks the pointer — a second synthetic cursor would collide with it. |
| 11 | Tier 2 = "one proof visual" | Four of five Tier 2 modals run a **live .riv** | The spec's own "lightweight .riv if one exists" clause kept paying off. |

---

## Build order for the Figma sync

1. Bind or confirm the Semantic variables used above exist in the `Rive-ReDesign`
   file (fileKey `7IP95CwE2b9sYNvHzG3O1b`).
2. Build **CreditChip** and **ProofCard** first — smallest, and they prove the
   token bindings.
3. **StateRail** next: one pill component with the four states, then the group.
4. **ModalSheet** last: it composes the others and needs the scrim behind it.
5. Update **BentoCell** with the `+` expand variant and the new Campaigns copy.
6. Annotate the motion table on a canvas card — it is not drawable, and the house
   rule requires non-drawable motion to be documented as an annotation.
