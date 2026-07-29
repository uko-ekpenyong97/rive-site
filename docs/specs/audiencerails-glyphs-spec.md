# AudienceRails Glyphs — Authoring & Integration Spec

**Project:** rive-site redesign · **Section:** AudienceRails
**Date:** 2026-07-27 · **Type:** Authoring session (first since Loop) — the .riv is built by us, in the editor, via Claude Code + Rive MCP
**Reference:** business.x.com/en/advertising — glyph drawing grammar (verified static; only their hero pipeline animates, on desynchronized 8.9/10.7/12.9s loops)

---

## 1. Concept

Three abstract line-art glyphs — Designer, Animator, Developer — one per audience rail, in X's diagram grammar but *actually alive*. The reference site draws motion and never moves; ours moves. One amber payload dot appears in all three glyphs: the work traveling the designer's curve, driving the animator's playhead, walking the developer's state machine. One payload, three crafts, no handoff — the section's argument, drawn.

The glyphs are supporting cast, not heroes: quiet infinite loops on desynchronized durations, subtle hover response, legible at rest.

**Companion copy change:** each rail trims to heading + max two lines (X card discipline). The glyph carries the feel; the text carries the offer.

---

## 2. Shared visual vocabulary

| Element | Meaning | Drawing |
|---|---|---|
| Square (outline) | Static thing — asset, source, endpoint | 8×8, stroke only |
| Circle (outline) | Live thing — node, agent | r 6–14, stroke only |
| Small filled dot | **The payload — the work itself** | r 3–4, **accent fill, the only color** |
| Dashed line | Potential / inactive path | 1.5 stroke, dash 4 4 |
| Solid line | Active path | 1.5 stroke |
| Active ring | Momentary emphasis on a live node | stroke doubles then decays |

- **Stroke weight 1.5** at render size, round caps, no structural fills.
- **Colors are NOT baked.** Every glyph binds stroke + accent to ViewModel color properties (§5); code writes token-resolved values at mount. The .riv ships theme-agnostic; the site keeps its single-accent discipline (amber = the payload, everywhere).
- Artboards **240×200** each. Rendered ≈220×190 (X's card scale).

---

## 3. The three glyphs

### 3.1 GlyphDesigner — the pen tool
**Cast:** two anchor squares (left/right), a cubic curve between them, two handle stems with handle-dots, the amber payload dot riding the curve.
**Idle loop (9s):** the curve re-tensions between two silhouettes (shallow arc ↔ deep S) as the handles slowly counter-rotate; the payload dot travels the curve end-to-end and back. Continuous, no hard cuts — the act of drawing as breathing.
**Hover:** handles enlarge slightly (+2), tempo ×1.5.
**Rest frame (reduced motion):** deep-S silhouette, handles extended, dot at 60% of the curve.

### 3.2 GlyphAnimator — the timeline
**Cast:** a horizontal track line, four keyframe diamonds (6×6, rotated squares) along it, a vertical playhead line, a small stage circle (r 10) above the track, the amber payload dot as the playhead's head.
**Idle loop (11s):** playhead sweeps left→right; as it crosses each diamond the stage circle changes pose — scale pop / vertical hop / brief rotation wobble / return — with visible ease-out after each hit (the glyph literally demonstrates keyframing). Crossed diamonds render solid until the sweep resets; reset is a fast (300ms) return, then the loop breathes for a beat before re-running.
**Hover:** tempo ×1.5.
**Rest frame:** playhead at diamond 3 of 4, stage mid-pop, first three diamonds solid.

### 3.3 GlyphDeveloper — the state machine
**Cast:** three circle-nodes (r 12) in a triangle, connected by lines with small arrowheads, the amber payload dot walking the edges.
**Idle loop (13s):** the dot walks a deliberately non-obvious node order — 1→3→2→1→2→3→1 — pausing 400–900ms (varied) inside each node; the occupied node's ring doubles weight and its outgoing edge renders solid while all other edges stay dashed. Reads as logic evaluating, not a cycle. (Honest note: Rive has no RNG — the "non-determinism" is a long authored sequence whose pattern is not visually guessable within one viewing.)
**Hover:** the current node's active ring pulses once; tempo ×1.5.
**Rest frame:** dot inside node 2, its ring active, one edge solid.

---

## 4. Rive file architecture

- **One file:** `audience_glyphs.riv`. Three artboards: `GlyphDesigner`, `GlyphAnimator`, `GlyphDeveloper`.
- **Shared components** as nested artboards where reuse is real (payload dot with its subtle scale-breathe; anchor square; node circle with active-ring animation). Don't force sharing where drawings diverge.
- **State machines:** one per artboard, named `Glyph_SM`, default.
- **States:** `Idle_Loop` (the main loop) and `Hover_Loop` (same timeline at ×1.5 speed — duplicate timeline or speed-differentiated state). Transitions gated on **ViewModel comparison** (`GlyphVM.hover == true/false`) with 250ms cross-blend both directions.
- **House rules apply and will be audited:** zero Any State transitions; sustained states exit via VM condition; hover exit must return cleanly mid-loop (blend, not restart — no visible snap).
- **Listeners:** none in-file for hover. Hover detection lives in code (the rail is the hover target, larger than the canvas), writing `GlyphVM.hover`. In-file listeners would only see the canvas hitbox — wrong surface.
- **Events:** none. Nothing for code to subscribe to; keep the contract minimal.

## 5. ViewModel contract (identical across all three artboards)

```
GlyphVM {
  hover:       boolean  (default false)   // code writes on rail pointerenter/leave
  strokeColor: color    (default #8A8F98) // code writes token-resolved --text-secondary at mount
  accentColor: color    (default #FFA41C) // code writes token-resolved --accent-default at mount
}
```
Every stroke binds to `strokeColor`; only payload dots (and active rings, if colored) bind to `accentColor`. This is the same pattern the Automotive file's DashboardVM uses for theming — ours, done on purpose.

## 6. Motion values

| Value | Designer | Animator | Developer |
|---|---|---|---|
| Loop duration | 9s | 11s | 13s |
| Hover tempo | ×1.5 | ×1.5 | ×1.5 |
| Hover blend | 250ms | 250ms | 250ms |

Desynchronized primes-ish durations = the section shimmers without ever visibly repeating (X's hero-pipeline trick, applied to the grammar itself). Timing lives **in the file**; no new DialKit dials — if tempo needs tuning, it's an editor edit, which is the correct tool for authored motion.

---

## 7. Integration contract (code side, after the .riv exists)

- Three canvases in AudienceRails, one per rail, same `RiveHero`-family conventions: `?url` import, lazy on approach (IntersectionObserver), **pause when offscreen** (idle-correctness), chrome-free (no surface box — the glyphs sit directly on the section background), `bytes` recorded for the preload policy (expect well under 1 MB; flag if not).
- On mount: resolve `--text-secondary` and `--accent-default` from the computed styles of `dist/tokens.css` and write both colors into each `GlyphVM`. One resolver, shared.
- Rail `pointerenter`/`pointerleave` → `GlyphVM.hover`. The rail, not the canvas, is the hover surface.
- **Reduced motion:** never autoplay; scrub each artboard to its §3 rest frame (author a 1-frame `Rest` timeline per artboard so code can play it once deterministically); hover writes disabled. The drawings must carry meaning static — X proves they can.
- **Fallback (§8 of the modal spec, inherited):** missing/failed asset → nothing renders (no placeholder box — these are decorative-plus, and an empty slot beats a labeled ghost here). Rail text must stand alone.
- **Copy trim** in the same pass: each rail to heading + ≤2 lines. Final copy proposed in the diff plan for approval.
- Alt/a11y: canvases `aria-hidden` — the rail text names the audience; the glyphs are illustration, not information. (Contrast with CreditChip rules: nothing here is licensed or load-bearing.)

## 8. Build order

1. **Author `GlyphDeveloper` first** (simplest cast, proves the whole contract: VM colors, hover blend, rest timeline, house-rule exits).
2. Validate in-editor: colors respond to VM writes, hover blends both directions mid-loop without snapping.
3. Author `GlyphAnimator`, then `GlyphDesigner` (hardest motion — curve re-tension — last, with the contract already proven).
4. House-rule audit via MCP on all three state machines; fix in-editor before export.
5. Export `audience_glyphs.riv` → Downloads.
6. Conductor integration pass (§7) with the established rituals: map comment block, smoke (three canvases, VM color writes verified, reduced-motion rest frames, pause-offscreen, six-hero regression guards → these three are *not* heroes and must not join that block), report, push.

## 9. Prompts

### 9.A — Claude Code + Rive MCP (authoring, run in the desktop app with the editor open on a new file)

> Build `audience_glyphs.riv` per docs/specs/audiencerails-glyphs-spec.md §2–§6 (read it from the repo first). Work through build order §8 steps 1–4: GlyphDeveloper, then GlyphAnimator, then GlyphDesigner. For each artboard: 240×200; draw the §3 cast with §2 vocabulary (stroke 1.5, round caps, no structural fills); create `GlyphVM` per §5 and bind every stroke to strokeColor, payload dots to accentColor; build `Glyph_SM` with Idle_Loop and Hover_Loop gated on `GlyphVM.hover` comparisons with 250ms blends; author the 1-frame Rest timeline at the §3 rest frame; loop durations per §6. Zero Any State transitions — audit each state machine before moving to the next artboard and report the audit. Verify color binding by writing test values to strokeColor and confirming visually. Do not export until all three pass; then export to ~/Downloads/audience_glyphs.riv and report artboard/SM/VM names exactly as created.

### 9.B — Conductor (integration, run after the export exists)

> AudienceRails: mount the three authored glyphs per docs/specs/audiencerails-glyphs-spec.md §7, and trim rail copy to heading + ≤2 lines (propose final copy in the diff plan). Asset from ~/Downloads/audience_glyphs.riv → src/assets/rive/. Verify the map via Rive MCP or the .context/probe fallback; confirmed-map comment block in the established format including the house-rule audit result. Diff plan before code; smoke per §7 including the not-a-hero guard; report bundle delta; push.

## 10. Decision log entries (add on completion)

- AudienceRails glyphs: authored in-house, one file, three artboards, theme via VM color binding (Automotive's pattern, adopted deliberately).
- Copy trimmed to X-card discipline; glyphs carry the feel.
- Reference finding recorded: business.x.com's card glyphs are static; only its hero animates, desynchronized. Ours animate the grammar itself.

---

## 11. Decision log

- **Glyph authoring → in-house, one file, three artboards, theme by view-model** (2026-07-28). The glyphs are our own drawing rather than a marketplace file, so there is nothing to credit and nothing licensed — which is exactly what lets them be `aria-hidden` decoration instead of a hero with a provenance chip. Colours bind to `GlyphVM.strokeColor` / `accentColor` and are written from resolved tokens at mount, the same shape the Automotive `DashboardVM` uses.
  - **As built:** `audience_glyphs.riv`, 4,299 bytes, sha256 `650dc8b0…`. Artboards `GlyphDeveloper` / `GlyphAnimator` / `GlyphDesigner`, all 240 × 200, each carrying `Glyph_SM`.
  - **House rule verified:** zero transitions out of the Any State across all four layers; every sustained state exits on a `GlyphVM.hover` comparison at 250 ms in both directions. Map read live from the editor over the Rive MCP, not inferred from names.
  - **Why the write is load-bearing:** the file ships theme-agnostic on purpose, so skipping it does not degrade gracefully — it renders the baked `#8A8F98` / `#FFA41C` defaults and silently stops tracking the token system.

- **`Rest` is a timeline, not a state → reduced motion drives `animations`, not `stateMachines`** (2026-07-28). Authoring `Rest` outside `Glyph_SM` is what makes the reduced-motion path deterministic: code plays one 1-frame timeline and lands on the authored pose.
  - **Caveat recorded in code:** naming the state machine under reduced motion would start `Idle_Loop` — precisely what reduced motion exists to prevent. The map comment in `AudienceGlyph.tsx` says so at the point of use.
  - Hover is likewise a **view-model property, not a state-machine input** (`inputs: []` on all three). `stateMachineInput("hover")` would compile, run, and do nothing.

- **Failure renders nothing — deliberately unlike the hero §8 rule** (2026-07-28). A modal hero that fails degrades to a labelled placeholder because the sheet already reserved space and a gap would read as a bug. A glyph that fails renders no node at all.
  - **Why not:** these are decorative-plus and the rail text is the information. A labelled ghost box would be louder than the drawing it replaced, and the rail collapses to exactly the rail that shipped before the glyphs existed.

- **Lazy-on-approach + sustained observer — a new pattern, not a copied one** (2026-07-28). No Rive canvas in this repo was IntersectionObserver-gated before this; `LoopCanvas` mounts eagerly and never pauses. The idiom here composes StatsBand's observer shape with `RiveHero`'s pause rule.
  - **Architecture:** `approached` latches (fetch once, never unmount) while `visible` keeps tracking (pause offscreen). StatsBand's observer disconnects on first hit because a count-up only needs to start; this one owns an ongoing idle rule and has to keep watching.
  - **Known file behaviour:** retained content outlives visibility, so "offscreen" is an explicit input to the canvas rather than an unmount assumption — the same rule the modal spec records for "closed".

- **Copy trimmed to heading + two lines; the animator rail loses its size claim** (2026-07-28). Each rail now carries the offer and nothing else, per §1.
  - **As built:** designers — "The pen tool and components you know, plus state machines you build visually — no code."; animators — "Timelines, keyframes, and easing like the tools you came from — except your work stays interactive."; developers — "Open-source runtimes for every platform, and data binding is the contract between code and design."
  - **Why not:** "and the files stay tiny" was cut rather than reworded — it is a performance claim on a craft rail, and StatsBand already owns the size argument. Pinned by a test so it cannot drift back.

- **`assetsInlineLimit` hardened for `.riv`** (2026-07-28). Vite's default inline threshold is 4,096 bytes and the glyph file is 4,299 — a 203-byte margin.
  - **Why:** a re-export from the editor that shrank the file would silently flip it to a base64 `data:` URL, with no warning, no build error, and only in `vite build` (the dev server never inlines). Nothing downstream would have caught it, and `.riv` files are fetched and hover-preloaded *by URL*.
  - **As built:** a predicate returning `false` for `.riv` and `undefined` for everything else, so no other asset type changes behaviour.

- **The verification layer was untracked; it is committed now** (2026-07-28). `.context/modal-smoke.mjs` had accumulated 276 assertions over five sessions and had never been committed, because `.context/` is gitignored. Every past "N assertions passing" claim was therefore unreproducible by anyone but its author.
  - **As built:** ported to Vitest under `src/__tests__/`, run with `npm test`. The original spun up its own Vite dev server and called `ssrLoadModule`; Vitest already *is* the Vite pipeline, so that scaffolding is gone and the modules import directly.
  - **Caveat recorded in code:** `useCaseContent.ts` claimed the pending variant was "exercised by the smoke suite" while pointing at nothing tracked. It now names the test file, and records that the claim used to be unverifiable.
  - The glyphs are guarded as **not heroes**: their artboards are asserted disjoint from the five shipped hero artboards, and the five-hero regression block is explicitly off-limits to them.

- **One `CONFIRMED MAP` block, not three** (2026-07-28). The house format is one block per artboard, but all three glyph artboards implement an identical contract and differ only in loop duration and cast.
  - **Why:** a single per-artboard table records strictly more than three near-identical blocks would. The deviation is stated inside the block itself rather than left for a reader to discover.
