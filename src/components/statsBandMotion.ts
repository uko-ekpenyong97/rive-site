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

/** Ripple across digit positions, leftmost first; the suffix rides last. */
export const STAGGER_MS = 50;

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
export function delayFor(index: number): number {
  return index * STAGGER_MS;
}
