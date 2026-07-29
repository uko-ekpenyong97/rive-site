import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import SectionHeader from "./SectionHeader";
import { usePrefersReducedMotion } from "./UseCaseModal/usePrefersReducedMotion";
import {
  BLUR_EASING,
  COUNT_STAGGER_MS,
  MAX_LAYERS,
  SPRING_DURATION_MS,
  SPRING_EASING,
  STAGGER_MS,
  blurFrame,
  delayFor,
  springFrame,
  tickSchedule,
} from "./statsBandMotion";
import "./StatsBand.css";

/* The hidden state and the count's reset to zero are both applied before paint,
   never rendered into the markup — see the notes in Slot and useCount.
   useLayoutEffect warns during SSR, so fall back there, where it is a no-op. */
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

/** One character on screen. Identity is the LAYER, not the slot — see Slot. */
interface Layer {
  id: number;
  char: string;
}

interface SlotProps {
  char: string;
  /** Position in the reveal ripple. The suffix is simply the last index. */
  index: number;
  revealed: boolean;
  reducedMotion: boolean;
  /** Suffixes are wider than a digit, so they size to their own content. */
  suffix?: boolean;
}

/**
 * One character cell, rendered as a stack of character layers.
 *
 * IDENTITY IS THE CHARACTER, NOT THE SLOT, and that is the whole design. Reusing
 * one element and mutating its text means the only endpoint it can ever be
 * retargeted to is `settled` — the place it already is — so an interrupted roll
 * converges instead of rolling. Measured: every roll after the first travelled
 * 0.3px, then 0.0px, with opacity pinned at 1. The animation quietly deletes
 * itself while every test still passes.
 *
 * With a layer per value, an arriving character animates `incoming → settled`
 * and is never interrupted, while the character it replaces is retargeted from
 * wherever it actually is to `outgoing`. Handoff snap measured at 0.0000
 * opacity / 0.000px / 0.000px across every cadence.
 *
 * The slot is deliberately NOT `overflow: hidden`: the blur has to breathe past
 * the cell, and clipping it turns a soft roll into a hard-edged wipe.
 */
function Slot({ char, index, revealed, reducedMotion, suffix }: SlotProps) {
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, char }]);
  const nodes = useRef(new Map<number, HTMLSpanElement>());
  const running = useRef(new Map<number, Animation[]>());
  const arrived = useRef(new Set<number>());
  const leaving = useRef(new Set<number>());
  const nextId = useRef(1);
  const previous = useRef(char);
  const hasRevealed = useRef(false);

  const register = useCallback((id: number, el: HTMLSpanElement | null) => {
    if (el) nodes.current.set(id, el);
    else {
      /* Unmounted — drop its animations so a stale `finished` cannot fire at a
         layer that no longer exists. */
      running.current.get(id)?.forEach((a) => a.cancel());
      running.current.delete(id);
      nodes.current.delete(id);
    }
  }, []);

  /* The character is SETTLED in the markup and hidden here, before the first
     paint. Rendering it hidden instead would leave the stats invisible to
     anyone whose JS never runs — the animation is an enhancement, so the
     settled value is the honest default.

     The preference is read synchronously rather than from the prop:
     usePrefersReducedMotion resolves in a useEffect, which lands AFTER the
     first paint, so trusting it here would flash one frame of hidden digits at
     exactly the people who asked for no motion. */
  useBeforePaint(() => {
    const el = nodes.current.get(layers[layers.length - 1]?.id);
    if (!el) return;
    const reduce =
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || revealed || hasRevealed.current) {
      delete el.dataset.state;
      return;
    }
    el.dataset.state = "hidden";
  }, [reducedMotion, revealed, layers]);

  /* A value changed: stack a new layer rather than mutating the old one. */
  useEffect(() => {
    if (previous.current === char) return;
    previous.current = char;

    if (!hasRevealed.current || reducedMotion) {
      setLayers([{ id: nextId.current++, char }]);
      return;
    }
    setLayers((prev) => {
      const next = [...prev, { id: nextId.current++, char }];
      return next.length > MAX_LAYERS ? next.slice(next.length - MAX_LAYERS) : next;
    });
  }, [char, reducedMotion]);

  /* Drive whatever the current layer stack implies: the newest arrives, and
     anything behind it leaves. */
  useEffect(() => {
    if (reducedMotion) return;
    const stagger = hasRevealed.current ? COUNT_STAGGER_MS : STAGGER_MS;

    const newest = layers[layers.length - 1];
    if (newest && !arrived.current.has(newest.id)) {
      const el = nodes.current.get(newest.id);
      /* The very first layer waits for the band to scroll into view; every
         later one is already the result of a tick, so it starts at once. */
      const isFirst = !hasRevealed.current;
      if (el && (revealed || !isFirst)) {
        arrived.current.add(newest.id);
        delete el.dataset.state;
        const options = {
          duration: SPRING_DURATION_MS,
          delay: delayFor(index, stagger),
          fill: "both" as const,
        };
        running.current.set(newest.id, [
          el.animate([springFrame("incoming"), springFrame("settled")], {
            ...options,
            easing: SPRING_EASING,
          }),
          el.animate([blurFrame("incoming"), blurFrame("settled")], {
            ...options,
            easing: BLUR_EASING,
          }),
        ]);
        hasRevealed.current = true;
      }
    }

    for (const layer of layers.slice(0, -1)) {
      if (leaving.current.has(layer.id)) continue;
      leaving.current.add(layer.id);
      const el = nodes.current.get(layer.id);
      if (!el) continue;

      /* Retarget from where it actually is. commitStyles before cancel — the
         other order commits the base value — and commitStyles rather than a
         computed-style read because it preserves the PERCENTAGE. A baked matrix
         is in px against the current cell height, and this font-size is a
         clamp(), so a resize would strand the digit (measured 8.25px out, 41%
         of a cell). The inline style it writes needs no cleanup: it only ever
         lands on a node that is about to be removed. */
      const previousAnimations = running.current.get(layer.id) ?? [];
      for (const animation of previousAnimations) {
        if (el.isConnected) {
          try {
            animation.commitStyles();
          } catch {
            /* Not rendered — nothing to commit, the frames below still apply. */
          }
        }
        animation.cancel();
      }

      const options = {
        duration: SPRING_DURATION_MS,
        fill: "both" as const,
      };
      const out = el.animate([springFrame("outgoing")], {
        ...options,
        easing: SPRING_EASING,
      });
      el.animate([blurFrame("outgoing")], { ...options, easing: BLUR_EASING });
      running.current.set(layer.id, [out]);

      out.finished
        .then(() => setLayers((prev) => prev.filter((l) => l.id !== layer.id)))
        /* cancel() rejects `finished` with AbortError; retire the layer anyway. */
        .catch(() => setLayers((prev) => prev.filter((l) => l.id !== layer.id)));
    }
  }, [layers, revealed, reducedMotion, index]);

  /* Reduced motion: settled from the first paint, one layer, no animation. */
  useEffect(() => {
    if (!reducedMotion) return;
    hasRevealed.current = true;
    for (const el of nodes.current.values()) delete el.dataset.state;
  }, [reducedMotion, layers]);

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
      {layers.map((layer, i) => (
        <span
          key={layer.id}
          className="stats-band__char"
          ref={(el) => register(layer.id, el)}
          /* Only the newest layer carries the value; the ones on their way out
             are decoration and must not be read twice. */
          aria-hidden={i < layers.length - 1 ? "true" : undefined}
        >
          {layer.char}
        </span>
      ))}
    </span>
  );
}

/* ── the count ────────────────────────────────────────────────────────────── */

/**
 * Ticks 0 → target through a decelerating schedule of integers.
 *
 * The value starts AT the target so the markup carries the real number for
 * anyone without JS, then drops to 0 before the first paint when there is
 * motion to play. Same trick as the hidden state: nothing false is ever
 * rendered into HTML, and nothing flashes on screen.
 */
function useCount(target: number, revealed: boolean, reducedMotion: boolean) {
  const [value, setValue] = useState(target);

  useBeforePaint(() => {
    if (revealed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setValue(0);
  }, [revealed]);

  useEffect(() => {
    if (!revealed) return;
    if (reducedMotion) {
      setValue(target);
      return;
    }
    const { values, times } = tickSchedule(target);
    setValue(values[0]);
    /* setTimeout against an absolute deadline, not a rAF poll: the ramp step at
       ten ticks is 8.9ms, smaller than a frame, so polling would reorder the
       observed dwells even though the schedule itself is monotone. */
    const timers = values
      .slice(1)
      .map((v, i) => window.setTimeout(() => setValue(v), times[i + 1]));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [revealed, reducedMotion, target]);

  return value;
}

/* ── the band ─────────────────────────────────────────────────────────────── */

/**
 * Reveals the stats when the band scrolls ~30% into view. Same trigger
 * semantics as ever — one-shot, threshold 0.3.
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

function StatValue({
  stat,
  revealed,
  reducedMotion,
}: {
  stat: Stat;
  revealed: boolean;
  reducedMotion: boolean;
}) {
  const value = useCount(stat.value, revealed, reducedMotion);
  const digits = String(value).split("");
  const width = String(stat.value).length;

  return (
    <div className="stats-band__value">
      {/* The target's digit width is reserved up front and the count is
          right-aligned into it, so growing from 0 to 120 never shoves the
          suffix sideways mid-count. */}
      <span
        className="stats-band__digits"
        style={{ "--digit-width": width } as CSSProperties}
      >
        {digits.map((digit, i) => (
          <Slot
            /* Keyed from the RIGHT, so a digit keeps its identity as the number
               grows. Keyed from the left, prepending a digit shifts every slot
               and fires a spurious roll in each one. */
            key={digits.length - 1 - i}
            char={digit}
            index={i}
            revealed={revealed}
            reducedMotion={reducedMotion}
          />
        ))}
      </span>
      {/* Last in the reveal ripple. It does not re-animate per tick — its
          character never changes. */}
      <Slot
        char={stat.suffix}
        index={width}
        revealed={revealed}
        reducedMotion={reducedMotion}
        suffix
      />
    </div>
  );
}

export function StatsBand() {
  const reducedMotion = usePrefersReducedMotion();
  const { ref, revealed } = useReveal();

  return (
    <section className="stats-band">
      <SectionHeader eyebrow="PROOF" title="Why teams ship with Rive" />

      <div className="stats-band__grid" ref={ref}>
        {STATS.map((stat) => (
          <div key={stat.label} className="stats-band__stat">
            <StatValue
              stat={stat}
              revealed={revealed}
              reducedMotion={reducedMotion}
            />
            <div className="stats-band__label">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StatsBand;
