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
  ROLL_OVERLAP_MS,
  SPIN_EXIT_MS,
  SPRING_DURATION_MS,
  SPRING_EASING,
  STAGGER_MS,
  blurFrame,
  countPlan,
  delayFor,
  spinValueAt,
  springFrame,
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
  /** The count is in its continuous phase; digits changing fast should spin. */
  spinning: boolean;
  /** Suffixes are wider than a digit, so they size to their own content. */
  suffix?: boolean;
}

/**
 * One character cell, rendered as a stack of character layers.
 *
 * TWO REGIMES. While the count is spinning, a digit that keeps changing holds a
 * SPIN state — blurred, slightly dimmed, character swapped in place, ONE layer,
 * no roll choreography. That is the "wheel too fast to read" look, and it is
 * what makes speed feel continuous. Once a digit holds the same character for a
 * roll's worth of time it resolves out of spin, and every change after that is a
 * full crafted roll. The hierarchy falls out of this for free: on 120 the ones
 * digit spins nearly the whole way, the tens resolves earlier, and the hundreds
 * never spins at all — it appears once and stays.
 *
 * IDENTITY IS THE CHARACTER, NOT THE SLOT, for the roll regime. Reusing one
 * element and mutating its text means the only endpoint it can be retargeted to
 * is `settled` — the place it already is — so an interrupted roll converges
 * instead of rolling. Measured: every roll after the first travelled 0.3px, then
 * 0.0px, opacity pinned at 1. With a layer per value, the arriving character
 * animates uninterrupted while the one it replaces is retargeted from wherever
 * it actually is. Handoff snap measured 0.0000 / 0.000px / 0.000px.
 *
 * The slot is deliberately NOT `overflow: hidden`: the blur has to breathe past
 * the cell, and clipping it turns a soft roll into a hard-edged wipe.
 */
function Slot({
  char,
  index,
  revealed,
  reducedMotion,
  spinning,
  suffix,
}: SlotProps) {
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, char }]);
  const nodes = useRef(new Map<number, HTMLSpanElement>());
  const running = useRef(new Map<number, Animation[]>());
  const leaving = useRef(new Set<number>());
  const nextId = useRef(1);
  const previous = useRef(char);
  const hasRevealed = useRef(false);
  const inSpin = useRef(false);
  const spinExit = useRef<number | undefined>(undefined);
  /* A slot that appears mid-count is a new decimal place, not a value change. */
  const mountedMidCount = useRef(false);

  /**
   * Store the node. DELIBERATELY does not tear down on null.
   *
   * React re-invokes an inline ref callback with null on EVERY re-render, not
   * just on unmount. Cleaning up here cancelled the surviving layer's live
   * animation and dropped it from `running`, so the next effect pass saw an
   * unanimated layer and replayed its entrance from opacity 0. Measured: the
   * frame after a spent layer retired, the visible digit fell to 0.00 for two
   * frames and then popped back to 1.00 — once per roll, on every stat. That
   * was the flicker. Teardown belongs with the retirement that actually removes
   * a layer, which is where it now lives.
   */
  const register = useCallback((id: number, el: HTMLSpanElement | null) => {
    if (el) nodes.current.set(id, el);
  }, []);

  /** Drop a layer and everything holding it alive. */
  const retireLayer = useCallback((id: number) => {
    running.current.get(id)?.forEach((a) => a.cancel());
    running.current.delete(id);
    nodes.current.delete(id);
    leaving.current.delete(id);
    setLayers((prev) => prev.filter((l) => l.id !== id));
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
    if (reduce || revealed || hasRevealed.current || mountedMidCount.current) {
      if (el.dataset.state === "hidden") delete el.dataset.state;
      return;
    }
    el.dataset.state = "hidden";
  }, [reducedMotion, revealed, layers]);

  /* A leading slot appearing mid-count is a new decimal place. It arrives
     SETTLED rather than animating in: entering from opacity 0 made 101 read as
     "01" with a ghost leading digit for ~3 frames, which is conspicuous once
     everything around it is steady. An odometer's hundreds wheel is simply
     there. */
  useBeforePaint(() => {
    if (!revealed || hasRevealed.current) return;
    mountedMidCount.current = true;
    hasRevealed.current = true;
    const layer = layers[layers.length - 1];
    const el = nodes.current.get(layer?.id);
    if (el) delete el.dataset.state;
    /* Claim the layer so the drive effect below plays no entrance on it.
       Clearing data-state alone was not enough — the entrance still ran, and
       the digit was measured at opacity 0 for five frames as 99 became 100. */
    if (layer) running.current.set(layer.id, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leaveSpin = useCallback(() => {
    if (!inSpin.current) return;
    inSpin.current = false;
    const el = nodes.current.get(previousLayerId.current);
    if (!el) return;
    delete el.dataset.state;
    /* Resolve out of spin with the same recipe a roll settles with — the drum
       coming to rest rather than a cut to sharp. */
    el.animate([springFrame("settled")], {
      duration: SPRING_DURATION_MS,
      easing: SPRING_EASING,
      fill: "both",
    });
    el.animate([blurFrame("settled")], {
      duration: SPRING_DURATION_MS,
      easing: BLUR_EASING,
      fill: "both",
    });
  }, []);

  const previousLayerId = useRef(0);
  previousLayerId.current = layers[layers.length - 1]?.id ?? 0;

  /* A value changed. */
  useEffect(() => {
    if (previous.current === char) return;
    previous.current = char;

    if (!hasRevealed.current || reducedMotion) {
      setLayers([{ id: nextId.current++, char }]);
      return;
    }

    if (spinning) {
      /* SPIN: swap the character IN PLACE on the newest layer. The rendered
         text comes from layer state, not from the prop, so this replace is what
         actually turns the wheel — without it the slot holds a stale glyph and
         only ever repaints when the digit COUNT changes. No layer spawns, so
         nothing can ghost or stack while it is turning. */
      setLayers((prev) => {
        const next = prev.slice(-1);
        return [{ ...next[0], char }];
      });
      const el = nodes.current.get(previousLayerId.current);
      if (el) {
        running.current.get(previousLayerId.current)?.forEach((a) => a.cancel());
        /* Also clear anything not in `running` — a spin-exit resolve that is
           still in flight when the wheel picks up again. Optional-called: not
           every environment implements getAnimations. */
        el.getAnimations?.().forEach((a) => a.cancel());
        el.dataset.state = "spin";
        inSpin.current = true;
      }
      window.clearTimeout(spinExit.current);
      spinExit.current = window.setTimeout(leaveSpin, SPIN_EXIT_MS);
      return;
    }

    /* ROLL: stack a new layer rather than mutating the old one. */
    setLayers((prev) => {
      const next = [...prev, { id: nextId.current++, char }];
      return next.length > MAX_LAYERS
        ? next.slice(next.length - MAX_LAYERS)
        : next;
    });
  }, [char, reducedMotion, spinning, leaveSpin]);

  /* Leaving the spin phase entirely resolves whatever is still spinning. */
  useEffect(() => {
    if (spinning) return;
    window.clearTimeout(spinExit.current);
    leaveSpin();
  }, [spinning, leaveSpin]);

  useEffect(() => () => window.clearTimeout(spinExit.current), []);

  /* Drive whatever the current layer stack implies: the newest arrives, and
     anything behind it leaves. */
  useEffect(() => {
    if (reducedMotion) return;
    const stagger = hasRevealed.current ? COUNT_STAGGER_MS : STAGGER_MS;

    const newest = layers[layers.length - 1];
    if (newest && !running.current.has(newest.id) && !inSpin.current) {
      const el = nodes.current.get(newest.id);
      const isFirst = !hasRevealed.current;
      if (el && (revealed || !isFirst)) {
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
         is px against the current cell height, and this font-size is a clamp(),
         so a resize would strand the digit (measured 8.25px out, 41% of a
         cell). The inline style needs no cleanup: it only ever lands on a node
         that is about to be removed. */
      for (const animation of running.current.get(layer.id) ?? []) {
        if (el.isConnected) {
          try {
            animation.commitStyles();
          } catch {
            /* Not rendered — nothing to commit; the frames below still apply. */
          }
        }
        animation.cancel();
      }

      /* Hold at full strength for the overlap window, then leave. Without it
         the two curves cross at half opacity and the slot visibly thins at
         every roll. */
      const options = {
        duration: SPRING_DURATION_MS,
        delay: ROLL_OVERLAP_MS,
        fill: "both" as const,
      };
      const out = el.animate([springFrame("outgoing")], {
        ...options,
        easing: SPRING_EASING,
      });
      el.animate([blurFrame("outgoing")], { ...options, easing: BLUR_EASING });
      running.current.set(layer.id, [out]);

      const retire = () => retireLayer(layer.id);
      /* cancel() rejects `finished` with AbortError; retire the layer anyway. */
      out.finished.then(retire).catch(retire);
    }
  }, [layers, revealed, reducedMotion, index, retireLayer]);

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
 * Spins 0 → target as a continuous value, then clunks home through a tail of
 * crafted rolls.
 *
 * The value starts AT the target so the markup carries the real number for
 * anyone without JS, then drops to 0 before the first paint when there is
 * motion to play — nothing false is ever rendered into HTML, and nothing
 * flashes on screen.
 */
function useCount(target: number, revealed: boolean, reducedMotion: boolean) {
  const [value, setValue] = useState(target);
  const [spinning, setSpinning] = useState(false);

  useBeforePaint(() => {
    if (revealed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setValue(0);
  }, [revealed]);

  useEffect(() => {
    if (!revealed) return;
    if (reducedMotion) {
      setValue(target);
      setSpinning(false);
      return;
    }

    const plan = countPlan(target);
    setValue(0);

    /* The tail is scheduled against absolute deadlines rather than polled, so a
       dropped frame cannot reorder the landing. */
    const timers = plan.tail.map((step) =>
      window.setTimeout(() => setValue(step.value), step.at),
    );

    if (!plan.spin) {
      setSpinning(false);
      return () => timers.forEach((t) => window.clearTimeout(t));
    }

    setSpinning(true);
    const { to, duration } = plan.spin;
    let raf = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      if (elapsed >= duration) {
        setValue(to);
        setSpinning(false);
        return;
      }
      setValue(spinValueAt(elapsed, to, duration));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [revealed, reducedMotion, target]);

  return { value, spinning };
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
  const { value, spinning } = useCount(stat.value, revealed, reducedMotion);
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
            spinning={spinning}
          />
        ))}
      </span>
      {/* Last in the reveal ripple. It never spins and never re-animates per
          tick — its character does not change. */}
      <Slot
        char={stat.suffix}
        index={width}
        revealed={revealed}
        reducedMotion={reducedMotion}
        spinning={false}
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
