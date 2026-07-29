import { useEffect, useRef, useState } from "react";
/* WebGL2 build — the same runtime LoopCanvas and RiveHero already pull into the
 * Home entry chunk. These three canvases therefore add no runtime weight at all,
 * only the ~12.9 kB of .riv they fetch between them. */
import { useRive } from "@rive-app/react-webgl2";
import "./AudienceGlyph.css";

/* ──────────────────────────────────────────────────────────────────────
 * The per-file CONFIRMED MAP blocks live in AudienceRails.tsx, above the RAILS
 * table — the house pattern puts a map next to the config that selects it, and
 * the src/artboard pairing is chosen there. What follows is the part of the
 * contract this component has to obey at the point of use.
 *
 * ONE FILE PER GLYPH. Originally one three-artboard file, which is how this
 * section shipped broken: the export on disk contained a single artboard while
 * the editor held three, two canvases failed to load, and the render-nothing
 * fallback hid it. Three files make the failure mode structural — a file either
 * has its one artboard or it does not, and scripts/check-riv-assets.mjs proves
 * it against the committed bytes on every CI run. See spec §11.
 *
 * REST IS NOT A STATE: `Rest` is a linear animation deliberately absent from
 * Glyph_SM. The reduced-motion path therefore instantiates with
 * `animations: "Rest"` and NOT `stateMachines` — naming the machine would start
 * Idle_Loop, the exact thing reduced motion is here to prevent.
 *
 * HOVER IS A VIEW-MODEL PROPERTY, NOT A STATE-MACHINE INPUT. Every file reports
 * no legacy inputs, so `stateMachineInput("hover")` would compile, run, and
 * silently do nothing. It is written through GlyphVM.
 *
 * NO LISTENERS, NO EVENTS in any file (spec §4). The rail is the hover surface
 * and is far larger than the canvas, so hover is detected in code; an in-file
 * listener would only ever see the canvas hitbox — the wrong surface.
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
  src: string;
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
  src,
  artboard,
  hovered,
  reducedMotion,
  visible,
  onLoadError,
}: GlyphCanvasProps) {
  const { rive, RiveComponent } = useRive({
    src,
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
  /** One file per glyph — see the confirmed maps in AudienceRails.tsx. */
  src: string;
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
  src,
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
          src={src}
          artboard={artboard}
          hovered={hovered}
          reducedMotion={reducedMotion}
          visible={visible}
          onLoadError={() => {
            /* The silent fallback is a decision for VISITORS, not for us. It
               shipped a section with two of three glyphs missing and nobody
               could see it, because rendering nothing looks identical to
               rendering nothing on purpose. In dev, say so out loud. Stripped
               from production builds, where the quiet degradation is correct. */
            if (import.meta.env.DEV) {
              console.warn(
                `[AudienceGlyph] ${artboard} failed to load from ${src} — the rail will render without its glyph.`,
              );
            }
            setFailed(true);
          }}
        />
      )}
    </div>
  );
}

export default AudienceGlyph;
