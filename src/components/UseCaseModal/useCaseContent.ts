/* ──────────────────────────────────────────────────────────────────────────
 * USE-CASE CONTENT MODEL (spec §4)
 *
 * All modal copy/media/stats live here as typed data: adding a use case or
 * swapping a hero is a data edit, not a component edit — that is the
 * design-system argument the section exists to make.
 *
 * PROVENANCE RULE: every claim below is sourced from the build spec's research
 * section or from copy already approved in this repo (UseCaseBento cells,
 * WorkflowStack, Home hero). Nothing is invented.
 *
 * PENDING (needs real assets/URLs before ship — deliberately not faked):
 * - Product UI hero .riv (taste decision T1). Modeled as `type: "pending"` so
 *   the slot renders a labeled placeholder, never a broken canvas (§8).
 * - CommunityStrip thumbnails: real marketplace files + creators.
 * - Tier 2 proof copy is capability-level, drawn from claims already made in
 *   WorkflowStack/Home; it still wants a marketing sign-off pass.
 * ────────────────────────────────────────────────────────────────────────── */

import healthBarRivUrl from "../../assets/rive/health_bar_use_case.riv?url";
import noseyRivUrl from "../../assets/rive/nosey.riv?url";
import avatarRivUrl from "../../assets/rive/character_animation.riv?url";
import drivingRivUrl from "../../assets/rive/driving_ui_concept.riv?url";
import reticleRivUrl from "../../assets/rive/sci_fi_reticle.riv?url";

export type UseCaseTier = "full" | "lite";

export interface HeroCredit {
  /** File name, e.g. "Health Bar Use Case". */
  file: string;
  creator: string;
  /**
   * Where the credit chip links — the marketplace page for a community file, or
   * the project a first-party character comes from. Optional: with no URL the
   * chip renders as plain text rather than a dead link.
   */
  href?: string;
  /** The creator's profile. */
  creatorUrl?: string;
  /**
   * Community files earn the "· from the community" suffix — it is the social
   * proof half of the credit. First-party work must not claim it.
   */
  provenance: "community" | "first-party";
  /**
   * Licence the file ships under. For a community file under CC the credit is a
   * legal requirement, not decoration, so it renders in every state including
   * mobile. Surfaced via tooltip/aria rather than visible copy.
   */
  license?: string;
}

/**
 * A first-party hero whose state is driven through data binding: the rail is both
 * live status readout and control surface (spec §5 first-party mode).
 */
export interface HeroStateRail {
  /** ViewModel enum property carrying the state. */
  property: string;
  /**
   * Curated display order. The runtime is still the source of truth for which
   * values exist — anything the file has that is not listed here is appended, so
   * this ordering can never silently drop a state.
   */
  order: string[];
  /** The auto-cycle walk. Sustained states only. */
  autoCycle: string[];
  /** Values that play once; the rail returns to `rest` when the shot is done. */
  oneShots: string[];
  /** The resting value. */
  rest: string;
}

/**
 * Where the ghost cursor should travel, as a fraction of the hero box. The hero
 * container is locked to the artboard's aspect ratio and the canvas uses
 * Fit.contain, so artboard coordinates map linearly onto the element box.
 */
export interface GhostTarget {
  x: number;
  y: number;
  /** Shown instead of the animated ghost under prefers-reduced-motion. */
  hint: string;
}

export type UseCaseHero =
  | {
      type: "riv";
      src: string;
      artboard?: string;
      stateMachine?: string;
      /** Artboard dimensions — locks the hero box so coordinates map cleanly. */
      width: number;
      height: number;
      credit: HeroCredit;
      /** Caption under the hero, explaining what the interaction demonstrates. */
      caption?: string;
      /** Third-party mode: a ghost cursor demonstrates one pointer interaction. */
      ghost?: GhostTarget;
      /** First-party mode: state is data-bound and exposed as a control rail. */
      rail?: HeroStateRail;
      /** Caps a square/tall artboard so it does not dominate the sheet. */
      maxWidth?: number;
      /**
       * The file's own logic reads view-model properties, so the runtime must bind
       * an instance (`autoBind`). Opt-in per hero, not a default: the runtime logs
       * "Could not find a View Model linked to Artboard …" for files that only use
       * legacy state-machine inputs.
       */
      autoBind?: boolean;
      /** File size, so hover-preload can skip assets too heavy to speculate on. */
      bytes?: number;
      /** Rendered if the canvas fails to load (§8: never a broken canvas). */
      fallbackLabel: string;
    }
  | { type: "image"; src: string; alt: string; credit?: HeroCredit }
  /** v1 placeholder: the real community file has not been wired yet (§8). */
  | { type: "pending"; label: string };

export interface ProofItem {
  /** Brand or source of the claim. */
  source: string;
  claim: string;
  /** One number, when there is a real one to quote. */
  stat?: string;
}

export interface UseCaseQuote {
  text: string;
  attribution: string;
}

export interface UseCaseContent {
  slug: string;
  tier: UseCaseTier;
  eyebrow: string;
  /** Prose form of the name, for running copy ("Everything about Game UI →"). */
  name: string;
  /** The modal's H2 — the claim, in Tomorrow display face. */
  claim: string;
  hero: UseCaseHero;
  proof: ProofItem[];
  quote?: UseCaseQuote;
  runtimes: string[];
  /**
   * The escape valve: the full use-case page, deliberately last (§4). Optional —
   * when a use case has no page of its own (Campaigns, whose depth lives in the
   * CaseStudies section), the modal simply ends at "Get started".
   */
  pageHref?: string;
}

const EDITOR_URL = "https://editor.rive.app";

export const USE_CASES: UseCaseContent[] = [
  /* ---------------------------------------------------------- Tier 1 ----- */
  {
    slug: "product-ui",
    tier: "full",
    eyebrow: "PRODUCT UI",
    name: "Product UI",
    claim: "Interfaces that respond in real time",
    /* ──────────────────────────────────────────────────────────────────────
     * CONFIRMED MAP — NotionAI 2 / Test  (taste decision T1: Nosey)
     * Read from the live file via the Rive MCP, with the enum table confirmed
     * against the .riv binary. Nothing here is inferred from names.
     *
     * Artboard      NotionAI 2   1000 × 1000 (square — hence the maxWidth cap)
     * StateMachine  Test         isDefault, one layer
     * Legacy inputs none         · Listeners none  → purely data-bound
     * ViewModel     NoseyViewModel
     * Enum property agentStatus  (custom enum, 9 values, all lowercase)
     *
     * Values: idle · thinking · searching · writing · greeting · error ·
     *         completed · nerd · cool
     *
     * FIRST-PARTY MODE (spec §5): we own this file, so state is driven through
     * the data-binding API — `viewModelInstance.enum("agentStatus")` — never via
     * synthetic pointer events. The runtime's `.values` is the source of truth
     * for which states exist and `.on()` reports changes, so the rail shows the
     * machine's actual state rather than what we hoped a click did.
     *
     * HOUSE RULE — COMPLIANT. There are zero transitions out of the Any State
     * (it exists but is unused), and every sustained loop exits on an
     * `agentStatus != <value>` enum condition: Searching_Loop, Thinking_Loop,
     * Writing_Loop, Nerd_Loop, Cool_In. Clean exits throughout.
     *
     * CAVEAT — greeting / error / completed are one-shots: they return to Idle
     * on exit-time with no condition, but the enum stays set, so Idle re-enters
     * them and they would loop forever. The .riv is left alone; the rail returns
     * agentStatus to `idle` once the shot has played (see `oneShots` below).
     * ────────────────────────────────────────────────────────────────────── */
    hero: {
      type: "riv",
      src: noseyRivUrl,
      bytes: 237_722,
      artboard: "NotionAI 2",
      stateMachine: "Test",
      width: 1000,
      height: 1000,
      maxWidth: 480,
      caption:
        "Agent states as an enum — driven by data, controllable at any time.",
      credit: {
        file: "Nosey",
        creator: "Uko Ekpenyong",
        href: "https://nosey-demo-pitch.vercel.app/pitch",
        provenance: "first-party",
        license: "Original work",
      },
      rail: {
        property: "agentStatus",
        /* Lifecycle arc first, personality tail last. */
        order: [
          "idle",
          "thinking",
          "searching",
          "writing",
          "completed",
          "error",
          "greeting",
          "nerd",
          "cool",
        ],
        /* The ambient walk uses sustained states only, so nothing self-loops. */
        autoCycle: ["idle", "thinking", "searching", "writing"],
        oneShots: ["greeting", "error", "completed"],
        rest: "idle",
      },
      fallbackLabel: "NOSEY — AGENT STATES, DRIVEN BY DATA",
    },
    proof: [
      {
        source: "Notion",
        claim: "Built their assistant entirely in Rive.",
        stat: "2× engagement",
      },
      {
        source: "Duolingo",
        claim: "UI running across their language, math, and music apps.",
      },
      {
        source: "Intercom",
        claim: "Migrated from Lottie to Rive.",
      },
    ],
    runtimes: [
      "iOS",
      "Android",
      "Flutter",
      "React Native",
      "Web",
      "Framer",
      "Webflow",
    ],
    pageHref: "https://rive.app/use-cases/product-design",
  },
  {
    slug: "game-ui",
    tier: "full",
    eyebrow: "GAME UI",
    name: "Game UI",
    claim: "Menus, HUDs, and 2D graphics — running, not rendered.",
    /* ──────────────────────────────────────────────────────────────────────
     * CONFIRMED INPUT MAP — healthBar_SM
     * Read from the live file via the Rive MCP (not guessed). All five inputs
     * are legacy state-machine inputs and every one is `isPublic: false`, so we
     * do NOT drive them through `stateMachineInputs`. The file already carries
     * pointer listeners, so the ghost dispatches real pointer events instead —
     * spec §5's third-party mode, and it works regardless of input visibility.
     *
     * Inputs (name · type · default)
     *   healthMinusAdvance · trigger · —     fired by hovering `characterHit`
     *   healthPlusAdvance  · trigger · —     fired by hovering `healthIconBG`
     *   healthMinus        · number  · 0
     *   healthPlus         · number  · 100
     *   lookDirection      · number  · 0     -1 left / 0 middle / 1 right
     *
     * Pointer listeners (all `enter`, i.e. hover — nothing needs a click)
     *   characterHit  (3-43) @ root 742.8,800.2   → healthMinusAdvance
     *   healthIconBG  (3-22) @ root 1466.9,1272.9 → healthPlusAdvance
     *   lookLeft / middle / lookRight            → lookDirection -1 / 0 / 1
     *
     * "Damage" (what the ghost demonstrates) = hover `characterHit`, which fires
     * healthMinusAdvance. That advances the `damage` layer full health →
     * 50 percent health and plays one of hitAnimation / hitAnimationLeft /
     * hitAnimationRight (selected by lookDirection), with the bar sweeping over
     * a 500ms cubic. Hovering the health icon heals it back, so the demo is
     * self-resetting — the ghost never needs to restore state.
     *
     * The hit states fire two events, `hitSoundEffect` (onEnter) and
     * `afterHitSaying` (onExit). Both are reported signals with NO embedded
     * audio playback, and we deliberately do not subscribe to either.
     * IMPORTANT: nothing may subscribe to them without revisiting the ghost's
     * idle cadence — a 6s loop that emits a sound effect would be hostile.
     * ────────────────────────────────────────────────────────────────────── */
    hero: {
      type: "riv",
      src: healthBarRivUrl,
      bytes: 694_680,
      artboard: "healthBar",
      stateMachine: "healthBar_SM",
      width: 3000,
      height: 1750,
      credit: {
        file: "Health Bar Use Case",
        creator: "drawsgood",
        href: "https://rive.app/marketplace/6510-12634-health-bar-use-case/",
        creatorUrl: "https://rive.app/@drawsgood/",
        provenance: "community",
        license: "CC BY",
      },
      caption: "Hover the character — the bar responds, then heals back.",
      /* Normalized from the queried root coordinates: 742.8/3000, 800.2/1750. */
      ghost: {
        x: 0.248,
        y: 0.457,
        hint: "Hover the character to take damage",
      },
      fallbackLabel: "HEALTH BAR — HOVER TO TAKE DAMAGE",
    },
    proof: [
      {
        source: "Pocketwatch Games",
        claim: "Shipped Monaco 2's interface in Rive.",
      },
      {
        source: "Rive Renderer",
        claim:
          "Unprecedented vector counts with analytic antialiasing, on the GPU.",
      },
      {
        source: "One toolset",
        claim: "Audio, state, and text — everything menus and HUDs need.",
      },
    ],
    quote: {
      text: "If you enjoy making games and don't hate yourself, use Rive.",
      attribution: "Joseph Riedel, CTO, Pocketwatch Games",
    },
    runtimes: ["Unity", "Unreal", "Defold", "Custom engines"],
    pageHref: "https://rive.app/game-ui",
  },

  /* ---------------------------------------------------------- Tier 2 ----- */
  {
    slug: "websites",
    tier: "lite",
    eyebrow: "WEBSITES",
    name: "Websites",
    claim: "Sites that respond to every visitor",
    /* ──────────────────────────────────────────────────────────────────────
     * CONFIRMED MAP — Avatar / State Machine 1  (Tier 2 hero promotion)
     * Read from the live file via the Rive MCP; the committed .riv is
     * byte-identical to the export that was inspected.
     *
     * Artboards     Text 345x500 · Burst 500x500 · Avatar 2083x2083 ·
     *               Me 3354x3243. `Me` is a composition surface — its state
     *               machine holds a single 1.0s timeline and no interactivity.
     *               `Avatar` is the hero, and the only interactive artboard.
     * StateMachine  State Machine 1 (isDefault), 9 layers: Eyes.Track,
     *               Head.Track, Eyes.Blink, Head.Bob, Breathing, R.HighFive,
     *               L.HighFive, Face.React, Burst.
     *               (A second, non-default "State Machine 2" exists; unused.)
     * ViewModel     AvatarViewModel — the file's legacy state-machine inputs were
     *               converted to view-model properties in the editor, so
     *               `inputs` is now empty. Same five names, same roles:
     *                 Pointer.Tracking   boolean
     *                 Head.Bob.Amount    number
     *                 Full.Hitbox.Click  trigger
     *                 L.Half.Click       trigger
     *                 R.Half.Click       trigger
     *
     * THE FILE IS SELF-DRIVING — the conversion did not change that. All seven
     * listeners still target shapes inside the file and now write those view-model
     * properties themselves (`viewModelChange` where they used to be
     * trigger/bool/numberChange), so the visitor's real cursor remains the only
     * thing needed: no synthetic events, no ghost, no property writes from our
     * side, and nothing here worth a dial.
     *   Full.Hitbox enter → Pointer.Tracking=true,  Head.Bob.Amount=0.5
     *   Full.Hitbox exit  → Pointer.Tracking=false, Head.Bob.Amount=1.0
     *   Eyes.Tracker + Joystick.Handle → alignTarget (Rive's built-in
     *     pointer-follow: the eyes and head track the cursor) — survived intact,
     *     along with the alignTarget on each click hitbox.
     *   L.Half / R.Half click → L.HighFive / R.HighFive
     *   Full.Hitbox click → Face.React + Burst
     *
     * IMPORTANT: because the file's own conditions now read view-model properties,
     * this hero sets `autoBind: true` — the runtime defaults it to false, and with
     * no bound instance the character would play its idle loops and never react.
     * It is opt-in per hero rather than always-on: enabling it for a legacy-input
     * file (Health Bar) makes the runtime log "Could not find a View Model linked
     * to Artboard healthBar" on every open.
     *
     * Idle behaviour is ambient and unconditional from Entry — Eyes.Blink (20s),
     * Idle.Breathing (5s), Head.Bob (4s), Burst.Idle — so the character is alive
     * before anyone interacts. The caption carries the click invitation, since a
     * high-five is not otherwise discoverable.
     *
     * HOUSE RULE — COMPLIANT, and now in letter as well as spirit. Still zero
     * transitions out of the Any State across all nine layers. Sustained states
     * exit on `viewModelComparison` against Pointer.Tracking (explicit == true /
     * == false), which is exactly the view-model property condition the rule
     * prefers; one-shots exit on exit-time. The .riv was not modified by us.
     * ────────────────────────────────────────────────────────────────────── */
    hero: {
      type: "riv",
      src: avatarRivUrl,
      bytes: 386_457,
      artboard: "Avatar",
      stateMachine: "State Machine 1",
      width: 2083,
      height: 2083,
      /* Square, and this is a lite modal — kept a step below Nosey's 480 so the
         hero supports the copy rather than dominating it. */
      maxWidth: 420,
      /* The conversion to AvatarViewModel makes this mandatory — see the note in
         the map block above. */
      autoBind: true,
      caption:
        "He tracks your cursor and high-fives when you click — the kind of moment Rive puts on a marketing site.",
      credit: {
        file: "Uko",
        creator: "Uko Ekpenyong",
        provenance: "first-party",
        license: "Original work",
        /* href omitted deliberately — the chip renders as plain text until a URL
           is supplied, rather than becoming a dead link. */
      },
      fallbackLabel: "UKO — CURSOR-TRACKING CHARACTER",
    },
    proof: [
      {
        source: "One file",
        claim: "The same graphic runs on the web that you designed in Rive.",
      },
      {
        source: "No handoff",
        claim: "Design, animate, and wire up behavior in one tool.",
      },
    ],
    runtimes: ["Web", "Framer", "Webflow"],
    pageHref: "https://rive.app/use-cases/websites",
  },
  {
    slug: "automotive",
    tier: "lite",
    eyebrow: "AUTOMOTIVE",
    name: "Automotive",
    claim: "Dashboards at 120fps",
    /* ──────────────────────────────────────────────────────────────────────
     * CONFIRMED MAP — Artboard / Startup-SM  (Tier 2 hero promotion)
     * Artboards/state machines/inputs/view models were read with the Rive
     * runtime itself (see .context/probe — the standard fallback when the MCP
     * has no file open); listeners and the house-rule check came from the MCP.
     *
     * Artboard      "Artboard" 3534 × 1626 (2.173:1) — full-width, no cap.
     *               12 further artboards are nested components: Start Button,
     *               Eco, Sport, Autonomous (each Click + isHovered), plus
     *               Power, Ambient, Terrain, Accelerator, Sensor,
     *               Map Navigation, Weatther [sic], Battery.
     * StateMachine  Startup-SM (isDefault), 10 layers: Speedometer, Navigation,
     *               Icons, Accelerator, Speed Control, Speed Blend, Nav Control,
     *               Nav Move, Gear State, Driving Mode Color.
     * A HYBRID FILE: legacy state-machine inputs AND view models.
     *   Inputs: dashboardReady (bool), isAccelerating (bool), Click (trigger)
     *   ViewModels: DashboardVM (default) — drivingMode (enum), speedValue,
     *     speedControl, arcValue, navArrowControl, naArrowDistance [sic]
     *     (numbers), primaryColor/secondaryColor (colors), gear (string),
     *     weatherTrigger (bool), propertyOfAcceleratingVM (viewModel);
     *     AcceleratingVM — confirmed (trigger), pressBoolean, hover (bools).
     *
     * THIRD-PARTY POLICY: we never write its inputs or view-model properties.
     * `autoBind: true` only binds the default DashboardVM instance so the file's
     * own bindings (gear text, speed, colours) have somewhere to read from —
     * reading its bindings is not driving it.
     *
     * Listeners (3, all on the main artboard):
     *   HitBox            click     → fires Click, which starts the boot
     *                                 sequence: Speedometer/Nav/Icons/
     *                                 Accelerator "appears", and dashboardReady
     *                                 is set as "Accelerator appears" exits.
     *   AcceleratorHitBox down / up → isAccelerating + AcceleratingVM.pressBoolean
     *                                 (press-and-hold to accelerate)
     * No ghost cursor: four self-announcing controls with their own hover states
     * make this a freely explorable panel, not one hidden affordance — and the
     * primary interaction is a click, which the ghost cannot yet demonstrate
     * (see the boundary note in GhostCursor.tsx).
     *
     * HOUSE RULE — MEASURED: 9 of 10 layers clean, 1 violation. Informational
     * only; this is a community file and it was NOT modified.
     *   ✓ Nine layers have zero transitions out of their Any State.
     *   ✗ "Driving Mode Color" fans out from the Any State: three transitions
     *     Any → Eco/Sport/Auto Color, each conditioned on a DashboardVM
     *     `drivingMode` enum comparison, and the colour states carry no exits of
     *     their own. The conditions are enum-based, but the source is Any State,
     *     which is the pattern the rule exists to discourage.
     * ────────────────────────────────────────────────────────────────────── */
    hero: {
      type: "riv",
      src: drivingRivUrl,
      artboard: "Artboard",
      stateMachine: "Startup-SM",
      width: 3534,
      height: 1626,
      /* Required: the file's own conditions read DashboardVM (see above). */
      autoBind: true,
      bytes: 4_101_251,
      caption:
        "Press start and the cluster boots — a concept dashboard running live, not a video of one.",
      credit: {
        file: "Futuristic Driving UI Concept",
        creator: "Noushin.Pourmirza",
        href: "https://rive.app/marketplace/27835-52594-futuristic-driving-ui-concept/",
        creatorUrl: "https://rive.app/@Noushin.Pourmirza",
        provenance: "community",
        license: "CC BY",
      },
      fallbackLabel: "FUTURISTIC DRIVING UI — PRESS START",
    },
    proof: [
      {
        source: "Embedded",
        claim: "The same file runs natively on embedded devices.",
      },
      {
        source: "Live data",
        claim: "View models bind the design to real vehicle data.",
      },
    ],
    runtimes: ["Embedded devices"],
    pageHref: "https://rive.app/use-cases/automotive",
  },
  {
    slug: "film-tv-broadcast",
    tier: "lite",
    eyebrow: "FILM, TV & BROADCAST",
    name: "Film, TV & Broadcast",
    claim: "Live graphics that never miss",
    /* ──────────────────────────────────────────────────────────────────────
     * CONFIRMED MAP — Recticle / State Machine 1  (Tier 2 hero promotion)
     * Read from the live file via the Rive MCP. Two marketplace-derived hints
     * were wrong and are corrected here: the artboard is not "New Artboard",
     * and this is not a legacy-input file.
     *
     * NOTE ON THE SPELLING: the artboard is genuinely named "Recticle" — the
     * typo is the file's own internal name, not ours. Our asset filename uses
     * the correct spelling (sci_fi_reticle.riv), so the two differ on purpose;
     * the artboard string below must stay misspelled to match the file.
     *
     * Artboard      Recticle  500 × 500 (square — hence the maxWidth cap)
     * StateMachine  State Machine 1 (isDefault), 2 layers: main, loop
     * Legacy inputs NONE
     * ViewModel     RecticleViewModel — offOn (boolean)
     *
     * Layers
     *   main  mainIdle ⇄ main, gated on viewModelComparison against `offOn`
     *         (== true engages, == false returns over a 300ms cubic)
     *   loop  plays `loop` unconditionally from Entry — ambient idle, so the
     *         reticle is alive before anyone interacts
     *
     * Listeners (2, both targeting the same `hit` shape):
     *   alignTarget      → THE RETICLE TRACKS THE POINTER. This is the real
     *                      draw, and it means any cursor movement already gives
     *                      feedback — nothing about this hero is hidden.
     *   viewModelChange  → toggles RecticleViewModel.offOn (the lock-on).
     *   CAVEAT: the MCP reported `listenerTypes: []` for both, where other files
     *   (e.g. the automotive dashboard) reported click/down/up explicitly. So the
     *   toggle's exact gesture is not provable from the map; it was confirmed
     *   behaviourally instead — a click engages and a second click releases.
     *
     * THIRD-PARTY POLICY: we never write its view-model property. `autoBind` is
     * required all the same — the file's own transitions read `offOn`, so with no
     * bound instance the toggle would silently never fire. Reading its bindings
     * is not driving it.
     *
     * No ghost cursor: the reticle already follows the pointer, so the hero
     * announces itself on any movement; the toggle is click-gated, which is
     * outside GhostCursor's hover-only vocabulary; and a synthetic cursor would
     * collide with a graphic whose whole subject is a cursor-tracking crosshair.
     *
     * CREDIT: drawsgood is intentionally credited on two heroes — this one and
     * the Game UI health bar. Both are their marketplace files under CC BY.
     *
     * HOUSE RULE — MEASURED: fully compliant, in letter and spirit. Zero
     * transitions out of the Any State in either layer, and the sustained states
     * exit on a view-model property comparison. The .riv was not modified.
     * ────────────────────────────────────────────────────────────────────── */
    hero: {
      type: "riv",
      src: reticleRivUrl,
      /* Misspelled on purpose — see the note above. */
      artboard: "Recticle",
      stateMachine: "State Machine 1",
      width: 500,
      height: 500,
      maxWidth: 420,
      /* Required: the file's own transitions read RecticleViewModel.offOn. */
      autoBind: true,
      bytes: 813_463,
      caption:
        "It follows your cursor — click to lock on. Screen graphics like this usually get rendered in post; here they run live.",
      credit: {
        file: "Sci-fi reticle",
        creator: "drawsgood",
        href: "https://rive.app/marketplace/7751-14934-sci-fi-reticle/",
        creatorUrl: "https://rive.app/@drawsgood/",
        provenance: "community",
        license: "CC BY",
      },
      fallbackLabel: "SCI-FI RETICLE — CLICK TO LOCK ON",
    },
    proof: [
      {
        source: "Live data",
        claim: "Numbers and text update the moment the data does.",
      },
      {
        source: "State machines",
        claim: "Graphics respond to the moment, not a fixed timeline.",
      },
      /* Broadcast is folded in here as a proof line rather than a second escape
         valve — one cell, one link (the richer film-tv destination). */
      {
        source: "Broadcast",
        claim: "Live data drives on-air graphics from the same file.",
      },
    ],
    runtimes: ["Web", "Embedded devices"],
    pageHref: "https://rive.app/use-cases/film-tv",
  },
  {
    slug: "campaigns",
    tier: "lite",
    eyebrow: "CAMPAIGNS",
    name: "Campaigns",
    claim: "Brand moments like Spotify Wrapped",
    hero: { type: "pending", label: "LIVE .RIV — CAMPAIGN MOMENT" },
    proof: [
      {
        source: "Spotify Wrapped",
        claim: "Built in Rive.",
        stat: "300M users engaged",
      },
      {
        source: "Spotify Wrapped",
        claim: "Shared across the world in a single campaign.",
        stat: "630M shares",
      },
    ],
    runtimes: ["iOS", "Android", "Web"],
    /* No pageHref: there is no Campaigns use-case page, and the Spotify
       Wrapped depth lives in the CaseStudies section. This modal ends at
       "Get started" — the case the optional field exists for. */
  },
];

export function getUseCase(slug: string): UseCaseContent | undefined {
  return USE_CASES.find((useCase) => useCase.slug === slug);
}

/** Files already requested this session — a .riv is fetched at most once. */
const preloaded = new Set<string>();

/** Policy, not a feel parameter: too heavy to fetch on a guess. */
export const PRELOAD_MAX_BYTES = 1_000_000;

/** Whether a hover is worth speculatively fetching this hero's file for. */
export function shouldPreloadHero(hero: UseCaseHero): boolean {
  if (hero.type !== "riv") return false;
  return (hero.bytes ?? 0) <= PRELOAD_MAX_BYTES;
}

/**
 * Warm the HTTP cache for a hero's .riv on hover intent, so the canvas has a
 * head start by the time the modal opens. Fire-and-forget: a failed preload is
 * not an error, the real load will surface it (and fall back per §8).
 */
export function preloadHero(hero: UseCaseHero): void {
  if (hero.type !== "riv" || preloaded.has(hero.src)) return;
  if (!shouldPreloadHero(hero)) return;
  preloaded.add(hero.src);
  void fetch(hero.src, { credentials: "same-origin" }).catch(() => {
    /* Let the real load report the problem. */
    preloaded.delete(hero.src);
  });
}

export { EDITOR_URL };
