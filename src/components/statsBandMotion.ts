/**
 * The digit-roll motion contract — one place, so the values are pinnable.
 *
 * Modelled on Josh Puckett's Interface Craft stepper, measured from the live
 * implementation rather than eyeballed. The numbers below ARE the design; a test
 * pins every one of them so a later "cleanup" cannot quietly soften the feel.
 *
 * WHY NOT `motion`/framer HERE: StatsBand is on Home, and `motion` is deliberately
 * absent from the visitor bundle — CLAUDE.md keeps it off visitor-facing chunks and
 * lazy-loads `/showcase` for exactly that reason. Measured, importing it into this
 * section costs +43.4 kB gzipped on the entry chunk (171,506 → 214,934, +25.3%) to
 * animate four numbers. So the animation runs on the Web Animations API instead,
 * and Framer's spring is baked into a `linear()` easing below.
 */

/** Framer duration-spring, in Framer's own seconds convention. */
export const SPRING_DURATION_S = 0.15;
export const SPRING_BOUNCE = 0.2;
/** The same duration in ms — the WAAPI boundary. (CLAUDE.md: convert at the edge.) */
export const SPRING_DURATION_MS = 150;

/**
 * `spring({ duration: 150, bounce: 0.2 })` sampled into a `linear()` easing.
 *
 * Baked, not approximated: statsBand.test.tsx regenerates this from the real
 * `motion` package and asserts it still matches, so the curve is provably
 * Framer's rather than something spring-ish. Regenerate with that test, never
 * by hand.
 *
 * It overshoots to 1.0151 — that ~1.5% is the bounce. The overshoot rides the
 * transform; opacity and blur clamp at their floors when the curve passes
 * target, which is correct and intended. Do not assert the curve applies
 * unclamped to `filter`.
 */
export const SPRING_EASING =
  "linear(0, 0.1459, 0.411, 0.6527, 0.8257, 0.9311, 0.9859, 1.0091, 1.0151, 1.0135, 1.0095, 1.0058, 1.003, 1.0012, 1)";

/**
 * Blur runs on its OWN easing, across the full duration, and that is the whole
 * reason the effect is visible.
 *
 * Riding the spring, `filter` clamps at its floor the moment the curve crosses
 * 1 — which happens at 47% of the roll regardless of duration. Measured frame
 * by frame at 60Hz, that left 2 of 9 frames carrying visible blur, and the
 * owner's report of the previous build was, correctly, "no blurs". Stretching
 * the duration only stretches the dead tail in proportion (200ms bought 3 of 9;
 * 220ms bought nothing over 200ms).
 *
 * Decoupled linear over the same 150ms: 6 of 9 frames, landing sharp. Three
 * times the effect at zero tick-budget cost. This is a second `el.animate()`
 * on a disjoint property set — no library, no bytes.
 */
export const BLUR_EASING = "linear";

/** Ripple across digit positions, leftmost first; the suffix rides last. */
export const STAGGER_MS = 50;

/**
 * During counting the ripple is OFF.
 *
 * At 50ms, a 3-digit stat gives its third slot `delayFor(2)` = 100ms — but the
 * next tick commits at 80ms, so that digit would begin animating a value that
 * is already stale. The odometer hierarchy (ones rolling constantly, hundreds
 * once) is its own natural stagger; it does not need help.
 */
export const COUNT_STAGGER_MS = 0;

/**
 * Live character layers per slot, oldest dropped first.
 *
 * MEASURED TWICE, and the number moved both times — so the history matters more
 * than the value.
 *
 * Under the old discrete-tick count this cap WAS reached: peak 3, on 11 of 77
 * frames. An earlier comment here claimed it never was, and was wrong, because
 * it assumed a layer dies 150ms after it is CREATED; a layer actually dies 150ms
 * after it is RETARGETED, so one retargeted at a tick is still alive at the next
 * whenever the interval is under 150ms.
 *
 * Under the two-regime count it is NOT reached: measured peak 2. The spin phase
 * spawns no layers at all (it swaps characters in place), and every tail dwell
 * is at least one roll long, so an outgoing layer always retires before the next
 * one arrives. The cap is a guard again rather than a working limit — but it is
 * cheap, and the arithmetic that makes it unnecessary lives in TAIL_DWELLS,
 * which is exactly the kind of thing a future tune could break.
 */
export const MAX_LAYERS = 3;

/* ── the count: a spin that clunks home ───────────────────────────────────── */

/**
 * WHY THIS REPLACED A DISCRETE TICK SCHEDULE.
 *
 * The previous design sampled ten integers and rolled every changed digit at
 * each one. Two measurements killed it:
 *
 *  - At ten sampled ticks there is NO odometer hierarchy. On 120 the ones digit
 *    changed 9 of 10 times and the tens 8 of 10 — at the same instants. Seven of
 *    ten ticks moved two or three slots simultaneously with identical
 *    choreography, so it read as the whole number flashing in unison.
 *  - The dominant jaggedness was not positional but a BLUR SAWTOOTH: edge
 *    sharpness crossed its midpoint 16 times in 1.27s, a 6.3Hz flicker in the
 *    most perceptually salient band. Frame captures showed a value held frozen
 *    for six frames, then a two-frame ghosted flash, repeating.
 *
 * A fast/slow classifier on DWELL could not fix it: dwells spanned 80–160ms
 * against a 150ms roll, so the widest clear air any dwell bought was 10ms —
 * six tenths of a frame — and 33 of 38 intervals were effectively fast.
 *
 * The split had to be on the value DRIVER. Below: a continuous phase where the
 * number climbs every frame and each digit holds a spin state, handing off to a
 * short tail of real, crafted rolls.
 */

/** Blur and opacity a digit holds while it is turning too fast to read. */
export const SPIN_BLUR_PX = 4;
export const SPIN_OPACITY = 0.8;

/**
 * A digit leaves spin once it has held the same character this long.
 *
 * Equal to the roll duration by construction: "changing slower than a roll can
 * complete" is exactly the point at which a discrete roll becomes possible.
 */
export const SPIN_EXIT_MS = SPRING_DURATION_MS;

/** How long the continuous phase runs on a target big enough to spin. */
export const SPIN_DURATION_MS = 600;

/**
 * The landing. Each of the last integers gets a real, crafted roll, and they
 * lengthen so the wheel audibly clunks home: 117 → 118 → 119 → 120.
 *
 * A code constant, not a dial. Half of a big stat's 1200ms is this tail, and
 * that is the design rather than a cost — a plain ease-out cannot decelerate
 * into a roll on its own (landing 120 at 1200ms leaves the ones digit still
 * changing every 83ms, so it would spin straight through the finish and stop
 * dead). The tail is what makes the deceleration land.
 */
export const TAIL_DWELLS = [150, 200, 250];

/** At or below this there is nothing to spin — every step is a crafted roll. */
export const SPIN_MIN_TARGET = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface TailStep {
  value: number;
  /** How long the PREVIOUS value is held before this one commits. */
  dwell: number;
  /** Absolute time from the start of the count. */
  at: number;
}

export interface CountPlan {
  /** Null when the target is too small to spin. */
  spin: { to: number; duration: number } | null;
  tail: TailStep[];
  total: number;
}

/**
 * Rate at time t during the spin, in integers per ms.
 *
 * Deceleration is LINEAR IN RATE, which is what a wheel under constant braking
 * actually does, and it is chosen so the rate at handoff is exactly one integer
 * per roll — the continuous phase arrives at the discrete cadence rather than
 * being cut off at it.
 */
function spinRate(spinTo: number, duration: number) {
  const end = 1 / SPRING_DURATION_MS;
  const start = (2 * spinTo) / duration - end;
  return { start, end };
}

/** The continuous value at time t. Integrates the linear rate ramp above. */
export function spinValueAt(t: number, spinTo: number, duration: number): number {
  if (duration <= 0) return spinTo;
  const time = clamp(t, 0, duration);
  const { start, end } = spinRate(spinTo, duration);
  const value = start * time + ((end - start) * time * time) / (2 * duration);
  return clamp(Math.round(value), 0, spinTo);
}

/** Dwells for a target small enough that every step is a crafted roll. */
function craftedDwells(steps: number): number[] {
  const first = TAIL_DWELLS[0];
  const last = TAIL_DWELLS[TAIL_DWELLS.length - 1];
  if (steps <= 0) return [];
  if (steps === 1) return [last];
  return Array.from(
    { length: steps },
    (_, i) => first + ((last - first) * i) / (steps - 1),
  );
}

function buildTail(from: number, to: number, dwells: number[], startAt: number) {
  const tail: TailStep[] = [];
  let at = startAt;
  for (let i = 0; i < to - from; i += 1) {
    at += dwells[i];
    tail.push({ value: from + i + 1, dwell: dwells[i], at });
  }
  return tail;
}

/**
 * The whole count for one target: an optional continuous spin, then a tail of
 * crafted rolls that always ends exactly on the target.
 */
export function countPlan(target: number): CountPlan {
  const t = Math.max(0, Math.round(target));
  if (t === 0) return { spin: null, tail: [], total: 0 };

  /* Nothing to spin: 2 and 4 are all landing, which is correct — a two-step
     count has no fast phase to smooth. */
  if (t <= SPIN_MIN_TARGET) {
    const tail = buildTail(0, t, craftedDwells(t), 0);
    return { spin: null, tail, total: tail[tail.length - 1].at };
  }

  const spinTo = t - TAIL_DWELLS.length;
  const tail = buildTail(spinTo, t, TAIL_DWELLS, SPIN_DURATION_MS);
  return {
    spin: { to: spinTo, duration: SPIN_DURATION_MS },
    tail,
    total: tail[tail.length - 1].at,
  };
}

/** Blur the digits breathe through. The slot must not clip it. */
export const BLUR_PX = 4;

/**
 * Vertical offsets composed ON TOP of the slot's centering `translateY(-50%)`.
 *
 * As written these describe an INCREMENT: the outgoing digit leaves upward and
 * the incoming one arrives from below. `mirror()` flips that for a decrement.
 */
export const OFFSET = {
  settled: 0,
  outgoing: -50,
  incoming: 50,
} as const;

/** The centering transform every digit rests on. */
export const CENTER_OFFSET = -50;

/** Compose an offset onto the centering transform. */
export function transformFor(offset: number): string {
  return `translateY(${CENTER_OFFSET + offset}%)`;
}

/** Decrements roll the other way. */
export function mirror(offset: number): number {
  return -offset;
}

export type Phase = "settled" | "outgoing" | "incoming";

/** The three visual states, resolved to real CSS values. */
export function frameFor(phase: Phase, direction: 1 | -1 = 1) {
  const raw = OFFSET[phase];
  const offset = direction === 1 ? raw : mirror(raw);
  return {
    opacity: phase === "settled" ? 1 : 0,
    filter: phase === "settled" ? "blur(0px)" : `blur(${BLUR_PX}px)`,
    transform: transformFor(offset),
  };
}

/** Delay for the nth element in the ripple. The suffix is simply the last n. */
export function delayFor(index: number, stagger: number = STAGGER_MS): number {
  return index * stagger;
}

/**
 * The spring half of a frame: opacity and transform, which ride the baked
 * Framer curve and inherit its overshoot.
 */
export function springFrame(phase: Phase, direction: 1 | -1 = 1) {
  const { opacity, transform } = frameFor(phase, direction);
  return { opacity, transform };
}

/** The blur half, which runs linear over the full duration. See BLUR_EASING. */
export function blurFrame(phase: Phase) {
  return { filter: frameFor(phase).filter };
}
