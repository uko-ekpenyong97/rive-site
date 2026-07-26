import { useEffect, useRef, useState } from "react";
import type { GhostTarget } from "./useCaseContent";
import "./GhostCursor.css";

/* ──────────────────────────────────────────────────────────────────────────
 * GHOST CURSOR — the invitation (spec §4 anatomy item 2, §5 third-party mode)
 *
 * This is a community file we do not own, so we add no ViewModel bindings to it.
 * Instead a chrome-coloured cursor is drawn on a DOM layer above the canvas and
 * dispatches REAL pointer events at the hit region, so the file responds exactly
 * as it would to a person. It demonstrates ONE interaction — taking damage —
 * then withdraws and re-arms.
 *
 * Non-negotiables:
 * - It yields the instant a real pointer moves over the hero, and does not come
 *   back until the visitor has been still for a full idle delay again. A ghost
 *   that fights the user's cursor is worse than no ghost.
 * - Under prefers-reduced-motion it never autoplays: a static text hint replaces
 *   it entirely (spec §3 reduced-motion rule).
 * - It only runs while the modal is actually open and the tab is visible — no
 *   work for invisible pixels.
 * ────────────────────────────────────────────────────────────────────────── */

/* Choreography (ms). Deliberately slower than a real cursor: the ghost is a
 * demonstration, and a snappy synthetic cursor reads as a glitch. */
const TRAVEL_MS = 900; // rest → target glide
const DWELL_MS = 1400; // time spent over the region so the hit animation reads
const RETREAT_MS = 500; // target → rest
/** Real pointer movement under this distance is noise, not intent. */
const REAL_MOVE_EPSILON = 4;

type Phase = "hidden" | "travelling" | "dwelling" | "retreating";

export interface GhostCursorProps {
  target: GhostTarget;
  /** The canvas to dispatch pointer events into. */
  surfaceRef: React.RefObject<HTMLElement | null>;
  /** Quiet time before the ghost demonstrates (§6 ghost-idle-delay). */
  idleDelay: number;
  /** True once the .riv is actually playing — never invite on a dead canvas. */
  ready: boolean;
  /** The modal is open; the ghost idles completely when false. */
  active: boolean;
  reducedMotion: boolean;
}

export function GhostCursor({
  target,
  surfaceRef,
  idleDelay,
  ready,
  active,
  reducedMotion,
}: GhostCursorProps) {
  const [phase, setPhase] = useState<Phase>("hidden");
  /* Bumping this re-arms the idle timer without restarting the whole effect. */
  const [armCount, setArmCount] = useState(0);
  const lastRealMove = useRef({ x: 0, y: 0 });

  /* Any genuine pointer movement over the hero cancels the demo and re-arms. */
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || reducedMotion) return;

    const onPointerMove = (event: PointerEvent) => {
      /* Listening on pointermove while the ghost dispatches mousemove keeps the
         two channels cleanly separate. The isTrusted guard is belt-and-braces:
         a synthetic event must never make the ghost cancel itself. */
      if (!event.isTrusted) return;
      const { x, y } = lastRealMove.current;
      if (
        Math.abs(event.clientX - x) < REAL_MOVE_EPSILON &&
        Math.abs(event.clientY - y) < REAL_MOVE_EPSILON
      ) {
        return;
      }
      lastRealMove.current = { x: event.clientX, y: event.clientY };
      setPhase("hidden");
      setArmCount((n) => n + 1);
    };

    surface.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => surface.removeEventListener("pointermove", onPointerMove);
  }, [surfaceRef, reducedMotion]);

  /* The demo loop: wait out the idle delay, glide in, dwell, retreat, re-arm. */
  useEffect(() => {
    if (!active || !ready || reducedMotion) {
      setPhase("hidden");
      return;
    }

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    /* The runtime binds mouseover/mousemove/mouseout (it only uses pointerdown),
       so the ghost must speak MouseEvent — pointer events would be ignored. */
    const dispatch = (type: "mouseover" | "mousemove" | "mouseout") => {
      const surface = surfaceRef.current;
      if (!surface) return;
      /* Those listeners live on the CANVAS, and DOM events only bubble upward —
         dispatching on the wrapper would reach nothing. Aim at the canvas itself
         (falling back to the wrapper before it mounts). */
      const node: HTMLElement = surface.querySelector("canvas") ?? surface;
      const rect = node.getBoundingClientRect();
      /* On the way out, aim off the region so the file sees a real exit. */
      const clientX =
        type === "mouseout" ? rect.left - 1 : rect.left + rect.width * target.x;
      const clientY =
        type === "mouseout" ? rect.top - 1 : rect.top + rect.height * target.y;

      node.dispatchEvent(
        new MouseEvent(type, {
          clientX,
          clientY,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    };

    at(idleDelay, () => {
      setPhase("travelling");

      at(TRAVEL_MS, () => {
        setPhase("dwelling");
        /* Arrival IS the interaction — the file's listeners are all `enter`, so
           entering the region is what fires healthMinusAdvance. */
        dispatch("mouseover");
        dispatch("mousemove");
      });

      at(TRAVEL_MS + DWELL_MS, () => {
        setPhase("retreating");
        dispatch("mouseout");
      });

      at(TRAVEL_MS + DWELL_MS + RETREAT_MS, () => {
        setPhase("hidden");
        setArmCount((n) => n + 1); // loop
      });
    });

    return () => timers.forEach(window.clearTimeout);
  }, [active, ready, reducedMotion, idleDelay, armCount, surfaceRef, target]);

  /* Pause the loop while the tab is hidden, then re-arm on return. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setPhase("hidden");
      } else {
        setArmCount((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (reducedMotion) {
    return (
      <p className="ghost-hint" data-static="true">
        {target.hint}
      </p>
    );
  }

  const engaged = phase === "travelling" || phase === "dwelling";

  return (
    <span
      className="ghost-cursor"
      data-phase={phase}
      aria-hidden="true"
      style={{
        left: `${target.x * 100}%`,
        top: `${target.y * 100}%`,
        /* Travel and retreat differ in length, so the duration follows phase. */
        transitionDuration: `${phase === "retreating" ? RETREAT_MS : TRAVEL_MS}ms`,
        opacity: engaged ? 1 : 0,
      }}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path
          d="M5 3l14 8.5-6.2 1.2L10 19z"
          fill="currentColor"
          stroke="var(--surface-canvas)"
          strokeWidth="1.2"
        />
      </svg>
    </span>
  );
}

export default GhostCursor;
