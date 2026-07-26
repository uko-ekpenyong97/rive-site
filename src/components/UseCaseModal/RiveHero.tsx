import { useEffect, useRef, useState } from "react";
/* WebGL2 build = Rive's GPU renderer, the same one LoopCanvas uses. Reused
 * deliberately: it is already in the bundle for the homepage Loop canvas, so the
 * hero adds no runtime weight, and the CPU canvas build visibly stutters. */
import { useRive } from "@rive-app/react-webgl2";
import { GhostCursor } from "./GhostCursor";
import type { UseCaseHero } from "./useCaseContent";
import "./RiveHero.css";

type RivHero = Extract<UseCaseHero, { type: "riv" }>;

export interface RiveHeroProps {
  hero: RivHero;
  /** The modal is open. When false the state machine is paused (idle rule). */
  active: boolean;
  /** §6 ghost-idle-delay, in ms. */
  ghostIdleDelay: number;
  reducedMotion: boolean;
}

/**
 * The live hero canvas. The .riv is fetched only when this mounts — which only
 * happens once a modal has been opened — and the state machine is paused the
 * moment the modal closes, because the sheet's content stays mounted through the
 * exit animation.
 *
 * If the file fails to load we fall back to the labelled placeholder rather than
 * leaving a dead canvas (spec §8).
 */
export function RiveHero({
  hero,
  active,
  ghostIdleDelay,
  reducedMotion,
}: RiveHeroProps) {
  const [failed, setFailed] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const { rive, RiveComponent } = useRive({
    src: hero.src,
    artboard: hero.artboard,
    stateMachines: hero.stateMachine,
    /* Autoplay is honest here: the hero is the interaction, and it is only ever
       mounted behind a deliberate click. Reduced motion is handled below. */
    autoplay: !reducedMotion,
    /* No explicit Layout: the runtime already defaults to contain/centre, and
       because the wrapper is locked to the artboard's own aspect ratio there is
       nothing to letterbox — artboard coordinates map 1:1 onto the element box,
       which is what makes the ghost's normalized target land correctly. Keeping
       the import surface to `useRive` also matches LoopCanvas. */
    onLoadError: () => setFailed(true),
  });

  /* One source of truth for "the machine is not advancing" — the pause effect and
     the ghost's invitation both read it, so a hint can never outlive playback. */
  const paused = !active || reducedMotion;

  /* Idle correctness: no state machine advance for a modal nobody is looking at. */
  useEffect(() => {
    if (!rive) return;
    if (paused) rive.pause();
    else rive.play();
  }, [rive, paused]);

  if (failed) {
    return (
      <div className="rive-hero" data-state="failed">
        <span className="rive-hero__placeholder">{hero.fallbackLabel}</span>
      </div>
    );
  }

  return (
    <div
      className="rive-hero"
      /* Locked to the artboard ratio so Fit.Contain letterboxes nothing and the
         ghost's normalized coordinates land where the artboard says they do.
         maxWidth keeps a square/tall artboard from dominating the sheet. */
      style={{
        aspectRatio: `${hero.width} / ${hero.height}`,
        maxWidth: hero.maxWidth ? `${hero.maxWidth}px` : undefined,
        marginInline: hero.maxWidth ? "auto" : undefined,
      }}
    >
      <div className="rive-hero__surface" ref={surfaceRef}>
        <RiveComponent className="rive-hero__canvas" />
      </div>

      {hero.ghost && (
        <GhostCursor
          target={hero.ghost}
          surfaceRef={surfaceRef}
          idleDelay={ghostIdleDelay}
          ready={Boolean(rive)}
          active={active}
          paused={paused}
          reducedMotion={reducedMotion}
        />
      )}
    </div>
  );
}

export default RiveHero;
