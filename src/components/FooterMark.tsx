import { useEffect, useRef, useState } from "react";
import {
  RIVE_WORDMARK_PATH,
  RIVE_WORDMARK_R_PATH,
  RIVE_WORDMARK_VIEWBOX,
} from "./riveWordmark";
import "./FooterMark.css";

/**
 * The four stacked outline copies, measured off business.x.com's footer mark.
 *
 * The effect is entirely scale plus layering — four copies of one path at
 * different weights and opacities, the crisp hairline last so it sits on top of
 * its own ghosts. X's exact widths are ported; only the opacities are ours to
 * question, because X is black-on-white and this is light-on-black.
 */
const LAYERS = [
  { width: 1, stroke: "var(--text-secondary)", opacity: 0.5 },
  { width: 2.5, stroke: "var(--text-secondary)", opacity: 0.3 },
  { width: 1.5, stroke: "var(--text-secondary)", opacity: 0.6 },
  { width: 0.75, stroke: "var(--text-primary)", opacity: 1 },
] as const;

/* TWO CORRECTIONS TO THE OBVIOUS MAPPING, both found by rendering it.
 *
 * 1. The ghosts must sit on an OPAQUE token. Mapping them to --border-subtle
 *    and --text-muted looked right on paper and produced almost nothing:
 *    --border-subtle is already rgba(255,255,255,0.10), so a 0.3 stroke-opacity
 *    on top of it composites to 3% white on a black canvas. X's 50%/30% are
 *    opacities on a SOLID stroke; applying them to alpha tokens dims twice and
 *    the halo disappears. On --text-secondary (#AAAAAA, opaque) the same numbers
 *    mean what X meant by them.
 *
 * 2. The crisp layer is --text-primary, not --text-secondary. X's top layer is
 *    100% black on white — their maximum available contrast. The dark-theme
 *    equivalent of that is white; #AAAAAA would translate their 100% into our
 *    67% and the hairline stops separating from the ghost beneath it. Rendered
 *    side by side, that separation is the whole effect.
 */

/** One full lap of the R. Slow enough to be discovered, not watched. */
const LAP_MS = 45_000;

/**
 * Breathing room around the logotype's own box, in its user units.
 *
 * The letterforms fill viewBox 0 0 275 50 exactly — they touch all four edges —
 * and an SVG clips to its viewBox. So anything drawn ON the path gets cut in
 * half wherever the path runs along an edge: the payload dot was losing its top
 * as it crossed the R's shoulder at y=0, and the widest ghost stroke was being
 * shaved everywhere the letters meet the boundary.
 *
 * 2.5 covers the worst case. The dot contributes its radius (1.6, fixed in user
 * units). The strokes contribute half their width, and because they are
 * non-scaling they get WIDER in user units as the mark gets smaller — at a 375px
 * viewport the 2.5px ghost is ~1.9 user units, so ~0.93 of overhang. 1.6 + 0.93
 * still fits inside 2.5 at every width this renders at.
 *
 * The side effect is welcome: the mark no longer sits absolutely flush, which is
 * closer to the reference anyway — X's own footer mark clears the page end by
 * about 32px rather than touching it.
 */
const MARK_PAD = 2.5;

/** The logotype's box, opened up by the pad on every side. */
const [vx, vy, vw, vh] = RIVE_WORDMARK_VIEWBOX.split(" ").map(Number);
const PADDED_VIEWBOX = [
  vx - MARK_PAD,
  vy - MARK_PAD,
  vw + MARK_PAD * 2,
  vh + MARK_PAD * 2,
].join(" ");

/* Read synchronously, not from usePrefersReducedMotion. That hook resolves in a
   useEffect, which lands AFTER the first paint — and here the preference decides
   whether the dot element EXISTS, so trusting it would mount and animate a dot
   for one frame at exactly the people who asked for no motion. Same pattern
   CommunityShowcase uses, and for the same reason. */
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** Null where the API does not exist — SSR, and jsdom, which ships no matchMedia. */
function reduceQuery(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  if (typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCE_QUERY);
}

function prefersReducedMotion() {
  return reduceQuery()?.matches ?? false;
}

/**
 * The giant layered wordmark that closes the page.
 *
 * THE DOT IS THE POINT OF CONTINUITY. It is the same amber payload dot the
 * AudienceRails glyphs carry — the one that travels the designer's curve, drives
 * the animator's playhead, and walks the developer's state machine. Having
 * crossed all three crafts on the way down the page, it arrives here and traces
 * the brand itself. That is why it is amber and why it is a dot rather than any
 * other flourish; if this ever reads as decoration, the continuity has been lost
 * and it should go rather than be restyled.
 *
 * It travels the R alone. The other letters' subpaths are relative to the ones
 * before them and cannot be lifted out without rewriting coordinates — see
 * riveWordmark.ts. The journey matters more than the coverage.
 */
export function FooterMark() {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const hostRef = useRef<SVGSVGElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const lap = useRef<Animation | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mq = reduceQuery();
    if (!mq) return;
    const apply = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* Idle correctness, the established pattern: a mark nobody can see does not
     animate. Sustained rather than one-shot, because this needs to stop again
     when the footer scrolls away, not just start once. */
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* The lap is created ONCE and then played or paused. Recreating it on every
     visibility change would restart the dot at 0% each time the footer scrolled
     back into view, so a slow 45s journey could never actually complete for
     anyone who scrolled away and back.

     Verified across viewport widths before shipping: offset-path on an SVG
     element tracks the letterform through the viewBox transform — measured at
     0.4px drift at 400px wide and 1.1px at 1200px against the path's own
     getPointAtLength. That is what makes a responsive full-width mark safe. */
  useEffect(() => {
    const dot = dotRef.current;
    if (!dot || reducedMotion) return;
    const animation = dot.animate(
      [{ offsetDistance: "0%" }, { offsetDistance: "100%" }],
      { duration: LAP_MS, easing: "linear", iterations: Infinity },
    );
    lap.current = animation;
    return () => {
      animation.cancel();
      lap.current = null;
    };
  }, [reducedMotion]);

  /* Idle correctness: resume where it left off rather than starting over. */
  useEffect(() => {
    const animation = lap.current;
    if (!animation) return;
    if (visible) animation.play();
    else animation.pause();
  }, [visible, reducedMotion]);

  return (
    <svg
      className="footer-mark"
      ref={hostRef}
      viewBox={PADDED_VIEWBOX}
      /* The letterforms are the page's own closing word, not information — the
         footer already says RIVE in text above this. */
      aria-hidden="true"
      focusable="false"
    >
      {LAYERS.map((layer) => (
        <path
          key={layer.width}
          className="footer-mark__layer"
          d={RIVE_WORDMARK_PATH}
          fill="none"
          stroke={layer.stroke}
          strokeWidth={layer.width}
          strokeOpacity={layer.opacity}
          /* Load-bearing for the whole look: without it the hairlines thicken
             with the viewport and the layering collapses into one fat outline. */
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Static under reduced motion: the layered mark carries itself, which is
          the thing X's version proves. */}
      {!reducedMotion && (
        <circle
          className="footer-mark__dot"
          ref={dotRef}
          r={1.6}
          fill="var(--accent-default)"
          style={{ offsetPath: `path("${RIVE_WORDMARK_R_PATH}")` }}
        />
      )}
    </svg>
  );
}

export default FooterMark;
