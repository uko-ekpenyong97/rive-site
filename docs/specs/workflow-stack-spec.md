# WorkflowStack — sticky card stack + Loop canvas

The "How Rive works" section: five sticky cards that stack like paper on the
left, and one persistent Rive canvas on the right whose beat is driven by which
card currently owns the pin.

This document exists for its **Decision log**. The mechanic's geometry has now
been through three rounds of owner feedback, and several of the decisions look
arbitrary — or look like something a later reader would "simplify" — unless the
measurement behind them is written down next to them.

Components: `src/components/WorkflowStack.tsx`, `WorkflowStack.css`,
`LoopCanvas.tsx`. Guard: `npm run check:stack`.

> `LoopCanvas.tsx:50` refers to a "loop spec §7" that has never existed in
> `docs/specs/`. Recorded here rather than silently left; the dials it points at
> are the `CONFIG` block at the top of that file.

---

## The geometry, as built

| variable | value | derivation |
| --- | --- | --- |
| `--workflow-card-height` | `252px` | band 54 + gap 24 + card 4's 135.6 copy + 32 bottom + 4.4 slack |
| `--stack-stagger` | `54px` | 21px eyebrow line-height + 2 × 16.5px breathing |
| `--workflow-canvas-size` | `468px` | `4 * stagger + card height` — the beat-5 composition |
| `--stack-pin-top` | `max(96px, (100vh - canvas) / 2)` | centres the composition; 96px floor clears the nav |
| `--stack-dwell` | `660px` | scroll distance per beat |
| `--stack-scrub` | `1140px` | card 5's approach = beat-4's 0→100 progress zone |
| `--stack-travel` | `calc(dwell - height)` | **derived** |
| `--stack-travel-bind` | `calc(scrub - height)` | **derived** |

All are dials on `.workflow-stack`. Changing the stagger or the height
re-derives the canvas and both travels; nothing needs hand-syncing.

---

## Decision log

- **The tail is an ELEMENT, not padding, and not a margin** (2026-08-02). The
  column carries one dwell of empty space after card 5 so the final beat holds
  as long as the other four. How that space is created is not a style choice —
  two of the three ways to write it are silently broken, and both were measured:
  - **`padding-bottom` on the column** grows its BORDER box. The canvas lives in
    a sibling grid item sized by the row, so the canvas's sticky range *did*
    extend and the fix looked like it worked. But `position: sticky` is bounded
    by the containing block's **content** box, which padding sits outside of, so
    card 5's own range stayed zero-length: it reached its pin and travelled
    straight past, leaving the active card sliding away under a pinned canvas.
  - **`margin-bottom` on the last card** fails differently: a sticky element's
    constraint applies to its **margin** box, so the margin travels with the
    card and the range is still zero. Measured — and it also reintroduced the
    canvas crop.
  - **A sibling `<div class="workflow-stack__tail">`** occupies the content box.
    Card 5 gets a real 660px range; the column's border box is unchanged, so the
    canvas's range is unchanged too. All five cards now stick.
  - **Do not "simplify" this back to padding.** It will look identical, pass a
    screenshot, and quietly remove the last beat.
  - **Knock-on that nearly shipped:** adding the tail made it the column's last
    child, so `.workflow-stack__card:last-child` stopped matching card 5 and the
    scrub zone collapsed from 1140px to 660px with nothing visibly wrong. The
    selector is `:last-of-type` — the cards are the only `<article>`s.

- **The stagger IS the band height** (2026-08-02). The band is the strip left
  visible when the next card covers this one, so the two cannot be tuned
  separately: any stagger below the label's 21px line box slices the label
  mid-glyph. `check:stack` asserts `band === stagger` and that every label's box
  ends inside the strip. Mobile inherits rather than keeping its old 16px, for
  the same reason.

- **Top-aligned copy, height sized to the tallest card** (2026-08-02). Centring
  put each card's text at a different distance from the top, because the copy
  blocks differ by up to 48px. Top-aligning fixes the start (79px in all five,
  0.00px spread) and sends the variance to the bottom edge — so the height is
  then sized to card 4 rather than to the middle of the range, or the shortest
  card reads hollow. The two goals genuinely pull against each other; 252px is
  the setting that serves both.

- **The pin is centred, not fixed at 96px** (2026-08-02). Both columns pin from
  `--stack-pin-top`, so canvas and cards cannot drift apart — the alignment is
  structural rather than maintained. Measured: 166px at 800px tall, 266px at
  1000px, composition symmetric in the viewport at both. The floor engages below
  660px of height. **Below ~564px tall** the canvas `max-height` cap starts
  shrinking the canvas and the composition match no longer holds; that boundary
  is documented in `check:stack` rather than guarded, because shrinking is the
  right behaviour there.

- **Cadence is expressed as dwell and scrub, travel is derived** (2026-08-01).
  Card height and flow gap both feed the scroll distance between beats. Shrinking
  the card with travel written as a literal cut the dwell by 20% and nothing on
  screen said so. Stating the invariant and deriving the number means dialling
  the height re-preserves the pacing by construction. Pin position does **not**
  affect cadence — it moves where a card sticks, not the distance between one
  sticking and the next.

- **What `check:stack` had wrong, twice** (2026-08-02). Recorded because both
  errors were in the *measurement*, and both were the quiet kind:
  - The expected reach-to-reach distance is `dwell − stagger`, not `dwell` —
    each card pins one stagger lower, so it meets its own pin line that much
    earlier. At stagger 24 the 36px error hid inside a 41px sampling tolerance
    and passed; raising the stagger to 44 exposed it.
  - "Cropped" and "gap" were both measuring normal layout. Background between a
    pinned card and the next one still climbing is what the section looks like at
    rest; a canvas partly off-screen during entry or exit is what any element
    does. Both now assert the invariant that actually holds — stack **order** at
    the boundary, and the canvas whole **while pinned**.
