import { useRef } from "react";
import { useDialKit, type TransitionConfig } from "dialkit";
import { DEFAULT_DIALS, type ModalDials } from "./dials";

/* ──────────────────────────────────────────────────────────────────────────
 * DIALKIT DIALS — spec §6, live-tunable.
 *
 * This is the project's standard for motion knobs: every value in a spec's
 * dial table becomes a DialKit control here, and the component consumes the
 * resolved values as plain data (ModalRoot never imports dialkit, so the
 * shipped modal carries no tuning dependency).
 *
 * §6 mapping notes:
 * - `sheet-in-duration` + `sheet-in-ease` are unified into ONE DialKit
 *   transition control: it is the "bezier editor" §6 asks for and it renders a
 *   live curve preview, with the duration bundled. DialKit expresses duration
 *   in SECONDS (Motion's convention); ModalDials is in ms, so we convert.
 * - Sliders are `[default, min, max, step]` and carry §6's ranges verbatim.
 * - Values persist to localStorage so a tuning session survives reloads.
 * ────────────────────────────────────────────────────────────────────────── */

/** Baked entrance curve, as DialKit's 4-tuple. Mirrors DEFAULT_DIALS.sheetInEase. */
const SHEET_IN_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const MS_PER_S = 1000;

/** The system preference, read once, so the toggle below can start truthful. */
function systemPrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A bezier from a panel/persisted value is untrusted: `cubic-bezier()` requires
 * finite numbers with the X control points inside [0,1], and one bad value makes
 * the whole CSS declaration invalid — which would silently kill the entrance
 * transition rather than just look wrong.
 */
function toCubicBezier(ease: [number, number, number, number]): string {
  if (!Array.isArray(ease) || ease.length !== 4 || ease.some((n) => !Number.isFinite(n))) {
    return DEFAULT_DIALS.sheetInEase;
  }
  const clampX = (n: number) => Math.min(1, Math.max(0, n));
  const [x1, y1, x2, y2] = ease;
  return `cubic-bezier(${clampX(x1)}, ${y1}, ${clampX(x2)}, ${y2})`;
}

/** Same reasoning for the free-text length dial: reject anything CSS won't take. */
function toCssLength(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("margin-top", value) ? value : DEFAULT_DIALS.sliverHeight;
  }
  return value;
}

/**
 * The transition control can be flipped to spring mode in the panel UI. CSS
 * transitions cannot express a spring, so we fall back to the last curve/timing
 * judged in easing mode — reverting to the bake would silently throw away the
 * duration the developer just tuned.
 */
function readTransition(
  transition: TransitionConfig,
  fallbackMs: number,
): { durationMs: number; ease: string } {
  if (transition.type === "easing") {
    return {
      durationMs: Math.round(transition.duration * MS_PER_S),
      ease: toCubicBezier(transition.ease),
    };
  }
  return {
    durationMs: Math.round(
      (transition.visualDuration ?? fallbackMs / MS_PER_S) * MS_PER_S,
    ),
    ease: DEFAULT_DIALS.sheetInEase,
  };
}

export interface ModalDialValues {
  dials: ModalDials;
  /** Panel toggle so the reduced-motion fallback can be previewed on demand. */
  reducedMotion: boolean;
}

/**
 * Registers the UseCaseModal panel and returns resolved dials.
 * Requires a <DialRoot /> mounted on the page to show the panel UI (the values
 * resolve from these defaults regardless).
 *
 * @param onReplay Wired to the panel's "replay" action — re-triggers the
 *   entrance so the two-speed choreography can be judged repeatedly (§7 step 2).
 */
export function useModalDials(onReplay?: () => void): ModalDialValues {
  /* Remembers the last duration judged in easing mode, so flipping the control
     to spring mode does not discard it (see readTransition). */
  const lastEasingMs = useRef(DEFAULT_DIALS.sheetInDuration);

  const values = useDialKit(
    "UseCaseModal",
    {
      replay: { type: "action" as const, label: "Replay entrance" },

      sheetIn: {
        /* §6 sheet-in-duration + sheet-in-ease (the bezier editor).
           NOTE: DialKit's transition control owns its own Duration slider, so
           §6's 400–1100ms window is a judgement guideline here, not an enforced
           range — only the baked default below comes from the spec. */
        transition: {
          type: "easing" as const,
          duration: DEFAULT_DIALS.sheetInDuration / MS_PER_S,
          ease: SHEET_IN_EASE,
        },
        /* §6 sheet-in-travel, 3–12% of viewport height. */
        travel: [DEFAULT_DIALS.sheetInTravel, 3, 12, 0.5] as [
          number,
          number,
          number,
          number,
        ],
        /* §3 opacity resolves inside the first slice of the entrance. */
        opacityIn: [DEFAULT_DIALS.sheetOpacityInDuration, 0, 600, 10] as [
          number,
          number,
          number,
          number,
        ],
      },

      sheetOut: {
        /* §6 sheet-out-duration (150–400ms) — exits always beat entrances. */
        duration: [DEFAULT_DIALS.sheetOutDuration, 150, 400, 10] as [
          number,
          number,
          number,
          number,
        ],
        travel: [DEFAULT_DIALS.sheetOutTravel, 0, 12, 0.5] as [
          number,
          number,
          number,
          number,
        ],
      },

      scrim: {
        /* §6 scrim-in-duration (100–500ms) — the fast attack. */
        inDuration: [DEFAULT_DIALS.scrimInDuration, 100, 500, 10] as [
          number,
          number,
          number,
          number,
        ],
        outDuration: [DEFAULT_DIALS.scrimOutDuration, 100, 500, 10] as [
          number,
          number,
          number,
          number,
        ],
        /* §3 the sheet leads the scrim out by this delay. */
        outDelay: [DEFAULT_DIALS.scrimOutDelay, 0, 200, 5] as [
          number,
          number,
          number,
          number,
        ],
        /* §6 scrim-opacity 0.25–0.7 · scrim-blur 0–32px (T2 is decided here). */
        opacity: [DEFAULT_DIALS.scrimOpacity, 0.25, 0.7, 0.01] as [
          number,
          number,
          number,
          number,
        ],
        blur: [DEFAULT_DIALS.scrimBlur, 0, 32, 1] as [
          number,
          number,
          number,
          number,
        ],
      },

      /* §6 sliver-height — a CSS length, so a text control. */
      sliverHeight: DEFAULT_DIALS.sliverHeight,

      /* Seeded from the OS preference so the default is honest: the panel can
         then force it either way for previewing, and an explicit `false` is a
         deliberate choice rather than a blind override of the visitor's setting. */
      reducedMotion: systemPrefersReducedMotion(),
      reducedCrossfade: [DEFAULT_DIALS.reducedCrossfade, 50, 400, 10] as [
        number,
        number,
        number,
        number,
      ],

      hero: {
        /* §6 ghost-idle-delay, 2–12s. Seconds in the panel (it is a human-scale
           wait); converted to ms at the boundary. */
        ghostIdleDelay: [DEFAULT_DIALS.ghostIdleDelay / MS_PER_S, 2, 12, 0.5] as [
          number,
          number,
          number,
          number,
        ],
        /* §6 hover-preload-delay, 0–600ms of hover intent. */
        hoverPreloadDelay: [DEFAULT_DIALS.hoverPreloadDelay, 0, 600, 10] as [
          number,
          number,
          number,
          number,
        ],
        /* §6 state-dwell, 2–8s per state in the auto-cycle. Seconds in the panel. */
        stateDwell: [DEFAULT_DIALS.stateDwell / MS_PER_S, 2, 8, 0.5] as [
          number,
          number,
          number,
          number,
        ],
        /* §6 cycle-resume-delay, 4–20s of quiet before the walk resumes. */
        cycleResumeDelay: [
          DEFAULT_DIALS.cycleResumeDelay / MS_PER_S,
          4,
          20,
          1,
        ] as [number, number, number, number],
      },
    },
    {
      persist: true,
      onAction: (action) => {
        if (action === "replay") onReplay?.();
      },
    },
  );

  const sheetIn = readTransition(values.sheetIn.transition, lastEasingMs.current);
  if (values.sheetIn.transition.type === "easing") {
    lastEasingMs.current = sheetIn.durationMs;
  }

  return {
    reducedMotion: values.reducedMotion,
    dials: {
      sheetInDuration: sheetIn.durationMs,
      sheetInEase: sheetIn.ease,
      sheetInTravel: values.sheetIn.travel,
      sheetOpacityInDuration: values.sheetIn.opacityIn,
      sheetOutDuration: values.sheetOut.duration,
      sheetOutTravel: values.sheetOut.travel,
      scrimInDuration: values.scrim.inDuration,
      scrimOutDuration: values.scrim.outDuration,
      scrimOutDelay: values.scrim.outDelay,
      scrimOpacity: values.scrim.opacity,
      scrimBlur: values.scrim.blur,
      sliverHeight: toCssLength(values.sliverHeight),
      reducedCrossfade: values.reducedCrossfade,
      ghostIdleDelay: Math.round(values.hero.ghostIdleDelay * MS_PER_S),
      hoverPreloadDelay: values.hero.hoverPreloadDelay,
      stateDwell: Math.round(values.hero.stateDwell * MS_PER_S),
      cycleResumeDelay: Math.round(values.hero.cycleResumeDelay * MS_PER_S),
    },
  };
}
