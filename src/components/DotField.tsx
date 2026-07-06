import { useEffect, useRef } from "react";
import "./DotField.css";

/* -------------------------------------------------------------------------- */
/* Feel constants — the tuning knobs for the ambient dot substrate.           */
/* -------------------------------------------------------------------------- */
const CONFIG = {
  SPACING: 24, // px between dots (viewport-anchored grid)
  DOT_RADIUS: 1, // px, drawn × devicePixelRatio for crispness
  RADIUS: 220, // px area-of-effect around the cursor
  MAX_PUSH: 7, // px max displacement away from the cursor
  BASE_ALPHA: 0.08, // resting dot alpha
  LIFT_ALPHA: 0.2, // max alpha directly under the cursor
  LERP: 0.12, // per-frame easing toward each dot's target (trailing)
};

const MAX_DPR = 2; // cap for perf on 3x displays
const EPS = 0.02; // position settle threshold (px)
const EPS_A = 0.002; // alpha settle threshold
const TAU = Math.PI * 2;

export function DotField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { SPACING, DOT_RADIUS, RADIUS, MAX_PUSH, BASE_ALPHA, LIFT_ALPHA, LERP } =
      CONFIG;

    let dpr = 1;
    let vw = 0;
    let vh = 0;
    let cols = 0;
    let rows = 0;
    let count = 0;
    let curX = new Float32Array(0);
    let curY = new Float32Array(0);
    let curA = new Float32Array(0);
    let rgb: [number, number, number] = [255, 255, 255];

    const pointer = { x: -1e5, y: -1e5 };
    let rafId: number | null = null;
    let running = false;

    // --- token color read (runtime, never hardcoded) ------------------------
    // The canvas carries `color: var(--text-primary)`; getComputedStyle
    // resolves the whole var() chain to an rgb() we can parse.
    function readColor() {
      const parsed = getComputedStyle(canvas!).color.match(/-?\d+\.?\d*/g);
      if (parsed && parsed.length >= 3) {
        rgb = [
          Math.round(+parsed[0]),
          Math.round(+parsed[1]),
          Math.round(+parsed[2]),
        ];
      }
    }

    // --- grid (re)build -----------------------------------------------------
    function buildGrid() {
      cols = Math.floor(vw / SPACING) + 1;
      rows = Math.floor(vh / SPACING) + 1;
      count = cols * rows;
      curX = new Float32Array(count);
      curY = new Float32Array(count);
      curA = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const c = i % cols;
        const r = (i / cols) | 0;
        curX[i] = c * SPACING;
        curY[i] = r * SPACING;
        curA[i] = BASE_ALPHA;
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      vw = window.innerWidth;
      vh = window.innerHeight;
      canvas!.width = Math.round(vw * dpr);
      canvas!.height = Math.round(vh * dpr);
      canvas!.style.width = vw + "px";
      canvas!.style.height = vh + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
      renderOnce();
    }

    // --- draw current state without physics (initial / idle / theme flip) ---
    function renderOnce() {
      ctx!.clearRect(0, 0, vw, vh);
      ctx!.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      for (let i = 0; i < count; i++) {
        ctx!.globalAlpha = curA[i];
        ctx!.beginPath();
        ctx!.arc(curX[i], curY[i], DOT_RADIUS, 0, TAU);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    // --- one animated frame -------------------------------------------------
    function frame() {
      rafId = null;
      if (document.hidden) {
        running = false;
        return;
      }
      ctx!.clearRect(0, 0, vw, vh);
      ctx!.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

      const cx = pointer.x;
      const cy = pointer.y;
      const R2 = RADIUS * RADIUS;
      let settled = true;

      for (let i = 0; i < count; i++) {
        const c = i % cols;
        const r = (i / cols) | 0;
        const bx = c * SPACING;
        const by = r * SPACING;

        let tx = bx;
        let ty = by;
        let ta = BASE_ALPHA;

        const dx = bx - cx;
        const dy = by - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2);
          let t = 1 - d / RADIUS;
          t = t * t; // eased falloff
          const inv = d > 0.0001 ? 1 / d : 0;
          const push = MAX_PUSH * t;
          tx = bx + dx * inv * push; // displace AWAY from cursor
          ty = by + dy * inv * push;
          ta = BASE_ALPHA + (LIFT_ALPHA - BASE_ALPHA) * t;
        }

        const x = curX[i] + (tx - curX[i]) * LERP;
        const y = curY[i] + (ty - curY[i]) * LERP;
        const a = curA[i] + (ta - curA[i]) * LERP;
        curX[i] = x;
        curY[i] = y;
        curA[i] = a;

        if (
          settled &&
          (Math.abs(tx - x) > EPS ||
            Math.abs(ty - y) > EPS ||
            Math.abs(ta - a) > EPS_A)
        ) {
          settled = false;
        }

        ctx!.globalAlpha = a;
        ctx!.beginPath();
        ctx!.arc(x, y, DOT_RADIUS, 0, TAU);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      // Go fully idle once nothing is animating — no rAF until the next move.
      if (settled) {
        running = false;
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(frame);
      }
    }

    // --- listeners ----------------------------------------------------------
    function onMove(e: PointerEvent) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      start();
    }
    function onLeave() {
      // Pull the influence off-screen and let the dots ease back to rest.
      pointer.x = -1e5;
      pointer.y = -1e5;
      start();
    }
    function onVisibility() {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        running = false;
      } else {
        start();
      }
    }
    const themeObserver = new MutationObserver(() => {
      readColor();
      renderOnce();
    });

    // --- init ---------------------------------------------------------------
    readColor();
    resize();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window.addEventListener("resize", resize);

    // Static-only treatment: no cursor response, no rAF.
    if (reduce || !fine) {
      return () => {
        window.removeEventListener("resize", resize);
        themeObserver.disconnect();
      };
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      running = false;
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="dot-field" aria-hidden="true" />;
}

export default DotField;
