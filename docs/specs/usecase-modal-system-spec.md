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
  - As built: artboard `Avatar` (2083×2083, capped to 420px), state machine `State Machine 1`. The file has **no view models**, so this is the third integration mode: **listener-driven**. All seven listeners live inside the file and fire its own inputs, and two use `alignTarget` for pointer-follow — so the visitor's real cursor drives everything and we write nothing. No ghost, no synthetic events, no new dials.
  - **House rule verified:** zero Any State transitions across all nine layers; sustained states exit on the `Pointer.Tracking` bool, one-shots on exit-time.
  - **Architecture:** deliberately *not* generalized. This hero needed only canvas + width cap + fallback + pause-on-close, which is `RiveHero` minus its optional ghost — so `RiveHero` gained `maxWidth` (~4 lines) and no new component was written. Revisit a shared `CharacterHero` only when a fourth hero needs something neither existing component has.
  - Also folded in: the ghost's static invitation is now gated on the machine actually running, so a hint can never promise an interaction a paused canvas cannot deliver.

---

## 10. Conductor prompt (safe to run now)

> Build the UseCaseModal system for the rive-site repo per `usecase-modal-system-spec.md`. Start with step 1 of the build order: `ModalRoot.tsx` + `ModalSheet.tsx` mechanics with placeholder content — portal into `document.body`, scrim div (`rgba(0,0,0,0.45)` + `backdrop-filter: blur(20px)`), `html` overflow lock on open with exact scroll restoration on close, overlay-as-scroller (`overflow-y: auto; overscroll-behavior: contain` on the overlay, sheet taller than viewport), focus trap, `role="dialog" aria-modal="true"`, dismiss via Escape / close button / scrim click, focus return to trigger. Then wire the entrance: scrim opacity 250ms ease-out; sheet `translateY(6%) → 0` over 800ms `cubic-bezier(0.22,1,0.36,1)` with opacity resolving in the first 200ms; exit at 240ms ease-in with the sheet leading the scrim by ~60ms. Expose every duration/easing/opacity/blur value listed in the spec's §6 as DialKit dials. Respect `prefers-reduced-motion` with the crossfade fallback. Use only Semantic tokens from `dist/tokens.css` — no raw hex. Investigate the existing BentoCell implementation before modifying it; propose a diff plan before applying code.
