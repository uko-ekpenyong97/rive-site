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

/** A boolean state-machine input driven by pointer hover. */
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
   * Hover inputs confirmed by probe. EMPTY means the file is autonomous — it
   * has no inputs at all and simply plays. Never invent an input here: the
   * probe is the source of truth.
   */
  hoverInputs: RiveHoverInput[];
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
  hoverInputs: [
    { name: "isHoverLeft2", zone: [0, 0.2] },
    { name: "isHoverLeft", zone: [0.2, 0.4] },
    /* Lowercase "c" — the file's spelling. Do not "fix". */
    { name: "isHovercenter", zone: [0.4, 0.6] },
    { name: "isHoverRight", zone: [0.6, 0.8] },
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
  hoverInputs: [{ name: "isHover", zone: [0, 1] }],
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
  hoverInputs: [],
  paintsOwnLabel: false,
};

/** Everything committed under public/rive/site/, for the asset checker. */
export const RIVE_SITE_ASSETS = [
  GET_STARTED_CAT,
  GET_STARTED_ROCKET,
  R_LOGO_SHUFFLE,
];
