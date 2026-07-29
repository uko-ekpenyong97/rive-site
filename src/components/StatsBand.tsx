import { useEffect, useLayoutEffect, useRef, useState } from "react";
import SectionHeader from "./SectionHeader";
import { usePrefersReducedMotion } from "./UseCaseModal/usePrefersReducedMotion";
import {
  SPRING_DURATION_MS,
  SPRING_EASING,
  delayFor,
  frameFor,
} from "./statsBandMotion";
import "./StatsBand.css";

/* The hidden state is applied before paint, never rendered into the markup —
   see the note in Slot. useLayoutEffect would warn during SSR, so fall back
   there, where it is a no-op anyway. */
const useBeforePaint =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface Stat {
  value: number;
  suffix: string;
  label: string;
}

const STATS: Stat[] = [
  {
    value: 4,
    suffix: "×",
    label: "faster production than traditional motion workflows",
  },
  { value: 90, suffix: "%", label: "smaller files than equivalent video" },
  {
    value: 2,
    suffix: "×",
    label: "user engagement after teams ship with Rive",
  },
  { value: 120, suffix: "fps", label: "from browsers to vehicle dashboards" },
];

/* ── one slot ─────────────────────────────────────────────────────────────── */

interface SlotProps {
  /** The character this slot shows — a digit, or the stat's suffix. */
  char: string;
  /** Position in the ripple. The suffix is simply the last index. */
  index: number;
  /** The band has scrolled into view; play the reveal. */
  revealed: boolean;
  reducedMotion: boolean;
  /** Suffixes are wider than a digit, so they size to their own content. */
  suffix?: boolean;
}

/**
 * One character cell. The character is absolutely positioned inside a
 * fixed-size slot, so the row keeps tabular rhythm from the LAYOUT rather than
 * from font tricks — `font-variant-numeric: tabular-nums` on the container is
 * belt-and-braces, not the mechanism.
 *
 * The slot is deliberately NOT `overflow: hidden`: the blur has to breathe past
 * the cell, and clipping it turns a soft roll into a hard-edged wipe.
 */
function Slot({ char, index, revealed, reducedMotion, suffix }: SlotProps) {
  const ref = useRef<HTMLSpanElement>(null);
  /** The character on its way out, rendered alongside the incoming one. */
  const [exiting, setExiting] = useState<string | null>(null);
  const exitRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<string>(char);
  const hasRevealed = useRef(false);

  /* The character is SETTLED in the markup and hidden here, before the first
     paint. Rendering it hidden instead would mean the stats are invisible to
     anyone whose JS never runs, and would ship blank numbers into the SSR
     smoke — the animation is an enhancement, so the settled value is the
     honest default.

     The preference is read synchronously rather than taken from the prop:
     usePrefersReducedMotion resolves in a useEffect, which lands AFTER the
     first paint, so trusting it here would flash one frame of hidden digits at
     exactly the people who asked for no motion. The prop still drives
     everything else; this is the one decision that cannot wait for it. */
  useBeforePaint(() => {
    const el = ref.current;
    if (!el) return;
    const reduce =
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || revealed || hasRevealed.current) {
      delete el.dataset.state;
      return;
    }
    el.dataset.state = "hidden";
  }, [reducedMotion, revealed]);

  /* Reveal: one materialisation per slot. Never a tick through intermediate
     values — the number does not count up, it arrives. */
  useEffect(() => {
    if (!revealed || hasRevealed.current) return;
    hasRevealed.current = true;
    const el = ref.current;
    if (!el) return;

    if (reducedMotion) {
      delete el.dataset.state;
      return;
    }

    const animation = el.animate([frameFor("incoming"), frameFor("settled")], {
      duration: SPRING_DURATION_MS,
      delay: delayFor(index),
      easing: SPRING_EASING,
      fill: "both",
    });
    animation.finished
      .then(() => {
        /* Hand the resting state back to CSS so nothing is left mid-flight and
           a later roll starts from a clean slate. */
        delete el.dataset.state;
        animation.cancel();
      })
      .catch(() => {
        /* Cancelled by an unmount or a value change; the state below still applies. */
      });
  }, [revealed, reducedMotion, index]);

  /* The roll. With today's static STATS this never fires — but a component
     called DigitRoll that cannot roll would be lying, and a future stat edit
     should simply work. */
  useEffect(() => {
    if (previous.current === char) return;
    const from = previous.current;
    previous.current = char;

    if (!hasRevealed.current || reducedMotion) return;
    setExiting(from);
  }, [char, reducedMotion]);

  useEffect(() => {
    if (exiting === null) return;
    const outgoing = exitRef.current;
    const incoming = ref.current;
    if (!outgoing || !incoming) return;

    const options = {
      duration: SPRING_DURATION_MS,
      delay: delayFor(index),
      easing: SPRING_EASING,
      fill: "both" as const,
    };
    const out = outgoing.animate(
      [frameFor("settled"), frameFor("outgoing")],
      options,
    );
    incoming.animate([frameFor("incoming"), frameFor("settled")], options);

    out.finished
      .then(() => setExiting(null))
      .catch(() => setExiting(null));
  }, [exiting, index]);

  return (
    <span
      className={`stats-band__slot${suffix ? " stats-band__slot--suffix" : ""}`}
    >
      {/* Sizes the suffix slot to its own text; digits use the fixed 0.6em. */}
      {suffix && (
        <span aria-hidden="true" className="stats-band__sizer">
          {char}
        </span>
      )}
      {exiting !== null && (
        <span className="stats-band__char" ref={exitRef} aria-hidden="true">
          {exiting}
        </span>
      )}
      {/* No data-state here: settled is the markup default, and the hidden
          state is applied before paint only when there is motion to play. */}
      <span className="stats-band__char" ref={ref}>
        {char}
      </span>
    </span>
  );
}

/* ── the band ─────────────────────────────────────────────────────────────── */

/**
 * Reveals the stats when the band scrolls ~30% into view. Same trigger
 * semantics as before — one-shot, threshold 0.3 — but the numbers no longer
 * count: each digit materialises once, staggered across the row.
 */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        setRevealed(true);
        io.disconnect();
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, revealed };
}

export function StatsBand() {
  const reducedMotion = usePrefersReducedMotion();
  const { ref, revealed } = useReveal();

  return (
    <section className="stats-band">
      <SectionHeader eyebrow="PROOF" title="Why teams ship with Rive" />

      <div className="stats-band__grid" ref={ref}>
        {STATS.map((stat) => {
          const digits = String(stat.value).split("");
          return (
            <div key={stat.label} className="stats-band__stat">
              <div className="stats-band__value">
                {digits.map((digit, i) => (
                  <Slot
                    key={i}
                    char={digit}
                    index={i}
                    revealed={revealed}
                    reducedMotion={reducedMotion}
                  />
                ))}
                {/* Last in the ripple, same variant as the digits. */}
                <Slot
                  char={stat.suffix}
                  index={digits.length}
                  revealed={revealed}
                  reducedMotion={reducedMotion}
                  suffix
                />
              </div>
              <div className="stats-band__label">{stat.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default StatsBand;
