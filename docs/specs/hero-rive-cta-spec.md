# Hero + Rive CTA System — Build Spec

**Project:** rive-site redesign · **Section:** Hero, Nav CTA
**Date:** 2026-07-31 · **Status:** Built

---

## 1. Purpose

Rebuild the hero around **Rive's own animated CTA buttons**, carried forward from
the live rive.app. Those buttons are the strongest brand continuity the redesign
has: they are what rive.app *feels* like, and they are made of the product, which
is the same argument the modal heroes make (`usecase-modal-system-spec.md` §1).

This is a deliberate reuse of Rive's assets, recorded in the Decision log below
rather than imported silently.

---

## 2. What was there before

There was **no `Hero` component**. The hero was inline JSX in `src/pages/Home.tsx`
plus `.hero*` rules in `Home.css`: a two-column layout with a copy column and a
620px `DemoSlot` placeholder. Rebuilding meant extracting a component, not
editing one.

---

## 3. The overflow-canvas pattern

The live site's signature move, and the reason these buttons read as Rive rather
than as a CSS hover: **the canvas is far larger than the button**.

| | Artboard | Button | Anchor | Overflow |
|---|---|---|---|---|
| Cat (nav) | 269×150 | 109×40 | `anchorY 0.2` | hangs **below**, out of the nav bar |
| Rocket (hero) | 500×500 | 109×40 | `anchorY 0.78` | **rides above** the CTA row |

- The **button is ordinary content in normal flow and it defines the layout**,
  full stop.
- The **canvas is absolutely positioned** and aimed at the button by the asset's
  anchor — `anchorX/anchorY` is where the button's centre sits inside the canvas
  box, so the art hangs wherever the file wants it.
- **There is no reserved space anywhere, by design.** An absolutely positioned
  element cannot cause layout shift, so reserving room for it only ever buys
  dead space. An earlier version reserved 210px above and below the CTA row and
  made the hero **1044px against a 620px pre-Rive baseline — 68% taller, all of
  it empty**. Removing every trace of it lands at 648px (**+4.5%**).
- Pointer events land on the button; the canvas is inert (`pointer-events: none`)
  for every asset currently shipped.

### Layering against DotField

`DotField` is `position: fixed; inset: 0; z-index: 0; pointer-events: none`, and
`.home` content sits at `z-index: 1`. DotField already opts out of pointer
events, so it cannot fight the hero. The hazard runs the **other way**: a 500×500
transparent canvas over the hero would swallow hovers meant for the dot field and
block text selection. `pointer-events: none` on the canvas layer is what prevents
that, and it is load-bearing, not decorative.

```
.dot-field         z 0   pointer-events: none   fixed, full viewport
.home .container   z 1
  .rive-button           position: relative     hitbox, pointer-events: auto
    .rive-button__canvas position: absolute     pointer-events: none, z 0
    .rive-button__label                         z 1
```

`.nav__cta` takes `z-index: 2` so the cat paints over neighbouring nav items.

---

## 4. Confirmed asset maps

Every map was resolved from the **committed bytes** via `npm run probe:riv`, which
was extended in this build to enumerate state-machine inputs. Full source map and
the maps themselves live in `src/components/riveSiteAssets.ts`, beside the data.

| File | Artboard | SM | Inputs | `hasListeners` | Model |
|---|---|---|---|---|---|
| `get-started-cat.riv` 12,747 B | `Cat` 269×150 | `Motion` | 5 bool | **false** | manual |
| `get-started-rocket.riv` 45,161 B | `Button` 500×500 | `Motion` | 1 bool `isHover` | **true** | manual (listeners inert) |
| `r-logo-shuffle.riv` 3,089 B | `R_logo_shuffle` 120×120 | `State Machine 1` | **none** | false | none |

### The pointer model is measured, and shape names lie about it

`get-started-cat.riv` contains shapes literally named `Hitbox_left`,
`Hitbox_right`, `Hitbox_left2`, `Hitbox_right2` — and carries **no listeners**.
`get-started-rocket.riv` contains no hitbox-named shape and **does** carry them.
Reading the names gets both files backwards.

`hasListeners` turns out to be **necessary but not sufficient**. The rocket
reports listeners that never fire. Measured A/B, same build, only the model
changed — non-transparent pixels on the 500×500 canvas, 5 trials of 10 frames:

| model | idle | hovered | Δ |
|---|---|---|---|
| `listeners` | 577 ±11.4 | 584 | **7** — inside the noise floor |
| `manual` | 577 ±11.5 | **3405 ±3.4** | **2828** |

The canvas was confirmed hit-testable in both cases (`pointer-events: auto`,
`elementFromPoint` returns the canvas) and driven with real CDP mouse input
rather than JS-dispatched events, so this was not a plumbing failure on our
side. The rocket is therefore wired manually, with `listenersInert: true`
recorded so `check:assets` can tell a measured override from a mis-wiring.

### The cat's zones are nested, not exclusive

`isHoverLeft2` is the **extreme** lean and only fires while `isHoverLeft` is also
set — the "2" inputs escalate the plain ones rather than replacing them. Pixel
delta vs idle by pointer position across the button:

| x | 0.05 | 0.15 | 0.30 | 0.50 | 0.70 | 0.85 | 0.95 |
|---|---|---|---|---|---|---|---|
| exclusive | 0 | 0 | 13 | 0 | 10 | 0 | 0 |
| **nested** | **152** | **172** | 19 | 0 | 14 | **176** | **167** |

With exclusive zones, three of five inputs rendered *literally the same frame as
idle* (sd 0.000): the cat leaned two ways instead of four and the extremes never
appeared. `isHovercenter` measures as no change either way, which is correct
rather than dead — centre is the neutral forward pose.

**Two things the pre-probe recon got wrong**, and why the probe rule exists:

1. The rocket was expected to carry `Smoke`/`NoSmoke` inputs. Those are
   **timelines**, not inputs — the file's own response to `isHover`. Wiring them
   would have meant inventing inputs that do not exist.
2. `r-logo-shuffle.riv` has **no inputs and no embedded text**. It is an
   autonomous 3s loop, so its DOWNLOADS label must be DOM-rendered — unlike both
   GET STARTED files, which embed Tomorrow and paint their own label.

`isHovercenter` is spelled with a **lowercase c** in the file. Kept faithfully,
the same as the `Recticle` artboard in `useCaseContent.ts`.

### Runtime

- Live site: `@rive-app/canvas@2.27.5` (CPU/Canvas2D).
- Ours: `@rive-app/react-webgl2@4.30.0` → `@rive-app/webgl2@2.39.1` (GPU).
  There is no `@rive-app/react-canvas` in this repo.
- All three files probed and load cleanly under 2.39.1.

---

## 5. LCP: DOM-first, canvas-enhances

**`rive.wasm` is 2.41 MB — roughly 35× the three .riv files combined**, and it is
fetched at runtime from `https://unpkg.com/@rive-app/webgl2@2.39.1/rive.wasm`
(jsdelivr fallback). It is not bundled and not self-hosted.

The .riv weight was never the interesting number. Before this build the runtime
was only used below the fold (LoopCanvas, AudienceGlyph, the modal heroes), so
the wasm downloaded after LCP. Putting Rive in the hero and the nav would
otherwise promote it onto the critical path.

So the button is **DOM-first**:

1. It renders as a fully working DOM button/link with a visible label.
2. The canvas mounts immediately (it must — see the deadlock below) but is
   `opacity: 0` until the file loads.
3. Only once the runtime resolves does the DOM label yield and the button chrome
   go transparent.

First paint never waits on wasm, and a failed load is the same code path as a
slow one.

**The label yields via `color: transparent`, not the visually-hidden clip
pattern.** The clip pattern takes the text out of flow, which collapsed the
button from ~118px to ~33px the moment the canvas went live — the hitbox shrank
away from the art, and the collapse was itself a post-load layout shift.
`visibility: hidden` would preserve the box but remove the element from the
accessibility tree, which is the one thing the label is for.

The DOM label is **never removed**, because both GET STARTED files paint their
text inside the artboard where no assistive technology can read it (WCAG 2.5.3
Label in Name).

---

## 6. Reduced motion

`prefers-reduced-motion` mounts **no canvas at all** and never requests the .riv.

This deviates from the original brief, which asked for a paused first-frame
render. The probe is what changed it: both CTA files paint "GET STARTED" into the
artboard, and the DOM label must stay visible in this state — so a static canvas
would show the same words twice. Rendering the plain DOM button satisfies both
"the button stays fully functional" and "the DOM label stays", and it matches how
`TileVideo` handles the same preference (an `<img>`, not a paused `<video>`).

---

## 7. Copy

Hybrid, decided in review. Ours leads with what the product does and what it has
reached; the live site's "THE INTERACTIVE EXPERIENCE ENGINE" asserts a category
with nothing behind it. What the live site does better is typographic, so those
two slots were carried over.

| Slot | Source | Value |
|---|---|---|
| Wordmark | live site | `RIVE`, letterspaced in CSS |
| Headline | ours | Interactive graphics that ship straight to production |
| Sub | ours | Design, animate, and code in one tool — … |
| Proof line | ours | From a single button to two billion users. |
| CTA row | live site | GET STARTED (rocket) · DOWNLOADS (R logo) |
| Status line | live site | `SCRIPTING IS LIVE` — a **prop**, it is a ticker not copy |

The wordmark is letterspaced with CSS on the string `RIVE`, not written as
`R I V E`, which would be announced letter by letter.

**Dropped:** the old eyebrow, "BEHIND SPOTIFY WRAPPED, DUOLINGO, AND LINKEDIN".
The agreed six-element stack has no slot for it, and `LogoMarquee` sits directly
below the hero carrying that proof visually.

---

## 8. Entrance cascade

Re-indexed for the new order. Nav stays 0 and lives outside `.hero`; the shared
knobs and keyframes stay in `Home.css` because Nav uses them.

`1` wordmark · `2` headline · `3` sub · `4` proof line · `5` CTA row · `6` status

The old order ended at 6 with the DemoSlot. `hero-enter-demo`, the scale-variant
keyframe written for it, is deleted. A test asserts the indices are exactly
`[1,2,3,4,5,6]`, so a duplicate or gap cannot silently break the cascade.

---

## 9. Verification

- `npm run check:assets` — **extended to cover `public/rive/site/`**, which it
  could not see before: these are literal public paths, not `?url` imports, so
  the existing import parser was blind to them. It now also checks **input-name
  parity**, and a dead-asset rule for the new directory.
- `heroRiveCta.test.tsx` — 33 tests: structure, label handoff both ways, reduced
  motion, zone routing against real pointer events, committed-byte parity,
  public-path (no bundle hash), accessibility.
- Browser pass at 1280/1440/1680 on SwiftShader.

---

## Decision log

- **Rive's own CTA animations carried forward** (2026-07-31). Three files lifted
  from the live rive.app into `public/rive/site/`, referenced by literal path and
  never imported, so their bytes cannot reach a JS chunk. Origin URLs and content
  descriptions are in `src/components/riveSiteAssets.ts`. This is deliberate
  brand continuity, and the reason it is a log entry rather than a quiet import:
  reusing a company's own brand animations in a redesign of their site is a
  decision, and it should be visible as one.

- **The probe rule paid for itself again.** Pre-probe recon of the binaries
  suggested the rocket carried `Smoke`/`NoSmoke` inputs; the probe found they are
  timelines and that `isHover` is the entire integration surface. It also found
  `r-logo-shuffle.riv` has no inputs and no embedded text, which changed its
  integration from "hover-driven button mark" to "autonomous loop with a
  DOM-rendered label". Neither would have been caught by anything else in the
  build. `probe:riv` was extended to report inputs, and `check:assets` now
  asserts them — verified by deliberately renaming `isHovercenter` to
  `isHoverCenter`, the plausible "fix", and confirming CI fails with the file's
  real contents printed.

- **`site-icons.riv` deliberately NOT committed.** Nothing in this build has a
  home for it. Its origin URL and full 11-artboard inventory are recorded in
  `riveSiteAssets.ts` so re-fetching needs no archaeology. Two reasons it would
  need care if ever wired: eleven artboards in one file runs against CLAUDE.md's
  one-artboard-per-file rule (a missing artboard inside a shared file is
  invisible; a missing file 404s), and **`renderIcon`'s state machine is itself
  named `editorIcon`**, colliding with the real `editorIcon` artboard's machine —
  any lookup keyed on state-machine name resolves the wrong artboard.

- **DemoSlot reservation RETIRED, not deferred.** The 620px hero demo placeholder
  is gone. The layout is now a centred single column with no side column for an
  artifact to live in, and the how-it-works weight belongs to `WorkflowStack`
  immediately below — the CTAs are the hero demo. Any future hero artifact is a
  fresh decision against this layout, not the resumption of a held slot. The
  `DemoSlot` component file is left in place but now has **zero consumers**; the
  only other reference is a negative assertion in `caseStudies.test.tsx`.

- **A deadlock that a browser caught and the unit tests did not.** The first
  version rendered `RiveComponent` only once `rive` was non-null. But `useRive`
  attaches the runtime *after* its canvas is in the document, so `rive` never
  resolved, the .riv was never requested, and all three buttons sat in their DOM
  fallback — which looks exactly like a deliberate DOM-first choice. Nothing in
  the typecheck, the 556 tests, or the build could see it; the failure mode was a
  correct-looking page. `mountCanvas` (put the canvas in the document) and
  `canvasLive` (the file is painting) are now two distinct states, and a
  regression test pins that the canvas mounts *before* the runtime resolves.

- **The reservation was the bug, and it was mine.** An earlier pass read
  "reserve the overflow space" as a layout requirement and gave the CTA row
  210px of margin above and below. Absolutely positioned canvases cannot shift
  layout, so all of it was dead: the hero measured 1044px against a 620px
  pre-Rive baseline. Removing every trace lands at **648px, +4.5%**, with the
  art free to overflow because overflow was never the thing that needed room.
  A test now fails if `--rocket-clearance` reappears.

- **`hasListeners` is necessary but not sufficient — verified by A/B.** The
  rocket reports listeners that never fire; driving it manually changes 2828
  pixels where the listeners model changed 7 against a noise floor of 11. Both
  states were confirmed hit-testable with real browser input first, so this is a
  fact about the file rather than about our plumbing. `check:assets` now permits
  a `manual` model on a listeners-carrying file **only** when
  `listenersInert: true` says so out loud; claiming `listeners` on a file that
  has none stays an unconditional failure, because that direction wires up
  nothing at all.

- **The checker read its own comment as configuration.** While adding the
  pointer-model parity check, the parser matched `pointer: "listeners"` from an
  explanatory A/B table inside a comment block rather than the real
  `pointer: "manual"` below it — and reported the wrong model as verified.
  Comments are stripped before parsing now. Worth recording because it is the
  exact failure this script's header warns about: a checker that agrees with
  prose instead of code.

- **Pre-existing, NOT introduced here:** at exactly 1280px the page overflows
  horizontally by 10px, caused by `.experts-strip__card`. Confirmed unrelated —
  `ExpertsStrip` is untouched by this diff, no hero or `rive-button` element is
  ever an unclipped overflower at any tested width, and at 1440/1680 the page has
  zero horizontal overflow. Logged as a follow-up.

- **The wasm is the real weight, and it is third-party.** 2.41 MB from unpkg at
  runtime, with a jsdelivr fallback — not bundled, not self-hosted. Already true
  before this build, but the hero is the first place a visitor waits on it.
  DOM-first means they wait on nothing. Self-hosting it (`RuntimeLoader` supports
  a custom URL) would remove a third-party CDN from the path and is logged as a
  follow-up.
