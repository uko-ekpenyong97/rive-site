# NEXT UP

- _(empty — self-hosting the webfonts landed 2026-08-03; see Done)_

# Follow-ups

- **ui-sans-serif stragglers** — a handful of text-bearing elements
  compute to `ui-sans-serif` (Tailwind's default stack) rather than a
  `--font-*` token; seen on both `/` and `/showcase`, e.g.
  `.hero__wordmark`. Ordinary cleanup: find them and point them at
  the token. Harmless today because the fallback is a system sans,
  but it means the design system is not actually governing every
  glyph on the page.

- **Batched Figma component sync** — one session, six components:
  ModalSheet, StateRail, CreditChip, ProofCard, TileVideo, RiveButton.
  Semantic bindings throughout, then matching *.figma.tsx.
  Notes: CreditChip is a local function inside ModalHero.tsx and
  ProofCard is an inline <li> in ProofReel.tsx — whether sync forces
  extraction is a real decision for that session, flagged not
  assumed. Do NOT run connect:publish (Professional plan);
  connect:parse validates locally without auth.
- **Cat search escalation** (WIP at ffe25c4; "do not build on this"
  scopes to the escalation feature only) — standalone reaches y91,
  in-app below-nav band flat. Plan: (1) staged-timing sweep, Left
  true → wait T → Left2 true, T ∈ {0,100,250,600,1200}ms, report
  reach per T; (2) definitive: owner opens get-started-cat.riv in
  the Rive desktop editor, Claude Code reads the Motion SM graph
  via the Rive MCP — fix design follows the graph.
  Ruled out: holdMs 900→1600, no change (reverted).
  Unexplained: single frame t=1345ms bandDiff 7.470, unreproducible.
  Reminder: the MCP maps the OPEN EDITOR; probe:riv maps COMMITTED
  BYTES — confirm anything the MCP suggests against the artifact
  before wiring.
- **1280px horizontal overflow** — .experts-strip__card, 10px,
  pre-existing, unrelated to hero/bento work.
- **posters:video is timer-based, not seek-based** — regenerating
  can shift frames ~0.02s and churn committed AVIFs (seen:
  product-ui 1.88→1.86). Pin to seeked timestamps if it bites again.
- **DemoSlot component has zero consumers** since the hero rebuild
  (reservation retired in the Decision log) — delete when convenient.
- **ffmpeg polish pass (optional)** — film-tv re-crop with measured
  values (logged in the spec, -vf "crop=iw:ih*0.865:0:ih*0.075");
  strip product-ui.mp4's dead audio track in the same pass.
  campaigns.mp4 (Strava) needs nothing.
- **Stale worktree** — ~/Downloads/rive-redesign holds main at
  2838eb4, now 50+ behind. Pull before any work there; never pull it
  from a Conductor worktree.
- **beats:diff freeze residue (low priority)** — 3 of 10 cells do
  not freeze reproducibly: beat 2 @7000ms and beat 3 at both
  targets, drifting 0.04-0.08 mad (0.12-0.24% of pixels) between
  two cold loads of the SAME file. They are reported as
  indeterminate and counted neither way, so the tool is honest
  rather than wrong — but those beats cannot currently be A/B'd.
  Suspect a clock consumer the freeze does not cover: rAF and
  performance.now() are both virtualised, so the candidates are
  setTimeout/setInterval, Date.now, or timing inside the Rive wasm
  that never reaches JS. Chasing it means finding what beats 2 and
  3 do that 1, 4 and 5 do not (WirePerformance is a 4s timeline,
  LoadingSustain 2s — both longer than the others' poses).
- **verify:live proposal** — the "renders correctly, functions not
  at all" failure class (useRive attach deadlock, AudienceRails
  glyphs incident) has no systematic guard. Proposal: headless-
  Chrome smoke suite asserting every Rive surface mounts, runtime
  reaches live state, canvas has non-blank pixels.

# Recipes

- **Merging when main is checked out elsewhere**: create a temp
  detached worktree at origin/main, merge --no-ff there (or push
  branch:main for fast-forwards), run the full gate in it, push
  HEAD:main, remove the worktree. Never touch the stale
  ~/Downloads checkout.
- **Loop re-exports**: npm run beats:diff before committing the
  swap — confirm the beats you changed are the beats that changed.

# Done

- **Self-hosted the webfonts** (2026-08-03) — same rationale as the
  Rive wasm, and the gap it closed was embarrassing in the same shape:
  the site committed 4.8 MB of wasm so a CDN incident could not empty
  its animated surfaces, then fetched its display face from Google, so
  the same incident would have left it in Times New Roman. Measured on
  the first deployment: FCP 1216 ms against DOM-interactive 190 ms —
  text paint was waiting on a third-party round trip.
  Tomorrow / Inter / JetBrains Mono, all SIL OFL (verified against
  OFL.txt in github.com/google/fonts, texts shipped in public/fonts/),
  8 latin-subset woff2 faces totalling 138 kB, `font-display: swap`.
  The face list changed in both directions once the RENDERED weights
  were measured rather than assumed: Inter 600 was in use and never
  requested (faux-bold since CaseStudies shipped), JetBrains Mono 500
  was downloaded on every visit and never drawn.
  `check:offline` now blocks fonts.googleapis.com and fonts.gstatic.com
  alongside the wasm CDNs, and asserts the faces are both loaded and
  DRAWING — "zero Google requests" is satisfied just as well by
  silently falling back to a system font.

- **Self-host rive.wasm** (2026-08-01) — the runtime no longer fetches
  from unpkg. Both binaries are committed under public/rive/runtime/
  under versioned names and pointed at by src/riveRuntime.ts.
  Two binaries, not one, and this is the part to not "simplify": the
  jsdelivr URL was never a CDN mirror — rive_fallback.wasm is compiled
  for older architectures and is used when the primary fails to fetch
  OR to compile, so dropping it would silently strip support for those
  CPUs. Guarded by a three-way pin in check:assets (committed bytes ==
  node_modules bytes, filename version == installed version, source
  references both) and by check:offline, which blocks both CDNs and
  asserts every surface still mounts and paints, plus zero CDN requests
  on a normal load. Re-export step on every runtime upgrade — noted in
  CLAUDE.md's asset section.

