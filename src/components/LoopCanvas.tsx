import { useEffect, useRef } from "react";
/* WebGL2 build = Rive's GPU renderer (same one the editor uses). The default
 * canvas build rasterizes on the CPU and visibly stutters during scroll. */
import { useRive } from "@rive-app/react-webgl2";
import loopRivUrl from "../assets/rive/loop.riv?url";
import "./LoopCanvas.css";

/* ──────────────────────────────────────────────────────────────────────────
 * THE loop.riv CONTRACT — asserted against the COMMITTED BYTES by
 * `npm run check:assets` (scripts/check-riv-assets.mjs).
 *
 * WHY THESE ARE CONSTANTS AND NOT STRING LITERALS AT THE POINT OF USE: every
 * name below is a promise about a file this component cannot typecheck against.
 * `tsc` never reads a .riv, `vite build` only copies it, and the Vitest suite
 * mocks the runtime — so a mock agrees with whatever name the config claims.
 * loop.riv is also the file most likely to be re-exported again, and it already
 * has been once (2026-08-01, JetBrains Mono).
 *
 * THE ENUM VALUES ARE THE SHARP EDGE. `beat` is written through
 * `viewModelInstance.enum("beat")`, and a write of a value the file no longer
 * defines does not throw — it is a silent no-op, so the character simply stops
 * changing beat while every test stays green. `BEATS` is therefore the ONE
 * source: `Beat` derives from it, `WorkflowStack` iterates it, and check:assets
 * parses it out of this file and compares against the enum in the bytes.
 * ────────────────────────────────────────────────────────────────────────── */

/** Every value of the file's `Beat` data enum, in authored order. */
export const BEATS = ["design", "animate", "wire", "bind", "live"] as const;
export type Beat = (typeof BEATS)[number];

/** The artboard this canvas mounts. Not passed to `useRive` — it is the file's
 *  default (first) artboard — but pinned so a re-export cannot reorder it. */
export const LOOP_ARTBOARD = "Loop";
/** The state machine driven on mount. */
export const LOOP_STATE_MACHINE = "BeatMachine";
/** The view model `autoBind` binds, and the name of the enum on it. */
export const LOOP_VIEW_MODEL = "LoopVM";
export const LOOP_BEAT_ENUM = "Beat";
/** Every LoopVM property this component writes. */
export const LOOP_VM_PROPERTIES = [
  "beat",
  "progress",
  "pointerOver",
  "pointerX",
  "pointerY",
  "press",
  "errorTrip",
] as const;

/* Feel dials (see loop spec §7) */
const PROGRESS_LERP = 0.12; // per-frame approach toward target — sweep, not teleport
const ERROR_PRESS_COUNT = 4;
const ERROR_WINDOW_MS = 1500;
const ERROR_COOLDOWN_MS = 5000;
const ARTBOARD_SIZE = 240; // loop.riv artboard is 240×240

export interface LoopCanvasProps {
  beat: Beat;
  /** Scroll-derived target 0–100, read per-frame from a ref so scrubbing never
   * triggers React re-renders (re-render churn during scroll reads as jank). */
  progressTargetRef: React.RefObject<number>;
  /** When true (prefers-reduced-motion), progress is written instantly. */
  reduceMotion?: boolean;
  className?: string;
}

/**
 * The single persistent Rive canvas for the workflow section. Never unmounts
 * across beats; all ViewModel writes are null-guarded so the component is
 * safe before loop.riv loads (or if it's missing entirely).
 */
export function LoopCanvas({ beat, progressTargetRef, reduceMotion = false, className }: LoopCanvasProps) {
  const { rive, RiveComponent } = useRive({
    src: loopRivUrl,
    stateMachines: LOOP_STATE_MACHINE,
    autoplay: true,
    autoBind: true,
  });

  const beatRef = useRef<Beat>(beat);
  const shownRef = useRef(0);
  const pressTimesRef = useRef<number[]>([]);
  const errorCooldownUntilRef = useRef(0);

  beatRef.current = beat;

  useEffect(() => {
    const vmBeat = rive?.viewModelInstance?.enum("beat");
    if (vmBeat) vmBeat.value = beat;
  }, [rive, beat]);

  /* Damped progress writer — one rAF loop for the life of the canvas. */
  useEffect(() => {
    if (!rive) return;
    let raf = 0;
    const tick = () => {
      const vmProgress = rive.viewModelInstance?.number("progress");
      if (vmProgress) {
        const target = progressTargetRef.current ?? 0;
        const next = reduceMotion ? target : shownRef.current + (target - shownRef.current) * PROGRESS_LERP;
        if (Math.abs(next - shownRef.current) > 0.001 || vmProgress.value !== next) {
          shownRef.current = next;
          vmProgress.value = next;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rive, reduceMotion, progressTargetRef]);

  /* Pointer wiring — only written when beat === live (guarded here and in-file). */
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (beatRef.current !== "live") return;
    const vmi = rive?.viewModelInstance;
    if (!vmi) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * ARTBOARD_SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * ARTBOARD_SIZE;
    const px = vmi.number("pointerX");
    const py = vmi.number("pointerY");
    if (px) px.value = x;
    if (py) py.value = y;
  };

  const setPointerOver = (over: boolean) => {
    if (beatRef.current !== "live") return;
    const vmOver = rive?.viewModelInstance?.boolean("pointerOver");
    if (vmOver) vmOver.value = over;
  };

  const handlePointerDown = () => {
    if (beatRef.current !== "live") return;
    const vmi = rive?.viewModelInstance;
    if (!vmi) return;
    vmi.trigger("press")?.trigger();

    const now = performance.now();
    if (now < errorCooldownUntilRef.current) return;
    const times = pressTimesRef.current.filter((t) => now - t < ERROR_WINDOW_MS);
    times.push(now);
    pressTimesRef.current = times;
    if (times.length >= ERROR_PRESS_COUNT) {
      vmi.trigger("errorTrip")?.trigger();
      pressTimesRef.current = [];
      errorCooldownUntilRef.current = now + ERROR_COOLDOWN_MS;
    }
  };

  return (
    <div
      className={className ? `loop-canvas ${className}` : "loop-canvas"}
      role="img"
      aria-label="Loop, an animated loader character being assembled step by step — decorative demonstration"
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setPointerOver(true)}
      onPointerLeave={() => setPointerOver(false)}
      onPointerDown={handlePointerDown}
    >
      <RiveComponent className="loop-canvas__surface" />
      {!rive && <span className="loop-canvas__caption">● LOOP — RIVE CANVAS PENDING</span>}
    </div>
  );
}

export default LoopCanvas;
