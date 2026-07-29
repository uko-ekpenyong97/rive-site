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
 * Bound by ceil(roll / minTick) + 1 = 3 at the shipped cadence, where it is
 * never actually reached — natural retirement on `finished` handles everything.
 * It exists as a leak guard for a backgrounded tab or a stalled timeline. A cap
 * of 2 was measured yanking a 25%-opaque glyph at tighter cadences.
 */
export const MAX_LAYERS = 3;

/* ── the count schedule ───────────────────────────────────────────────────── */

/** At or below this, tick through every integer: 0→4 counts 0,1,2,3,4. */
export const EVERY_INTEGER_MAX = 10;
/** Sampled steps above it. Constant, so a bigger number is not a longer wait. */
export const SAMPLED_STEPS = 10;
/** Ease-out exponent in VALUE space. 2 = quadratic. */
export const VALUE_EASE = 2;
/** Dwell on the first value, and on the last one before it lands. */
export const FIRST_DWELL_MS = 80;
export const LAST_DWELL_MS = 160;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The integer sequence from 0 to target, sampled off an ease-out curve.
 *
 * The `hi` clamp is the load-bearing line: it reserves one integer for every
 * remaining step, so the curve can never reach the target early, no value can
 * repeat, and the final entry is always exactly `target`. Without it, ease-out
 * rounding saturates near the end and 0→12 finishes 11,12,12,12,12.
 */
export function tickValues(target: number): number[] {
  const t = Math.max(0, Math.round(target));
  if (t === 0) return [0];
  if (t <= EVERY_INTEGER_MAX) return Array.from({ length: t + 1 }, (_, i) => i);

  const n = SAMPLED_STEPS;
  const values = [0];
  for (let i = 1; i < n; i += 1) {
    const eased = 1 - Math.pow(1 - i / n, VALUE_EASE);
    values.push(clamp(Math.round(t * eased), values[i - 1] + 1, t - (n - i)));
  }
  values.push(t);
  return values;
}

/**
 * Dwell before each next tick. `intervals[i]` is how long `values[i]` is on
 * screen; the final value has no dwell, it rests. A linear ramp makes
 * non-decreasing structural rather than asserted-and-hoped.
 */
export function tickIntervals(steps: number): number[] {
  if (steps <= 0) return [];
  if (steps === 1) return [LAST_DWELL_MS];
  const span = LAST_DWELL_MS - FIRST_DWELL_MS;
  return Array.from(
    { length: steps },
    (_, i) => FIRST_DWELL_MS + (span * i) / (steps - 1),
  );
}

/** Values, dwells, and the absolute time each value should commit. */
export function tickSchedule(target: number) {
  const values = tickValues(target);
  const intervals = tickIntervals(values.length - 1);
  const times = [0];
  intervals.forEach((interval, i) => times.push(times[i] + interval));
  return { values, intervals, times, total: times[times.length - 1] };
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
