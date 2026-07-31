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
 * the button: 500×500 for the rocket, 269×150 for the cat, over buttons around
 * 110px wide. The button is ordinary content in normal flow and it defines the
 * layout, full stop. The canvas is absolutely positioned and aimed at the button
 * via the asset's anchor, so the art hangs wherever it wants — below for the
 * cat, above for the rocket — and occupies NO layout anywhere.
 *
 * THERE IS NO RESERVED SPACE, anywhere, by design. An absolutely positioned
 * element cannot cause layout shift, so reserving room for it only ever bought
 * dead space: an earlier version reserved 210px above and below the CTA row and
 * made the hero 68% taller than it needed to be, for nothing.
 *
 * POINTER MODEL IS PROBED, NOT CHOSEN (`asset.pointer`, see riveSiteAssets.ts).
 * A file that carries its own listeners resolves pointer position against its
 * own art, so the canvas receives events and we write nothing — correct by
 * construction, because the hitboxes and the art are the same file. A file with
 * no listeners is driven from the BUTTON's hover, so a pointer outside the
 * button provokes nothing. Getting this backwards is easy: the cat has shapes
 * named `Hitbox_*` and no listeners, the rocket has listeners and no such shape.
 *
 * DOM-FIRST, CANVAS-ENHANCES. The button is a fully working DOM button before
 * any Rive code runs, and stays one if Rive never arrives. This is not a
 * nicety: `rive.wasm` is 2.41 MB — roughly 35× the three .riv files combined —
 * and the hero CTA is the most LCP-sensitive element on the page. Making the
 * canvas an enhancement means first paint never waits on the runtime. The DOM
 * label yields (to `color: transparent`, never removed, so the box and the
 * accessible name both survive) only once the canvas is actually live AND the
 * file paints its own label.
 *
 * ACCESSIBLE NAME IS ALWAYS DOM. Both GET STARTED files paint their label
 * inside the artboard, which no assistive technology can read. The DOM label is
 * therefore never removed and never taken out of flow — only made transparent —
 * so the computed name matches the visible one (WCAG 2.5.3 Label in Name) and
 * the hitbox keeps the size it had before the canvas arrived.
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

  /* Only a "manual" file is ever driven. For a "listeners" file the runtime owns
     the pointer entirely, and writing its inputs alongside would fight it. */
  const drivesManually = asset.pointer === "manual";

  /* Resolved once per load. `stateMachineInputs` walks the machine every call,
     so caching the handles keeps pointermove off that path. */
  const inputsRef = useRef(new Map<string, { value: boolean }>());
  useEffect(() => {
    if (!rive || !drivesManually) return;
    const map = new Map<string, { value: boolean }>();
    for (const input of rive.stateMachineInputs(asset.stateMachine) ?? []) {
      map.set(input.name, input as unknown as { value: boolean });
    }
    inputsRef.current = map;
    return () => {
      inputsRef.current = new Map();
    };
  }, [rive, asset.stateMachine, drivesManually]);

  /**
   * Drive the declared inputs from the pointer's position across the button.
   * `t` is 0→1 left-to-right, or null for "pointer has left".
   *
   * Only ever reached by a "manual" file. In practice that is the cat, which
   * splits the button into five zones and leans toward the cursor.
   */
  const applyHover = (t: number | null) => {
    for (const hover of asset.declaredInputs) {
      const input = inputsRef.current.get(hover.name);
      if (!input) continue;
      const active = t !== null && t >= hover.zone[0] && t < hover.zone[1];
      if (input.value !== active) input.value = active;
    }
  };

  /* Measured against the BUTTON, not the canvas and not a wrapper: the zones are
     the button's own width, so leaving the button clears every zone and the art
     never reacts to a pointer that is merely near it. */
  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!canvasLive || !drivesManually) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    applyHover((event.clientX - rect.left) / rect.width);
  };

  const handlePointerLeave = () => {
    if (!canvasLive || !drivesManually) return;
    applyHover(null);
  };

  /* Height follows the artboard ratio so the .riv never distorts. */
  const renderWidth = asset.renderWidth ?? asset.width;
  const canvasStyle = {
    "--rive-button-w": `${renderWidth}px`,
    "--rive-button-h": `${(renderWidth * asset.height) / asset.width}px`,
    /* The canvas is placed so this point of it lands on the button's centre. */
    "--rive-anchor-x": `${(asset.anchorX ?? 0.5) * 100}%`,
    "--rive-anchor-y": `${(asset.anchorY ?? 0.5) * 100}%`,
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
          data-pointer={asset.pointer}
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
    "data-pointer": asset.pointer,
    "data-canvas": canvasLive ? "live" : "dom",
    /* Attached only for a manual file. A listeners file gets no DOM handlers at
       all, so there is nothing to race the runtime's own hit-testing. */
    ...(drivesManually
      ? { onPointerMove: handlePointerMove, onPointerLeave: handlePointerLeave }
      : {}),
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
