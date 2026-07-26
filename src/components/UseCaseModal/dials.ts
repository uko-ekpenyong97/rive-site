import type { CSSProperties } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * MODAL DIALS — the tuning knobs for the UseCaseModal system.
 *
 * The spec (§6) calls these "DialKit dials". This repo has no Framer-Motion /
 * DialKit dependency and animates with CSS transitions, so — per CLAUDE.md's
 * Motion rule ("motion values are tuning knobs, exposed as CSS custom
 * properties or config objects at the top of the owning file") — every value
 * lives here as a typed config, is baked to sensible defaults, and is applied
 * to the DOM as CSS custom properties via `dialsToStyle()`. `ModalDialPanel`
 * edits this object live in the showcase (the DialKit experience, no dep).
 *
 * Two-speed signature (Stripe reference, measured on our dark canvas):
 * the scrim snaps in fast while the sheet glides slow; exits are always faster
 * than entrances, with the sheet leading the scrim out.
 * ────────────────────────────────────────────────────────────────────────── */

export interface ModalDials {
  /** Sheet entrance: translateY(travel) → 0, the slow glide. */
  sheetInDuration: number; // ms          · §6 400–1100
  sheetInEase: string; //     cubic-bezier · §6 (0.22, 1, 0.36, 1) easeOutQuint
  sheetInTravel: number; //   % of viewport height the sheet rises from · §6 3–12
  /** Opacity resolves within the first slice of the sheet entrance. */
  sheetOpacityInDuration: number; // ms · §3 (200ms)
  /** Sheet exit: always faster than the entrance. */
  sheetOutDuration: number; // ms · §6 150–400
  sheetOutTravel: number; //  % of viewport height the sheet drops on exit · §3 (4%)
  /** Scrim entrance: the fast attack. */
  scrimInDuration: number; // ms · §6 100–500
  /** Scrim exit — lags the sheet so the sheet leads out. */
  scrimOutDuration: number; // ms · §3 (240ms)
  scrimOutDelay: number; //    ms · §3 (~60ms, sheet leads)
  /** Veil strength + backdrop blur (Apple house recipe on our #000 canvas). */
  scrimOpacity: number; // 0–1 · §6 0.25–0.7
  scrimBlur: number; //    px  · §6 0–32
  /** The persistent sliver of receded homepage above the sheet top edge. */
  sliverHeight: string; // CSS length · §6 clamp(64px, 8vh, 120px)
  /** prefers-reduced-motion: slides become a plain crossfade of this length. */
  reducedCrossfade: number; // ms · §3 (150ms)
  /** Quiet time before the ghost cursor demonstrates the hero interaction. */
  ghostIdleDelay: number; // ms · §6 2–12s
  /** Hover-intent head start: how long a cell hover waits before preloading. */
  hoverPreloadDelay: number; // ms · §6 0–600
  /** Time spent in each state while the hero auto-cycles. */
  stateDwell: number; // ms · §6 2000–8000
  /** Idle time after a manual state pick before the auto-cycle resumes. */
  cycleResumeDelay: number; // ms · §6 4000–20000
}

export const DEFAULT_DIALS: ModalDials = {
  sheetInDuration: 800,
  sheetInEase: "cubic-bezier(0.22, 1, 0.36, 1)",
  sheetInTravel: 6,
  sheetOpacityInDuration: 200,
  sheetOutDuration: 240,
  sheetOutTravel: 4,
  scrimInDuration: 250,
  scrimOutDuration: 240,
  scrimOutDelay: 60,
  scrimOpacity: 0.45,
  scrimBlur: 20,
  sliverHeight: "clamp(64px, 8vh, 120px)",
  reducedCrossfade: 150,
  ghostIdleDelay: 6000,
  hoverPreloadDelay: 300,
  stateDwell: 3500,
  cycleResumeDelay: 8000,
};

/** Merge a partial override over the baked defaults. */
export function resolveDials(override?: Partial<ModalDials>): ModalDials {
  return override ? { ...DEFAULT_DIALS, ...override } : DEFAULT_DIALS;
}

/**
 * Total ms the exit choreography needs before the overlay may unmount.
 * The sheet leads; the scrim finishes last (its duration + lead delay).
 */
export function exitDurationMs(dials: ModalDials, reduced: boolean): number {
  if (reduced) return dials.reducedCrossfade;
  return Math.max(dials.sheetOutDuration, dials.scrimOutDuration + dials.scrimOutDelay);
}

/** Project the dials onto the CSS custom properties the stylesheet consumes. */
export function dialsToStyle(dials: ModalDials): CSSProperties {
  return {
    "--sheet-in-duration": `${dials.sheetInDuration}ms`,
    "--sheet-in-ease": dials.sheetInEase,
    // Travel is "% of viewport height" (§6). Emitted as vh (1vh = 1% viewport)
    // NOT %, because CSS translateY(%) resolves against the element's own
    // height — and the sheet is deliberately taller than the viewport.
    "--sheet-in-travel": `${dials.sheetInTravel}vh`,
    "--sheet-opacity-in-duration": `${dials.sheetOpacityInDuration}ms`,
    "--sheet-out-duration": `${dials.sheetOutDuration}ms`,
    "--sheet-out-travel": `${dials.sheetOutTravel}vh`,
    "--scrim-in-duration": `${dials.scrimInDuration}ms`,
    "--scrim-out-duration": `${dials.scrimOutDuration}ms`,
    "--scrim-out-delay": `${dials.scrimOutDelay}ms`,
    "--scrim-opacity": `${dials.scrimOpacity}`,
    "--scrim-blur": `${dials.scrimBlur}px`,
    "--sliver-height": dials.sliverHeight,
    "--reduced-crossfade": `${dials.reducedCrossfade}ms`,
  } as CSSProperties;
}
