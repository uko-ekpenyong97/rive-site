import { useEffect, useRef, useState } from "react";
/* WebGL2 build — the same runtime LoopCanvas and RiveHero already pull into the
 * Home entry chunk. These three canvases therefore add no runtime weight at all,
 * only the 4.3 kB of .riv they fetch between them. */
import { useRive } from "@rive-app/react-webgl2";
import glyphsRivUrl from "../assets/rive/audience_glyphs.riv?url";
import "./AudienceGlyph.css";

/* ──────────────────────────────────────────────────────────────────────
 * CONFIRMED MAP — audience_glyphs.riv  (three artboards, one contract)
 *
 * Read from the live file via the Rive MCP on 2026-07-28 with the file open in
 * the editor. Nothing here is inferred from names.
 *
 * ONE BLOCK, NOT THREE: the house format is one block per artboard, but all
 * three implement an identical contract — same state-machine name, same view
 * model, same transition shape — and differ only in loop duration and cast. The
 * per-artboard rows below record strictly more than three near-identical blocks
 * would, so this is one table instead.
 *
 * Artboard       GlyphDeveloper (0-2) · GlyphAnimator (0-577) · GlyphDesigner (0-957)
 *                all 240 × 200
 * StateMachine   Glyph_SM on each, isDefault. Developer and Animator have one
 *                layer; Designer has two (Layer 1 + "Handles", the +2 handle
 *                enlargement from spec §3.1).
 * Legacy inputs  NONE — `inputs: []` on all three. Hover is a VIEW-MODEL
 *                property, not a state-machine input, so driving it through
 *                stateMachineInput("hover") would silently no-op.
 * ViewModel      GlyphVM (0-285), one instance "Instance" (0-286)
 *                  hover        boolean  default false
 *                  strokeColor  color    default #8A8F98  (ARGB 4287270808)
 *                  accentColor  color    default #FFA41C  (ARGB 4294943772)
 * Timelines      Idle_Loop  Developer 13s · Animator 11s · Designer 9s (spec §6)
 *                Rest       1 frame (0.0167s) on each — the reduced-motion pose
 *                Designer also carries Handles_Idle / Handles_Hover, 1 frame each
 *
 * HOVER IS A BLEND, NOT A SECOND TIMELINE: `Hover_Loop` is a *state* pointing at
 * the same Idle_Loop animation at a differentiated speed — spec §4 explicitly
 * permits this ("duplicate timeline or speed-differentiated state"). There is no
 * Hover_Loop *animation* to play by name; only the state exists.
 *
 * REST IS NOT A STATE: `Rest` is a linear animation and is deliberately absent
 * from Glyph_SM. The reduced-motion path therefore instantiates with
 * `animations: "Rest"` and NOT `stateMachines` — naming the machine would start
 * Idle_Loop, which is the exact thing reduced motion is here to prevent.
 *
 * Listeners      NONE in-file (spec §4). The rail is the hover surface and is far
 *                larger than the canvas, so hover is detected in code and written
 *                to GlyphVM.hover. An in-file listener would only ever see the
 *                canvas hitbox — the wrong surface.
 * Events         NONE. Nothing for code to subscribe to; the contract stays minimal.
 *
 * HOUSE RULE — MEASURED: fully compliant. Zero transitions out of the Any State
 * across all four layers (the Any State *nodes* exist because Rive creates one
 * per layer, but nothing leaves them: every transition's fromState is Entry or a
 * real animation state). Every sustained state exits on a GlyphVM.hover
 * comparison at 250ms in both directions, so releasing hover blends mid-loop
 * rather than snapping back to the start. The .riv was NOT modified.
 * ────────────────────────────────────────────────────────────────────── */

export type GlyphArtboard = "GlyphDesigner" | "GlyphAnimator" | "GlyphDeveloper";

/** The one state machine every glyph artboard carries. */
const STATE_MACHINE = "Glyph_SM";
/** The 1-frame timeline that lands each artboard on its authored rest pose. */
const REST_TIMELINE = "Rest";

interface GlyphTokens {
  stroke: [number, number, number];
  accent: [number, number, number];
}

let tokenCache: GlyphTokens | null = null;

/**
 * One resolver, shared by all three canvases (spec §7).
 *
 * This write is load-bearing, not a nicety: the .riv ships theme-agnostic by
 * design, so without it the glyphs render at their baked #8A8F98 / #FFA41C
 * defaults rather than the live tokens.
 *
 * Resolves an actual computed `color` property instead of parsing the raw
 * `var()` text — the same rule DotField follows, because `var(--x)` is not a
 * value until the cascade has resolved it. Cached because all three rails ask
 * the identical question and each miss costs a forced style read.
 */
function resolveGlyphTokens(): GlyphTokens | null {
  if (tokenCache) return tokenCache;
  if (typeof document === "undefined") return null;

  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
  document.body.appendChild(probe);

  const read = (token: string): [number, number, number] | null => {
    probe.style.color = `var(${token})`;
    const parsed = getComputedStyle(probe).color.match(/-?\d+\.?\d*/g);
    if (!parsed || parsed.length < 3) return null;
    return [Number(parsed[0]), Number(parsed[1]), Number(parsed[2])];
  };

  const stroke = read("--text-secondary");
  const accent = read("--accent-default");
  probe.remove();

  /* If the tokens cannot be resolved (no stylesheet yet, or a test environment
     with no cascade) leave the file's baked defaults alone rather than writing
     black. Not caching the miss means a later mount can still succeed. */
  if (!stroke || !accent) return null;

  tokenCache = { stroke, accent };
  return tokenCache;
}

interface GlyphCanvasProps {
  artboard: GlyphArtboard;
  hovered: boolean;
  reducedMotion: boolean;
  visible: boolean;
  onLoadError: () => void;
}

/**
 * The canvas itself, split out so that mounting it *is* the lazy load: `useRive`
 * fetches on mount, so gating the fetch on approach means gating this component.
 */
function GlyphCanvas({
  artboard,
  hovered,
  reducedMotion,
  visible,
  onLoadError,
}: GlyphCanvasProps) {
  const { rive, RiveComponent } = useRive({
    src: glyphsRivUrl,
    artboard,
    /* Reduced motion drives the 1-frame Rest timeline instead of the machine
       (see the map above: Rest is deliberately not a state). */
    ...(reducedMotion
      ? { animations: REST_TIMELINE }
      : { stateMachines: STATE_MACHINE }),
    /* Never autoplay. Full motion starts from the visibility effect below;
       reduced motion plays Rest exactly once and stops. */
    autoplay: false,
    /* The file's own transitions read GlyphVM and we write into it, so without a
       bound instance both the colour writes and the hover gate would no-op. */
    autoBind: true,
    onLoadError,
  });

  /* The theme write (spec §7). Runs once per canvas as soon as the file is live. */
  useEffect(() => {
    if (!rive) return;
    const vm = rive.viewModelInstance;
    if (!vm) return;
    const tokens = resolveGlyphTokens();
    if (!tokens) return;
    vm.color("strokeColor")?.rgb(...tokens.stroke);
    vm.color("accentColor")?.rgb(...tokens.accent);
  }, [rive]);

  /* Reduced motion: play the 1-frame Rest timeline once so the glyph lands on
     its authored rest pose (spec §3), then stops. This is not autoplay — nothing
     loops and there is no motion to perceive; it is simply how a static frame
     gets chosen deterministically instead of showing raw frame 0. */
  useEffect(() => {
    if (!rive || !reducedMotion) return;
    rive.play(REST_TIMELINE);
  }, [rive, reducedMotion]);

  /* Idle correctness: a glyph nobody can see does not advance its machine.
     Reduced motion opts out entirely — it has already landed on Rest and must
     not be told to play again. */
  useEffect(() => {
    if (!rive || reducedMotion) return;
    if (visible) rive.play(STATE_MACHINE);
    else rive.pause();
  }, [rive, visible, reducedMotion]);

  /* Hover, written by the rail (spec §7). Disabled under reduced motion: the
     rest pose must stay put, and a hover blend is motion. */
  useEffect(() => {
    if (!rive || reducedMotion) return;
    const flag = rive.viewModelInstance?.boolean("hover");
    if (flag) flag.value = hovered;
  }, [rive, hovered, reducedMotion]);

  return <RiveComponent className="audience-glyph__canvas" />;
}

export interface AudienceGlyphProps {
  artboard: GlyphArtboard;
  /** The RAIL is the hover surface (spec §7), so hover arrives as a prop. */
  hovered: boolean;
  reducedMotion: boolean;
}

/**
 * One AudienceRails glyph: a chrome-free, decorative line drawing that animates
 * the craft its rail describes.
 *
 * Deliberately `aria-hidden` — the rail's own heading and body name the audience
 * and carry the offer. The glyph is illustration, so announcing it would add
 * noise to a screen reader without adding information. (Contrast the CreditChip
 * rules in the modal system: nothing here is licensed or load-bearing.)
 */
export function AudienceGlyph({
  artboard,
  hovered,
  reducedMotion,
}: AudienceGlyphProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [approached, setApproached] = useState(false);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    /* Sustained, not one-shot: `approached` latches so the .riv is fetched
       exactly once, while `visible` keeps tracking so an offscreen glyph can
       stop advancing. StatsBand's observer disconnects on first hit because a
       count-up only needs to start; this one owns an ongoing idle rule, so it
       has to keep watching. The canvas is never unmounted once approached —
       "offscreen" is an explicit input, not an unmount assumption. */
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setApproached(true);
      },
      /* "On approach", not "on screen": the skirt buys the fetch and first frame
         enough time to land before the rail is actually looked at. */
      { rootMargin: "200px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* §7 failure rule, and it deliberately differs from the hero §8 rule.
     A modal hero that fails degrades to a labelled placeholder because the sheet
     already reserved space for it and an empty gap would read as a bug. These
     glyphs are decorative-plus — the rail text carries the information — so a
     failed glyph renders NOTHING and the rail collapses to exactly the rail we
     shipped before it existed. A labelled ghost box would be louder here than
     the drawing it replaced. */
  if (failed) return null;

  return (
    <div className="audience-glyph" ref={hostRef} aria-hidden="true">
      {approached && (
        <GlyphCanvas
          artboard={artboard}
          hovered={hovered}
          reducedMotion={reducedMotion}
          visible={visible}
          onLoadError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default AudienceGlyph;
