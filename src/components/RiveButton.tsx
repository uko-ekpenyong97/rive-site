import { useEffect, useRef, useState } from "react";
/* WebGL2 build — the GPU renderer already in the bundle for LoopCanvas and the
 * modal heroes. Adding a hero CTA therefore adds no runtime, only a .riv. */
import { useRive } from "@rive-app/react-webgl2";
import type { RiveSiteAsset } from "./riveSiteAssets";
import "./RiveButton.css";

export interface RiveButtonProps {
  asset: RiveSiteAsset;
  /** Always rendered in the DOM — see the accessible-name note below. */
  label: string;
  href?: string;
  /** Visual weight of the underlying button chrome. */
  variant?: "primary" | "secondary";
  /**
   * Forces the reduced-motion path. Used by the showcase to document that
   * state — omit in normal use and let the OS preference decide.
   */
  reducedMotion?: boolean;
  className?: string;
}

/**
 * A CTA whose face is one of Rive's own .riv animations — the strongest brand
 * continuity the redesign carries forward from the live site.
 *
 * THE OVERFLOW-CANVAS PATTERN (the whole point). The canvas is far bigger than
 * the button: 500×500 over a ~220px rocket, 269×150 over a ~150px cat. The
 * button element is the hitbox and sits in normal flow; the canvas is absolutely
 * positioned and centred on it, so the animation plays in the space AROUND the
 * button without occupying any layout. That is why these read as Rive rather
 * than as a CSS hover — and why the canvas takes `pointer-events: none` while
 * the button keeps `auto`. Nothing about the canvas can steal a click, a hover,
 * or a text selection.
 *
 * DOM-FIRST, CANVAS-ENHANCES. The button is a fully working DOM button before
 * any Rive code runs, and stays one if Rive never arrives. This is not a
 * nicety: `rive.wasm` is 2.41 MB — roughly 42× the three .riv files combined —
 * and the hero CTA is the most LCP-sensitive element on the page. Making the
 * canvas an enhancement means first paint never waits on the runtime. The DOM
 * label yields (to visually-hidden, never removed) only once the canvas is
 * actually live AND the file paints its own label.
 *
 * ACCESSIBLE NAME IS ALWAYS DOM. Both GET STARTED files paint their label
 * inside the artboard, which no assistive technology can read. The DOM label is
 * therefore never removed — only visually hidden — so the computed name always
 * matches the visible one (WCAG 2.5.3 Label in Name).
 *
 * REDUCED MOTION MOUNTS NO CANVAS AT ALL. The spec asked for a paused
 * first-frame render; the probe then established that both CTA files paint
 * "GET STARTED" into the artboard, which would collide with the DOM label that
 * must stay visible in this state — the same text, twice. So reduced motion
 * renders the plain DOM button and never requests the .riv, which also matches
 * how `TileVideo` handles the same preference (an `<img>`, not a paused
 * `<video>`). Deviation recorded in the spec's Decision log.
 */
export function RiveButton({
  asset,
  label,
  href,
  variant = "primary",
  reducedMotion = false,
  className,
}: RiveButtonProps) {
  const [failed, setFailed] = useState(false);

  /* Reduced motion never mounts the canvas, so it never fetches the file. */
  const wantsCanvas = !reducedMotion;

  const { rive, RiveComponent } = useRive(
    wantsCanvas
      ? {
          src: asset.src,
          artboard: asset.artboard,
          stateMachines: asset.stateMachine,
          autoplay: true,
          onLoadError: () => setFailed(true),
        }
      : null,
  );

  /* Two distinct states, and conflating them is what broke this once:
     `mountCanvas` — put the canvas in the document so the runtime can attach.
     `canvasLive`  — the file has actually loaded and is painting. Only the
                     second may hide the DOM label or drop the button chrome. */
  const mountCanvas = wantsCanvas && !failed;
  const canvasLive = mountCanvas && Boolean(rive);

  /* Resolved once per load. `stateMachineInputs` walks the machine every call,
     so caching the handles keeps pointermove off that path. */
  const inputsRef = useRef(new Map<string, { value: boolean }>());
  useEffect(() => {
    if (!rive) return;
    const map = new Map<string, { value: boolean }>();
    for (const input of rive.stateMachineInputs(asset.stateMachine) ?? []) {
      map.set(input.name, input as unknown as { value: boolean });
    }
    inputsRef.current = map;
    return () => {
      inputsRef.current = new Map();
    };
  }, [rive, asset.stateMachine]);

  /**
   * Drive the hover inputs from the pointer's position across the hitbox.
   * `t` is 0→1 left-to-right, or null for "pointer has left".
   *
   * The cat splits its button into five zones and leans toward the cursor; the
   * rocket has a single input owning the whole width. A file with no inputs
   * (the R logo) falls out of this loop untouched — it is autonomous.
   */
  const applyHover = (t: number | null) => {
    for (const hover of asset.hoverInputs) {
      const input = inputsRef.current.get(hover.name);
      if (!input) continue;
      const active = t !== null && t >= hover.zone[0] && t < hover.zone[1];
      if (input.value !== active) input.value = active;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!canvasLive || !asset.hoverInputs.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    applyHover((event.clientX - rect.left) / rect.width);
  };

  const handlePointerLeave = () => {
    if (!canvasLive || !asset.hoverInputs.length) return;
    applyHover(null);
  };

  /* Height follows the artboard ratio so the .riv never distorts. */
  const renderWidth = asset.renderWidth ?? asset.width;
  const canvasStyle = {
    "--rive-button-w": `${renderWidth}px`,
    "--rive-button-h": `${(renderWidth * asset.height) / asset.width}px`,
  } as React.CSSProperties;

  const hideLabel = canvasLive && asset.paintsOwnLabel;

  const content = (
    <>
      {/* Mounted as soon as a canvas is wanted, NOT once `rive` resolves.
          `useRive` only attaches the runtime after RiveComponent's canvas is in
          the document, so gating this on `rive` being non-null deadlocks: the
          file is never requested, `rive` stays null forever, and every button
          silently stays in its DOM fallback. `data-live` (not conditional
          rendering) is what keeps the empty canvas invisible until it paints. */}
      {mountCanvas && (
        <span
          className="rive-button__canvas"
          data-layout={asset.layout}
          data-live={canvasLive || undefined}
          style={canvasStyle}
          aria-hidden="true"
        >
          <RiveComponent className="rive-button__surface" />
        </span>
      )}
      <span
        className="rive-button__label"
        data-hidden={hideLabel || undefined}
      >
        {label}
      </span>
    </>
  );

  const shared = {
    className: className ? `rive-button ${className}` : "rive-button",
    "data-variant": variant,
    "data-layout": asset.layout,
    "data-canvas": canvasLive ? "live" : "dom",
    onPointerMove: handlePointerMove,
    onPointerLeave: handlePointerLeave,
  };

  /* An href makes it a real link, matching Button's behaviour — CTAs navigate
     without nesting interactive elements. */
  return href ? (
    <a {...shared} href={href}>
      {content}
    </a>
  ) : (
    <button {...shared} type="button">
      {content}
    </button>
  );
}

export default RiveButton;
