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
  /**
   * Fired from the button's own enter/leave, so a sibling can react to this CTA
   * being hovered (the hero dims DOWNLOADS while GET STARTED is hovered).
   *
   * Deliberately NOT gated on the canvas being live: this is a DOM affordance
   * and it has to work when the 2.41 MB wasm is still in flight or has failed,
   * which is the same reasoning that makes the whole component DOM-first.
   */
  onHoverChange?: (hovered: boolean) => void;
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
 * THE CANVAS IS DISPLAY-ONLY. It is `pointer-events: none` for every file, with
 * no exceptions — the live site's own arrangement. The BUTTON is the entire
 * hitbox, so nothing outside its rect can provoke the animation and nothing
 * below the button is interactive. An earlier build let a file with its own
 * listeners take the pointer directly; that is not how rive.app works, and a
 * 500×500 transparent canvas that accepts pointers makes the copy underneath it
 * unselectable in exchange for nothing.
 *
 * Inputs are therefore always driven from the button's own hover, and only the
 * inputs the probe confirmed (`declaredInputs`). Anything in `undrivenInputs` is
 * verified to exist and deliberately left alone.
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
  onHoverChange,
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

  /* An autonomous file ("none") has nothing to drive and gets no handlers. */
  const drivesManually = asset.pointer === "manual";

  /* A single input spanning the whole button needs no position — entering the
     button IS the signal. Splitting on this keeps per-move work off the rocket,
     which is the heaviest canvas on the page. */
  const singleInput =
    asset.declaredInputs.length === 1 &&
    asset.declaredInputs[0].zone[0] === 0 &&
    asset.declaredInputs[0].zone[1] === 1;

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
   * `undrivenInputs` are never touched here — that list exists precisely so the
   * choice not to write them is explicit and checkable.
   */
  const applyHover = (t: number | null) => {
    for (const hover of asset.declaredInputs) {
      const input = inputsRef.current.get(hover.name);
      if (!input) continue;
      const active = t !== null && t >= hover.zone[0] && t < hover.zone[1];
      if (input.value !== active) input.value = active;
    }
  };

  /* Measured against the BUTTON, not the canvas and not a wrapper: the halves
     are the button's own width, so leaving the button clears both and the art
     never reacts to a pointer that is merely near it. */
  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!canvasLive || !drivesManually || singleInput) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    applyHover((event.clientX - rect.left) / rect.width);
  };

  /* Single-input files (the rocket) switch on entering the button at all. */
  const handlePointerEnter = () => {
    onHoverChange?.(true);
    if (!canvasLive || !drivesManually || !singleInput) return;
    applyHover(0.5);
  };

  const handlePointerLeave = () => {
    onHoverChange?.(false);
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

  /* An autonomous file with a hover listener still needs enter/leave — hence
     `onHoverChange` counting here independently of `drivesManually`. */
  const wantsMove = drivesManually && !singleInput;
  const wantsEnter = onHoverChange !== undefined || (drivesManually && singleInput);

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
    /* ONLY on the button element — never a wrapper and never the canvas. That is
       what makes the hitbox exactly the button rect: no other node in the tree
       can start an animation or report a hover.
         move  — halves need the pointer's position across the button
         enter — single-input files, and anyone listening via onHoverChange
         leave — whenever either of the above is attached */
    ...(wantsMove ? { onPointerMove: handlePointerMove } : {}),
    ...(wantsEnter ? { onPointerEnter: handlePointerEnter } : {}),
    ...(wantsMove || wantsEnter
      ? { onPointerLeave: handlePointerLeave }
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
