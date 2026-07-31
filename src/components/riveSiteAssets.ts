/* ──────────────────────────────────────────────────────────────────────────
 * RIVE'S OWN SITE ANIMATIONS — SOURCE MAP + CONFIRMED INPUT MAPS
 *
 * These three files are Rive's own brand animations, lifted from the live
 * rive.app and carried forward deliberately. They are the strongest continuity
 * the redesign has with the current site: the animated CTA buttons are what
 * rive.app *feels* like, and rebuilding them from scratch would have thrown away
 * the one piece of the old site worth keeping. Recorded as a Decision log entry
 * in docs/specs/hero-rive-cta-spec.md, not a silent import.
 *
 * Files are committed under public/rive/site/ and referenced by LITERAL PATH,
 * never imported — the same rule the tile videos follow. An import would route
 * the bytes through Vite's asset pipeline and put a hashed URL in the JS chunk.
 *
 * ⚠ EVERY MAP BELOW WAS RESOLVED FROM THE COMMITTED BYTES, not from the live
 * site's markup and not from binary-string recon. `npm run probe:riv` reads the
 * artboards and state machines; inputs were enumerated by instantiating each
 * state machine against the same runtime. Two things the recon got wrong are
 * corrected here — see the rocket and the R logo. This is the house rule from
 * CLAUDE.md: integration truth comes from the artifact.
 *
 * Runtime note: the live site serves @rive-app/canvas@2.27.5 (CPU/Canvas2D).
 * We render with @rive-app/react-webgl2@4.30.0 → @rive-app/webgl2@2.39.1, the
 * GPU build already in the bundle for LoopCanvas. All three files were probed
 * and load cleanly under 2.39.1.
 *
 *   get-started-cat.riv
 *     ← https://public.rive.app/hosted/40850/198254/v5SLt9rntkSw51fMlrBroQ.riv
 *     The nav CTA. A cat that leans toward the cursor: the artboard is 269×150
 *     over a ~150px button, so most of it lives in the overflow ABOVE the
 *     hitbox. Embeds Tomorrow and paints its own "GET STARTED" label.
 *
 *   get-started-rocket.riv
 *     ← https://public.rive.app/hosted/40850/203010/7S2-jB5j_kKWDOddS2yLMA.riv
 *     The hero primary CTA. 500×500 over a ~220px button — the overflow is most
 *     of the file. Sixteen timelines including a 45s minicar idle and a 20s
 *     smoke idle, so it rewards being left alone as much as being hovered.
 *     Also embeds Tomorrow + "GET STARTED".
 *
 *   r-logo-shuffle.riv
 *     ← https://framerusercontent.com/assets/KImxHh05FWtnKZcEgXk7gehcD8.riv
 *     The hero secondary CTA's inline mark. 120×120, one 3s timeline.
 *
 * NOT COMMITTED — site-icons.riv
 *     ← https://framerusercontent.com/assets/gn73z0Y537LGapKqGsp0fMfnIe8.riv
 *     Deliberately left out of the repo: nothing in this build has a home for
 *     it. Recorded here so re-fetching needs no archaeology. It carries ELEVEN
 *     20×20 artboards in ONE file — getSupportIcon, riveManualIcon,
 *     requestFeaturesIcon, blogIcon, discordIcon, showcaseIcon, useCasesIcon,
 *     editorIcon, runtimesIcon, featuresIcon, renderIcon — which runs against
 *     CLAUDE.md's "one artboard per file for multi-instance surfaces" rule (a
 *     missing artboard inside a shared file is invisible; a missing file 404s).
 *     ⚠ TRAP if it is ever wired: `renderIcon`'s state machine is itself named
 *     "editorIcon", colliding with the real editorIcon artboard's machine. Any
 *     lookup keyed on state-machine name will resolve the wrong artboard.
 * ────────────────────────────────────────────────────────────────────────── */

/** A boolean state-machine input the file declares for hover. */
export interface RiveHoverInput {
  name: string;
  /**
   * Fraction of the hitbox width this input owns, as [start, end). The cat
   * splits its button into five zones; a single-input file owns [0, 1].
   */
  zone: [number, number];
}

export interface RiveSiteAsset {
  /** public/ path — NOT an import. See the source map above. */
  src: string;
  artboard: string;
  stateMachine: string;
  /** Artboard dimensions. The canvas is sized from these, not from the button. */
  width: number;
  height: number;
  bytes: number;
  /**
   * Hover-related inputs the file DECLARES, confirmed by probe. Present so
   * `check:assets` can verify they still exist in the committed bytes — it does
   * NOT mean we write them. `pointer` decides that. Never invent an input here.
   */
  declaredInputs: RiveHoverInput[];
  /**
   * How pointer input reaches the machine. Decided by the probe's
   * `hasListeners`, never by taste, and asserted against the committed bytes by
   * `check:assets`:
   *
   * "listeners" — the file carries its own pointer listeners and hit shapes, so
   *   it drives itself from canvas-relative events. The canvas takes
   *   `pointer-events: auto` and we write NOTHING: the art and the hitboxes are
   *   the same file, so the mapping is correct by construction. Driving inputs
   *   by hand here fights the file.
   * "manual" — no listeners, but inputs exist. Driven from the BUTTON's own
   *   hover (not the wrapper, not the canvas), so a pointer outside the button
   *   provokes nothing.
   * "none" — no listeners and no inputs. Autonomous; it just plays.
   */
  pointer: "listeners" | "manual" | "none";
  /**
   * Set ONLY when the probe reports listeners but they are measurably inert, so
   * the file has to be driven manually anyway. It exists to keep that an
   * explicit, reviewed claim: `check:assets` otherwise fails any "manual" model
   * on a file that has listeners.
   */
  listenersInert?: boolean;
  /**
   * The file paints its own label, so the DOM label is only a fallback and is
   * hidden once the canvas is live. When false, we always render the label.
   */
  paintsOwnLabel: boolean;
  /**
   * "overflow" — the canvas is far larger than the button and is positioned out
   * of flow, centred on it: the button is the hitbox and the animation plays in
   * the space around it. This is the live site's signature move and the reason
   * these buttons read as Rive rather than as CSS.
   *
   * "inline" — the canvas is a small mark sitting in normal flow beside a DOM
   * label. Used where the file is a decorative mark rather than a button face.
   */
  layout: "overflow" | "inline";
  /**
   * CSS width the canvas renders at. Height follows the artboard ratio, so the
   * .riv never distorts. Defaults to the artboard's own width.
   */
  renderWidth?: number;
  /**
   * Where the BUTTON's centre sits inside the canvas, as fractions of the canvas
   * box. This is what aims the overflow: the canvas is absolutely positioned so
   * that this point lands on the button's centre, and everything else hangs
   * wherever the art wants it.
   *
   * anchorY < 0.5 → the art hangs mostly BELOW the button (the cat).
   * anchorY > 0.5 → the art rides mostly ABOVE it (the rocket).
   *
   * Absolute positioning means none of it is in flow, so no amount of overflow
   * can move layout or cause a shift — which is why there is no reservation
   * anywhere in this system.
   */
  anchorX?: number;
  anchorY?: number;
}

/**
 * NAV CTA — the cat.
 *
 * CONFIRMED MAP (probe, 2026-07-31): artboard "Cat" 269×150, state machine
 * "Motion", five boolean inputs and no view models. Timelines: Idle, Left,
 * Left_end, Left2, Left2_end, Right, Right_end, Right2 — a five-zone lean.
 *
 * ⚠ `isHovercenter` IS SPELLED WITH A LOWERCASE "c". That is the file's own
 * internal name, not a typo here — the same situation as the "Recticle"
 * artboard in useCaseContent.ts. It must stay misspelled to match the file.
 *
 * Zones map left→right across the hitbox. The two outer pairs drive the bigger
 * Left2/Right2 leans, which is why they take the edges.
 */
export const GET_STARTED_CAT: RiveSiteAsset = {
  src: "/rive/site/get-started-cat.riv",
  artboard: "Cat",
  stateMachine: "Motion",
  width: 269,
  height: 150,
  bytes: 12_747,
  layout: "overflow",
  /* PROBED: hasListeners = false. The file contains shapes named Hitbox_left /
     Hitbox_right / Hitbox_left2 / Hitbox_right2, which read exactly like
     listener targets and are NOT — nothing in the machine listens. Driving the
     five bools from the button's own hover is therefore correct, and a pointer
     outside the button provokes nothing. */
  pointer: "manual",
  /* Canvas top sits a little above the button; the cat hangs below and around,
     which is how it overflows downward out of the nav bar. */
  anchorX: 0.5,
  anchorY: 0.2,
  /* ZONES ARE NESTED, NOT EXCLUSIVE — measured, and it matters a great deal.
     `isHoverLeft2` is the EXTREME lean and only fires while `isHoverLeft` is
     also set; the "2" inputs escalate the plain ones rather than replacing them.
     Non-transparent pixel delta vs idle, by pointer position across the button:

       x            0.05  0.15  0.30  0.50  0.70  0.85  0.95
       exclusive       0     0    13     0    10     0     0
       nested        152   172    19     0    14   176   167

     Exclusive zones left three of the five inputs doing literally nothing (sd
     0.000 — the same rendered frame as idle), so the cat leaned two ways
     instead of four and the extremes never appeared at all.

     `isHovercenter` measures as no change, which is the correct outcome rather
     than a dead input: centre is the neutral forward pose, visually the same as
     idle. It is wired so the machine is told explicitly, instead of the cat
     holding a lean when the pointer reaches the middle. */
  declaredInputs: [
    { name: "isHoverLeft2", zone: [0, 0.2] },
    { name: "isHoverLeft", zone: [0, 0.4] },
    /* Lowercase "c" — the file's spelling. Do not "fix". */
    { name: "isHovercenter", zone: [0.4, 0.6] },
    { name: "isHoverRight", zone: [0.6, 1] },
    { name: "isHoverRight2", zone: [0.8, 1] },
  ],
  paintsOwnLabel: true,
};

/**
 * HERO PRIMARY CTA — the rocket.
 *
 * CONFIRMED MAP (probe, 2026-07-31): artboard "Button" 500×500, state machine
 * "Motion", and exactly ONE input — `isHover` (bool). A second artboard
 * "ChargeLight" (10×10) carries no state machine; it is a nested component.
 *
 * ⚠ CORRECTION TO THE RECON: the pre-probe reading of the binary suggested
 * "isHover with Smoke/NoSmoke states". The states are real but they are
 * TIMELINES (NoSmoke, SmokeIdle 20s, HoverSmoke), not inputs — there is nothing
 * to drive them with. `isHover` is the entire integration surface; the smoke is
 * the file's own response to it. Wiring anything else would have been inventing
 * an input, which is precisely what the probe exists to prevent.
 */
export const GET_STARTED_ROCKET: RiveSiteAsset = {
  src: "/rive/site/get-started-rocket.riv",
  artboard: "Button",
  stateMachine: "Motion",
  width: 500,
  height: 500,
  bytes: 45_161,
  layout: "overflow",
  /* PROBED: hasListeners = true — despite carrying no hitbox-named shape, the
     inverse of the cat. But MEASURED: those listeners are INERT in this
     integration, so the file is driven manually. See `listenersInert`.

     The A/B, same build, only the model changed (500x500 canvas, non-transparent
     pixel count over 5 trials of 10 frames):
       pointer: "listeners"  idle 577 ±11.4 → hover 584   Δ 7   (inside noise)
       pointer: "manual"     idle 577 ±11.5 → hover 3405  Δ 2828
     The canvas was confirmed hit-testable in both (`pointer-events: auto`,
     elementFromPoint returns the canvas) and the events were real CDP mouse
     input, not JS-dispatched — so this is not a plumbing failure on our side.
     `hasListeners` is necessary but not sufficient: it reports that listener
     objects exist, not that they drive anything reachable. */
  pointer: "manual",
  /**
   * The file reports listeners that do not fire. Recorded explicitly so
   * `check:assets` can tell this apart from someone quietly mis-wiring a
   * listeners file — without this flag, a "manual" model on a file that has
   * listeners fails the parity check, which is the behaviour we want by default.
   */
  listenersInert: true,
  /* The button sits in the canvas's lower third, so the rocket rides above it. */
  anchorX: 0.5,
  anchorY: 0.78,
  declaredInputs: [{ name: "isHover", zone: [0, 1] }],
  paintsOwnLabel: true,
};

/**
 * HERO SECONDARY CTA — the shuffling R.
 *
 * CONFIRMED MAP (probe, 2026-07-31): artboard "R_logo_shuffle" 120×120, state
 * machine "State Machine 1", ONE 3s timeline, and NO INPUTS AT ALL.
 *
 * ⚠ CORRECTION TO THE BRIEF: this file is autonomous. There is nothing to
 * forward pointer events to, so it is not a hover-driven button mark — it just
 * loops. It also embeds no font and no text, unlike both GET STARTED files, so
 * the "DOWNLOADS" label MUST be rendered in the DOM. `paintsOwnLabel: false`
 * is what encodes that.
 */
export const R_LOGO_SHUFFLE: RiveSiteAsset = {
  src: "/rive/site/r-logo-shuffle.riv",
  artboard: "R_logo_shuffle",
  stateMachine: "State Machine 1",
  width: 120,
  height: 120,
  bytes: 3_089,
  /* Inline, not overflow: this is a 120x120 mark that sits beside the DOWNLOADS
     label, not a button face with animation spilling around it. */
  layout: "inline",
  renderWidth: 22,
  /* PROBED: hasListeners = false, and no inputs either. Nothing to drive and
     nothing to receive — it just plays. */
  pointer: "none",
  declaredInputs: [],
  paintsOwnLabel: false,
};

/** Everything committed under public/rive/site/, for the asset checker. */
export const RIVE_SITE_ASSETS = [
  GET_STARTED_CAT,
  GET_STARTED_ROCKET,
  R_LOGO_SHUFFLE,
];
