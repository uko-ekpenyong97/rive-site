# NEXT UP

- **Self-host rive.wasm** — hero CTAs depend on unpkg at runtime;
  self-host before the site is shown to anyone at Rive. ~2.4 MB into
  public/, wasm-URL override on @rive-app/webgl2@2.39.1, extend
  check:assets to pin bytes against the package version (re-export
  needed on every runtime upgrade — that's config-vs-artifact drift,
  check:assets is the natural guard). LIVE RISK: now on main.

# Follow-ups

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
