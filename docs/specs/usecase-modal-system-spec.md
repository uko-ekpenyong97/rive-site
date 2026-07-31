# UseCaseBento Modal System — Build Spec

**Project:** rive-site redesign · **Section:** UseCaseBento ("Where Rive runs")
**Date:** 2026-07-24 · **Status:** Locked (content approach, presentation, scope confirmed)

---

## 1. Purpose

Replace the current seven-outbound-links pattern (live rive.app: seven use-case cards immediately after the hero, every one a navigation off the homepage) with an on-page depth system. The visitor never leaves the conversion spine. The answer to "tell me more" is a sheet, not a page load.

**Thesis alignment:** the site is made of the product. Each modal's hero slot holds a **live, credited, community-made .riv** — not a video. Videos of interactivity are the After Effects worldview; Rive's differentiation is motion you touch, and the modal open is the highest-intent moment on the homepage. Video and photography remain the medium for outcome-at-scale proof and live exclusively in the CaseStudies section (Spotify Wrapped, LinkedIn, Duolingo — high-production content, reach stories, honest as video).

**Katie Dill constraints honored:** lean-back browse (content revealed, never hidden behind ambiguous chrome), every animation tied to a message, homepage-as-manifesto.

---

## 2. Reference findings (measured live, 2026-07-24)

### Stripe homepage bento dialog (`hds-dialog bento-dialog`)
| Property | Measured value |
|---|---|
| Card max-width | 1184px |
| Card radius | 16px |
| Card padding | 72px 72px 112px |
| Card entrance | `transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)` (easeOutQuint, slide up) |
| Scrim | `rgba(229, 237, 245, 0.9)` — opaque tinted veil, **no blur** |
| Scrim timing | `opacity 0.25s, background-color 0.25s` |
| Scroll lock | `html { overflow: hidden }` |
| Scroller | **the overlay itself** (`overflow-y: auto`) — wheel anywhere scrolls the modal |
| Measured dialog height | 2,637px — a mini landing page, not a tooltip |
| Content anatomy | claim → product visual → feature/spec cards → case study quote → final CTA |
| Dismissal | quiet X (`aria-label="Close dialog"`), Escape; page scroll position preserved exactly |

**The two-speed signature:** scrim snaps in fast (0.25s) while the card glides slow (0.8s). This contrast is the feel.

### Apple iPhone 17 Pro compare sheet ("+ Compare iPhone design")
| Property | Observed / measured |
|---|---|
| Trigger | "+" pill with explicit label |
| Presentation | bottom sheet rising; rounded top corners; **persistent sliver of dimmed page above** |
| Scrim recipe (Apple house curtain, measured on nav) | `rgba(0, 0, 0, 0.4)` + `backdrop-filter: blur(20px)` |
| Motion | fast attack, decelerate, settles ~0.5–0.7s (frame-bracketed) |
| Dismissal | circular quiet X; also closes on focus loss (rejected for our build — too twitchy) |
| Gesture policy | opens only on trusted user gestures |

**The grammar lesson:** the sliver keeps the homepage visibly *there* behind the glass. Recede, don't replace.

### Synthesis
Stripe's content architecture + scroll mechanics, inside Apple's presentation grammar, on Rive's dark canvas. Stripe's opaque tinted scrim only works on light themes; on `#000` the scrim needs blur to read as depth → Apple's recipe wins for the backdrop.

---

## 3. Component architecture

```
UseCaseBento/
├── BentoCell.tsx            (existing — gains expand affordance)
├── UseCaseModal/
│   ├── ModalRoot.tsx        (portal, scrim, scroll lock, focus trap, URL state)
│   ├── ModalSheet.tsx       (the rising card; overlay-as-scroller)
│   ├── ModalHero.tsx        (live .riv slot + ghost-cursor invitation + credit chip)
│   ├── ProofReel.tsx        (customer proof cards: claim + one stat each)
│   ├── CommunityStrip.tsx   (marketplace file thumbnails, credited, linked)
│   ├── RuntimeChips.tsx     (platform coverage row per use case)
│   └── ModalCTA.tsx         (Get started + use-case page link as escape valve)
└── useCaseContent.ts        (content model — all copy/media/stats as data)
```

### Trigger (BentoCell)
- Expand affordance: `+` glyph in a 32px quiet circle, bottom-right of cell, `--surface-2` fill, `--text-secondary` glyph; brightens to amber `#FFA41C` glyph on cell hover. Labeled: `aria-label="Explore {useCase}"`.
- Entire cell is clickable (the `+` is a signpost, not the only target). Cursor: pointer on whole cell.
- Cell click ≠ navigation. Navigation to the full use-case page exists only *inside* the modal (escape valve in ModalCTA) — the old pages keep their SEO life; the homepage stops leaking through them.

### Sheet geometry (dark-theme token mapping)
| Slot | Value |
|---|---|
| Sheet surface | `--surface-1` (#121212), border 1px `--surface-3` (#262626) top edge |
| Max width | 1120px (aligns to bento container grid, one step inside Stripe's 1184) |
| Radius | 20px top corners only (bottom bleeds off-viewport — sheet grammar, not card grammar) |
| Top sliver | sheet top edge sits at `clamp(64px, 8vh, 120px)` from viewport top |
| Padding | 64px 64px 96px desktop · 24px 20px 64px mobile |
| Close | 36px circular quiet button, top-right inside sheet, `--surface-2` fill, × glyph; Escape equivalent |
| Mobile | full-width sheet, top sliver 48px, drag-handle bar rendered (visual affordance; swipe-down dismiss is a v2 nicety, not v1 scope) |

### Scrim
- `background: rgba(0, 0, 0, 0.45)` + `backdrop-filter: blur(20px)`.
- The DotField and homepage content stay mounted and visible-but-receded behind it — the "you haven't left" cue. Pause DotField's rAF loop while modal is open (idle-correctness rule; no work for invisible pixels).
- Scrim click dismisses.

### Motion (initial values — all DialKit dials, §6)
| Track | Value |
|---|---|
| Scrim in | opacity 0 → 1, 250ms ease-out |
| Sheet in | translateY(6%) → 0, **800ms cubic-bezier(0.22, 1, 0.36, 1)**; opacity 0 → 1 over first 200ms |
| Sheet out | translateY 0 → 4%, opacity → 0, 240ms ease-in (exits always faster than entrances) |
| Scrim out | opacity → 0, 240ms ease-out, slight delay (~60ms) so the sheet leads |
| Cell handoff | v1: none (sheet rises independently). v2 candidate: FLIP morph from cell rect → sheet rect (we have FLIP experience from the portfolio grid; taste decision T3) |
| Reduced motion | `prefers-reduced-motion`: replace slides with 150ms crossfade; kill blur transition (jump-cut the blur); ghost cursor never autoplays |

### Scroll + state mechanics
- On open: lock `html { overflow: hidden }`; overlay is the scroller (`overflow-y: auto; overscroll-behavior: contain`). Wheel anywhere scrolls the sheet. Sheet taller than viewport by design — mini landing page.
- On close: restore scroll position exactly (it never moved — the lock guarantees it). Focus returns to the triggering cell.
- Focus trap while open; `role="dialog" aria-modal="true"`, labeled by the modal H2.
- **Deep-linkable:** open state mirrors to `?explore=game-ui` via `history.replaceState` (no navigation event). On load with the param present, open the modal after hero settle (~600ms delay). Share a use case without leaving-the-homepage ever being violated — even the URL stays home.
- No focus-loss dismissal (explicitly rejecting Apple's behavior).

---

## 4. Content model + tiers

### Tier 1 — full modals: **Product UI**, **Game UI** (bento anchor + second, per data hierarchy)

Anatomy (top → bottom):
1. **Eyebrow + claim.** Tomorrow display face. e.g. Game UI: "Menus, HUDs, and 2D graphics — running, not rendered."
2. **ModalHero — live credited .riv.** Marketplace embed, interactive immediately. Ghost-cursor invitation (inherits the Loop spec's ghost grammar: chrome-colored cursor demonstrates one interaction on a 6s idle loop, yields instantly to real pointer). Credit chip bottom-right of canvas: `{filename} · by {creator} · from the community` → links to the marketplace page. The credit is load-bearing: live + community-made = interactivity proof and social proof in one artifact.
3. **ProofReel.** 2–3 cards, each = logo + one-sentence claim + one stat. Text-first, small static imagery allowed, **no video** (video belongs to CaseStudies).
4. **Pull quote** (Game UI only): Pocketwatch CTO — "If you enjoy making games and don't hate yourself, use Rive." — Joseph Riedel, CTO, Pocketwatch Games.
5. **CommunityStrip.** 4–6 marketplace thumbnails, credited, linking to marketplace (marketplace links are acceptable exits — that's conversion-adjacent, not bounce).
6. **RuntimeChips.** Game UI: Unity · Unreal · Defold · Custom engines. Product UI: iOS · Android · Flutter · React Native · Web · Framer · Webflow.
7. **ModalCTA.** Primary: "Get started" (editor). Secondary quiet link: "Everything about {use case} →" (the old page — the escape valve, deliberately last).

**Game UI candidate heroes** (existing community files, verified on rive.app/game-ui): Health Bar (hover to damage — instantly legible), Ability Wheel (Zelda TotK style), Sophia III HUD, Game HUD/Scope. *Recommend Health Bar: one-glance comprehension, one-hover payoff.*

**Product UI candidate heroes:** an interactive toggle/button set, pull-to-refresh (drag payoff), or a cursor-tracking character. *Note: Notion's Nosey appears in Rive's own proof wall — a cursor-tracking character hero here would be a quiet portfolio signature. Taste decision T1.*

**Proof content mapping (from rive.app research):**
- Product UI reel: Notion (assistant built entirely in Rive · doubled engagement) · Duolingo (UI across language, math, music apps) · Intercom (Lottie → Rive migration).
- Game UI reel: Monaco 2 / Pocketwatch (case study + quote) · Rive Renderer claim (unprecedented vector counts, analytic antialiasing) · toolset line (audio, state, text for menus & HUDs).

### Tier 2 — lite modals: Automotive, Mobile Apps, Websites, Film+TV, Broadcast
Same sheet, shorter: claim → one proof visual (static or lightweight .riv if one exists — automotive cluster demo is a natural) → 2 proof lines → RuntimeChips → CTA. No cell dead-ends; no cell demands a bespoke build.

### Content as data
All of the above lives in `useCaseContent.ts` as typed data (`UseCaseContent { slug, tier, claim, hero: {rivUrl, stateMachine, credit, ghostScript}, proof[], quote?, community[], runtimes[], cta }`). Adding a use case or swapping a hero is a data edit, not a component edit — this is the design-system argument the artifact exists to make.

---

## 5. Rive file requirements (hero embeds)

- Marketplace .riv files embedded via `@rive-app/react-canvas`; each hero needs: artboard name, state machine name, and the input map documented in `useCaseContent.ts`.
- Sustained states exit via **enum condition, not Any State** (house rule — clean exits).
- Ghost cursor: prefer driving via ViewModel pointer x/y binding (Loop spec pattern) when we control the file; for third-party community files where we can't add inputs, the ghost renders as a DOM-layer cursor above the canvas dispatching real pointer events. Document per-file which mode applies.
- Lazy-load .riv + runtime on first modal open per use case; preload on cell hover (hover intent = ~300ms head start). Cache across opens.
- Canvas idles (pause state machine advance) when the modal closes.

---

## 6. DialKit dial table

| Dial | Range | Initial |
|---|---|---|
| `sheet-in-duration` | 400–1100ms | 800ms |
| `sheet-in-ease` | bezier editor | (0.22, 1, 0.36, 1) |
| `sheet-in-travel` | 3–12% viewport | 6% |
| `sheet-out-duration` | 150–400ms | 240ms |
| `scrim-in-duration` | 100–500ms | 250ms |
| `scrim-opacity` | 0.25–0.7 | 0.45 |
| `scrim-blur` | 0–32px | 20px |
| `sliver-height` | 40–160px | clamp(64, 8vh, 120) |
| `ghost-idle-delay` | 2–12s | 6s |
| `hover-preload-delay` | 0–600ms | 300ms |
| `state-dwell` | 2000–8000ms | 3500ms |
| `cycle-resume-delay` | 4000–20000ms | 8000ms |

### As built (`useModalDials.ts`, `dialkit` v1.4.3)

The table above is implemented with the real `dialkit` package; `<DialRoot />` is mounted on `/showcase`. Deviations, all deliberate:

- **`sheet-in-duration` + `sheet-in-ease` are one control.** DialKit's transition control *is* the bezier editor this table asks for, and it bundles the duration with a live curve preview — better for a feel pass than two separate rows. It expresses duration in seconds; the hook converts to ms.
- **`sheet-out-travel` (4%)** and **`sheet-opacity-in-duration` (200ms)** were implicit in §3; they are explicit dials now.
- **`reduced-crossfade` (150ms)** and a **`reducedMotion` toggle** were added so the reduced-motion fallback is previewable without changing OS settings.
- **`replay` action** re-triggers the entrance for repeat judging.
- **`state-dwell` and `cycle-resume-delay`** were added with the Product UI hero (T1 → Nosey): the rail's auto-cycle cadence and how long a manual pick holds control.
- Values persist to localStorage, so a tuning session survives reloads.
- Travel is emitted in `vh`, not `%` — CSS `translateY(%)` resolves against the element's own height and the sheet is taller than the viewport, which would have made the dial lie.

---

## 7. Build order

1. **ModalRoot mechanics first, ugly.** Portal, scrim, lock, overlay-scroller, Esc/X/scrim-click, focus trap, scroll restore. Prove the mechanics with placeholder content.
2. **Motion pass.** Two-speed choreography on DialKit dials. Tune until the scrim-snap/sheet-glide contrast feels like the Stripe reference on our dark canvas.
3. **Tier 1 content, Game UI first** (Health Bar hero is the fastest path to the full anatomy). Then Product UI.
4. **Ghost-cursor invitation** on the hero (port the Loop ghost grammar).
5. **Deep-link state + reduced motion + mobile sheet.**
6. **Tier 2 lite modals** from the same data model.
7. **Figma sync:** ModalSheet, ProofCard, CreditChip, RuntimeChip components into Rive-ReDesign (7IP95CwE2b9sYNvHzG3O1b) with Semantic token bindings; update CLAUDE.md with the modal motion rules.

## 8. v1 fallbacks

- Hero slot accepts `type: "riv" | "video" | "image"` — if a community embed misbehaves, drop to a poster image with a "play with it on the marketplace" link. Never a broken canvas.
- FLIP cell-to-sheet morph deferred to v2 (T3).
- Swipe-down dismiss on mobile deferred to v2 (drag handle ships as visual affordance only).

## 9. Open taste decisions

- ~~**T1 — Product UI hero**~~ — **resolved, see the Decision log.**
- **T2 — Scrim blur strength:** 20px (Apple) reads glassy; 12–14px may sit better with the DotField's texture behind it. Dial it live.
- **T3 — v2 FLIP morph:** cell → sheet morph would be spectacular but risks upstaging content. Decide after v1 feel is locked.
- **T4 — Tier 1 promotion path:** if Spotify-cell interest demands it, does the campaign cell get a full modal with a Wrapped-style scrubbable demo? (Would need a from-scratch .riv — scope consciously.)

---

## Decision log

- **T1 — Product UI hero → Nosey** (2026-07-25). The owner's own AI-agent character, demonstrating enum-driven agent states via a StateRail that is both live status and control. *Rationale:* same category as the Notion assistant already on Rive's own proof wall, and being first-party unlocks the proper data-binding integration path (§5) instead of the synthetic-pointer workaround a third-party file forces.
  - As built: artboard `NotionAI 2` (1000×1000, capped to 480px), state machine `Test`, view model `NoseyViewModel`, enum property `agentStatus` with 9 lowercase values (`idle · thinking · searching · writing · greeting · error · completed · nerd · cool`). No legacy inputs or listeners — purely data-bound.
  - Rail order is lifecycle-arc-first (`idle → thinking → searching → writing → completed → error → greeting → nerd → cool`); the auto-cycle walks only the four sustained states. The value list itself is read from the runtime, so it cannot drift from the file.
  - **House rule verified:** zero Any State transitions, and every sustained loop exits on an `agentStatus != <value>` enum condition.
  - **Known file behaviour:** `greeting`, `error`, and `completed` are one-shots that return to Idle on exit-time while the enum stays set, so Idle re-enters them. The .riv is left untouched; the rail returns the enum to `idle` once the shot has played.

- **Websites proof-visual → live first-party hero** (2026-07-26). Promoted under §4's "lightweight .riv if one exists" clause; the modal stays Tier 2 in structure (two proof lines, no quote, no CommunityStrip). The hero is "Uko", a cursor-tracking self-portrait — the argument being that cursor-reactive characters are what Rive actually looks like on a marketing site.
  - As built: artboard `Avatar` (2083×2083, capped to 420px), state machine `State Machine 1`. This is the third integration mode: **listener-driven**. All seven listeners live inside the file and write its own properties, and `alignTarget` provides pointer-follow — so the visitor's real cursor drives everything and we write nothing. No ghost, no synthetic events, no new dials.
  - The file was later converted from legacy state-machine inputs to an **`AvatarViewModel`** (same five names). The integration stayed listener-driven, but the conversion **did** force one code change: this hero must mount with `autoBind: true`, because the runtime defaults it to `false` and the file's own conditions now read view-model properties — without a bound instance the character plays its idle loops and never reacts. It is a per-hero opt-in, not a default: enabling it for a legacy-input file makes the runtime log "Could not find a View Model linked to Artboard …" on every open.
  - **House rule verified** before and after the conversion: zero Any State transitions across all nine layers. Post-conversion, sustained states exit on `viewModelComparison` against `Pointer.Tracking`, which satisfies the rule in letter as well as spirit; one-shots exit on exit-time.
  - Hero containers are chrome-free while a canvas is live — the artwork's own background shape is its body, so the surface box would read as a competing panel. The box is scoped to the labelled-placeholder fallback state.

- **Automotive proof-visual → live community hero** (2026-07-26). Same Tier 2 clause as Websites; structure unchanged (two proof lines, no quote). The hero is *Futuristic Driving UI Concept* by Noushin.Pourmirza, CC BY, credited to the marketplace page.
  - As built: artboard `Artboard` (3534×1626, full sheet width, no cap), state machine `Startup-SM`. A **hybrid** file — legacy inputs (`dashboardReady`, `isAccelerating`, `Click`) *and* view models (`DashboardVM` default, plus `AcceleratingVM`). `autoBind: true` binds the default instance so the file's own bindings (gear, speed, colours) resolve; per third-party policy we never write its inputs or properties.
  - Interaction: `HitBox` **click** starts the boot sequence (speedometer/nav/icons/accelerator appear, then `dashboardReady`); `AcceleratorHitBox` **down/up** is press-and-hold to accelerate; Eco/Sport/Autonomous switch `drivingMode`.
  - **No ghost.** Four self-announcing controls with their own hover states make this freely explorable rather than one hidden affordance, and the launch is click-gated — which `GhostCursor` cannot demonstrate (hover-only; boundary now documented in that component).
  - **House rule — measured, informational, not fixed** (community file): 9 of 10 layers clean; `Driving Mode Color` fans out from the Any State (three enum-conditioned Any → colour transitions, colour states with no exits of their own).
  - **Hover-preload policy:** `PRELOAD_MAX_BYTES = 1_000_000`. At 4.1 MB this asset is excluded from speculative hover-preload and loads on open instead; the three sub-1 MB heroes keep their head start. A policy constant, deliberately not a dial.
  - Map provenance: artboards/state machines/inputs/view models were read with the Rive runtime itself (`.context/probe`, now the standard fallback when the MCP has no file open); listeners and the house-rule check came from the MCP.

- **Film/TV & Broadcast proof-visual → live community hero** (2026-07-26). Same Tier 2 clause; structure unchanged. The hero is *Sci-fi reticle* by drawsgood, CC BY — **the second hero credited to drawsgood**, alongside the Game UI health bar, which is intentional.
  - As built: artboard **`Recticle`** — the typo is the file's own internal name and is kept faithfully in code, while our asset filename uses the corrected `sci_fi_reticle.riv`. 500×500, capped to 420 (matching the Websites Tier 2 precedent), state machine `State Machine 1`.
  - Two marketplace hints were wrong: the artboard is not "New Artboard", and despite being a 2024-era file it has **no legacy inputs** — it carries `RecticleViewModel.offOn` (boolean), so `autoBind: true` is required or the toggle silently never fires.
  - Interaction: one `hit` shape carries both listeners — an `alignTarget` that makes **the reticle track the pointer**, and a `viewModelChange` toggling `offOn` (lock-on). The `main` layer runs `mainIdle ⇄ main` off that boolean; a second `loop` layer gives it ambient idle.
  - **No ghost.** Three reasons: the reticle already follows the cursor so nothing is undiscoverable; the toggle is click-gated, outside `GhostCursor`'s hover-only vocabulary; and a synthetic cursor would collide with a graphic whose subject *is* a cursor-tracking crosshair.
  - **House rule — measured: fully compliant**, in letter and spirit. Zero Any State transitions in either layer; sustained states exit on a view-model property comparison. The cleanest of the community files so far.
  - At 813 kB it stays under `PRELOAD_MAX_BYTES`, so unlike the automotive dashboard it keeps its hover-preload head start.
  - Caveat recorded in code: the MCP reported `listenerTypes: []` for both listeners (other files report `click`/`down`/`up` explicitly), so the toggle's gesture was confirmed behaviourally in a headless click round-trip rather than read from the map.

- **Campaigns filled, and made deliberately heroless** (2026-07-26). The last `type: "pending"` placeholder is retired, so no content entry sits in the fallback state; the `pending` union member remains purely as §8 missing-asset machinery. `hero` is now optional on `UseCaseContent` — omitting it renders no slot and reserves no space, so the sheet reads as designed-without-a-hero. Campaigns is claim → proof → CTA.
  - Anchored on **Strava Year in Sport**: an interactive, personalized in-app recap for millions of athletes across 14 languages, built in-house in three months, credited with 30.2K new subscriptions and 110K trial starts. These figures come from **public statements by Rive's co-founder** — there is no Rive case-study page for it, so nothing links Strava and no such source is implied. No Strava artwork is used (their IP). Supporting line: Hero Assistant's Year Wrapped, linked to the rive.app blog post.
  - First **lite modal with a pull quote** ("Motion isn't just decoration here, it's core infrastructure." — Guido Rosso, Rive co-founder). Intentional: the quote is the anchor proof, not decoration. The other lite modals still assert no quote so this stays a considered exception.
  - `ProofItem` gained an optional `href`, rendering the source label as a link only where a real public artifact exists — evidence, never a fabricated citation.
  - **Cell retitled** to "Wrapped moments, made personal" / "Interactive year-in-review campaigns, personalized for millions." The old cell led with Spotify Wrapped and its 300M/630M figures, which both mismatched the Strava-anchored modal behind it and kept Spotify material outside CaseStudies, where that story is reserved. The cell href stays on the CaseStudies anchor.
  - The original "visit, wrapped" hero (spec T4) is **deliberately deferred as its own build phase** — a from-scratch .riv, not a gap in this modal.

- **CommunityStrip populated with real marketplace files** (2026-07-26). Tier 1 only: 4 items on Game UI, 5 on Product UI (spec range is 4–6). A lite modal carrying a strip would stop being lite, so none do.
  - Data is **harvested, never hand-written** — `scripts/fetch-community.mjs` reads each curated page and extracts title, primary creator, full credits, thumbnail and licence, so a credit cannot drift from the page it credits. Re-run it to refresh. It **excludes anything that is not CC BY** rather than including it quietly; all nine curated URLs passed, so no slot was left short.
  - Parsing notes that matter if the script is ever rewritten: `<title>` carries React comment separators (`Demo<!-- --> by <!-- -->JcToon`) that must be stripped, `og:title` is the bare title and never holds the creator, and full multi-contributor credits live in the `description` meta. The creator is cross-checked against `username` in the embedded page JSON.
  - Thumbnails are **committed locally, downscaled to 640px** with `sips` (macOS-native, no new dependency): 1.4 MB total instead of ~13 MB of 1920×1080 originals, for a slot a few hundred px wide. Same size discipline as the hover-preload gate. Self-contained beats hot-linking, and CC BY plus a rendered credit makes the local copy legitimate.
  - Multi-contributor files (Game HUD/Scope, Interactive Icon Set) show the **primary account in the strip with the full contributor line in the accessible name** — verified against the browser's computed name, not just the markup.
  - Links open in a new tab: a marketplace exit is conversion-adjacent, and the modal should survive it.
  - **Architecture:** deliberately *not* generalized. This hero needed only canvas + width cap + fallback + pause-on-close, which is `RiveHero` minus its optional ghost — so `RiveHero` gained `maxWidth` (~4 lines) and no new component was written. Revisit a shared `CharacterHero` only when a fourth hero needs something neither existing component has.
  - Also folded in: the ghost's static invitation is now gated on the machine actually running, so a hint can never promise an interaction a paused canvas cannot deliver.

- **Closed tiles gain autoplaying video loops** (2026-07-30). The bento cells stop showing a `MEDIA` placeholder and start showing the product. **No modal file was touched** — §1's rule that a hero holds a live `.riv` and never a video is about the sheet, and it stands. A tile is a different slot: these are recordings of real products running Rive, and the live artifact is still one click behind them.
  - `BentoCell` needed **no new prop** — it already had a `media?: ReactNode` slot that `UseCaseBento` had never filled. The change is one new component (`TileVideo`), one `tileMedia?` field, and one line of CSS (`overflow: hidden` on the media box, which a child filling a rounded box now requires).
  - **Files are committed under `public/` and referenced by literal path, never imported.** An import would route the bytes through Vite's asset pipeline and put a hashed URL in the JS chunk. Measured after: the ten path strings cost **339 bytes** in the main chunk, which grew 548.85 → 550.65 kB; zero `ftyp` signatures and zero `data:video` URIs in any chunk; 3.4 MB copied verbatim into `dist-app/video/`. Pinned by `useCaseTileMedia.test.tsx`.
  - **Three of the six clips are not what their filenames say**, which is why each one was decoded and looked at rather than trusted. The full source map — origin URL and verified content per clip — lives at the top of `useCaseContent.ts`, not here, so it sits next to the data it describes.
  - **Campaigns is held deliberately.** Its clip is Spotify Wrapped, which would reverse the 2026-07-26 Strava re-anchor above — the entry that exists precisely to keep Spotify material inside CaseStudies. Geometry independently rules it out: a 4:3 source into that cell's ~3.7:1 media slot loses ~64% of its height. The `.mp4` stays committed so the call is reversible without a re-fetch; the cell keeps its labelled placeholder, and `tileMedia` is optional so that reads as a designed state rather than a gap.
    - **FOLLOW-UP, not addressed here:** the campaigns cell's visible copy still reads "Wrapped moments, made personal" / "Interactive year-in-review campaigns, personalized for millions." That wording predates the Strava re-anchor and may now be stale against the modal behind it. Deliberately left unchanged in this diff — it is a copy decision, not a media one.
  - **Film/TV is cropped in CSS, as data.** Its source is a full browser-window capture, so YouTube chrome — title bar, scrubber, timecode, "Screenshot" button — is burnt into the frame, and the tile slot crops *width* (~11%), which would have left all of it intact. Measured on the decoded frame: chrome occupies the top ~7.2% and bottom ~6.0% of the source height. `crop: { top: 0.075, bottom: 0.065 }` carries a small margin; `TileVideo` turns it into a zoom (1.1628) plus a re-centring shift (−0.581%). Confirmed clean in a browser pass.
    - **Polish-phase alternative, recorded now so the measurement is not lost:** if the CSS zoom ever reads soft, re-encode a real crop with ffmpeg — `-vf "crop=iw:ih*0.865:0:ih*0.075"` on the 924×600 source — and strip `product-ui.mp4`'s audio track in the same pass (it is the only clip carrying one; it renders muted, so it is dead weight rather than a bug).
  - **Websites ships bright.** The clip is Figma's homepage, mean luma 211, in a dark-only grid. Accepted as-is; taming it is a browser-pass call, and the knob would go in `TileMedia` next to `crop` rather than becoming an overlay element.
  - **The reduced-motion still carries "MOTION PAUSED", not a play triangle.** Clicking a cell opens the modal and never plays the tile video, so a ▸ would promise an interaction that cannot happen — the same rule that keeps a hover hint off a paused canvas. Reduced motion also renders an `<img>` rather than a paused `<video>`, so the `.mp4` is never even a candidate for fetching.
  - **Nothing is fetched off-screen.** The `<video>` always renders (server-renderable markup, and a poster for no-JS), but `src` is withheld until an IntersectionObserver fires and is assigned exactly once; scrolling away pauses it. Measured in a browser: **0 `.mp4` requests at load, 5 after scrolling to the bento.** The five posters (91 kB of AVIF) *are* eager — that is the `poster` attribute's behaviour, and it buys the graceful state if autoplay is ever refused.
  - **Posters are generated the house way, not with ffmpeg** (`npm run posters:video`): Chrome decodes the frame, `sharp` encodes AVIF, and `verifyPixels` draws the encoded bytes and reads them back before anything is written. macOS ships no ffmpeg — the same finding `verify-pixels.mjs` already records for images. Two behaviours the script is built around are documented in it: seeking a *paused* video hands back frame 0 every time in headless Chrome, and frame 0 is not automatically a good poster — `product-ui` opens on a switched-off display, so its grab is taken at 1.9s.

---

## 10. Conductor prompt (safe to run now)

> Build the UseCaseModal system for the rive-site repo per `usecase-modal-system-spec.md`. Start with step 1 of the build order: `ModalRoot.tsx` + `ModalSheet.tsx` mechanics with placeholder content — portal into `document.body`, scrim div (`rgba(0,0,0,0.45)` + `backdrop-filter: blur(20px)`), `html` overflow lock on open with exact scroll restoration on close, overlay-as-scroller (`overflow-y: auto; overscroll-behavior: contain` on the overlay, sheet taller than viewport), focus trap, `role="dialog" aria-modal="true"`, dismiss via Escape / close button / scrim click, focus return to trigger. Then wire the entrance: scrim opacity 250ms ease-out; sheet `translateY(6%) → 0` over 800ms `cubic-bezier(0.22,1,0.36,1)` with opacity resolving in the first 200ms; exit at 240ms ease-in with the sheet leading the scrim by ~60ms. Expose every duration/easing/opacity/blur value listed in the spec's §6 as DialKit dials. Respect `prefers-reduced-motion` with the crossfade fallback. Use only Semantic tokens from `dist/tokens.css` — no raw hex. Investigate the existing BentoCell implementation before modifying it; propose a diff plan before applying code.
