import { useCallback, useEffect, useRef, useState } from "react";
/* Same WebGL2 runtime as LoopCanvas and RiveHero — no second runtime. */
import { useRive } from "@rive-app/react-webgl2";
import { StateRail, useScrollActivePillIntoView } from "./StateRail";
import type { UseCaseHero } from "./useCaseContent";
import "./NoseyHero.css";

type RivHero = Extract<UseCaseHero, { type: "riv" }>;

export interface NoseyHeroProps {
  hero: RivHero & { rail: NonNullable<RivHero["rail"]> };
  /** The modal is open; the canvas and the cycle both idle when false. */
  active: boolean;
  /** §6 state-dwell — ms per state during the auto-cycle. */
  stateDwell: number;
  /** §6 cycle-resume-delay — quiet time after a manual pick. */
  cycleResumeDelay: number;
  reducedMotion: boolean;
}

/* How long a one-shot is given to play before the rail returns to rest. The file
 * returns to Idle on its own exit-time; this only clears the enum so Idle does
 * not immediately re-enter the shot (see the caveat in useCaseContent). */
const ONE_SHOT_HOLD_MS = 1600;

/**
 * The Product UI hero — Nosey, first-party, state driven by data binding.
 *
 * FIRST-PARTY MODE (spec §5): we own this file, so the state enum is written
 * directly through `viewModelInstance.enum(...)`. No synthetic pointer events.
 *
 * The rail's state list comes from the runtime (`.values`), ordered by the
 * curated config, so it cannot drift from the file. The active pill comes from
 * the runtime's own change callback rather than from local optimism.
 *
 * REDUCED MOTION: the auto-cycle never starts and Nosey rests in its default
 * state — but the rail stays fully interactive. A click is user intent, not
 * ambient motion, so suppressing it would be a loss of function, not a kindness.
 */
export function NoseyHero({
  hero,
  active,
  stateDwell,
  cycleResumeDelay,
  reducedMotion,
}: NoseyHeroProps) {
  const { rail } = hero;
  const [failed, setFailed] = useState(false);
  /* Mirrors the runtime's value; never written optimistically on click. */
  const [current, setCurrent] = useState<string | null>(null);
  /* Seeded from the curated order so the rail is populated on first paint, then
     reconciled against the runtime's own list once the file loads. */
  const [states, setStates] = useState<string[]>(rail.order);
  /* Null = the auto-cycle owns the state. A timestamp = the visitor does. */
  const manualUntil = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { rive, RiveComponent } = useRive({
    src: hero.src,
    artboard: hero.artboard,
    stateMachines: hero.stateMachine,
    /* Required for viewModelInstance — the binding path LoopCanvas established. */
    autoBind: true,
    autoplay: true,
    onLoadError: () => setFailed(true),
  });

  const enumProp = useCallback(
    () => rive?.viewModelInstance?.enum(rail.property) ?? null,
    [rive, rail.property],
  );

  /* Read the file's own value list and subscribe to changes. The runtime is the
     source of truth for both what exists and what is current. */
  useEffect(() => {
    const prop = enumProp();
    if (!prop) return;

    const fromFile = prop.values ?? [];
    /* Curated order first, then anything the file has that config missed — so a
       new state added in Rive still appears instead of vanishing. */
    const ordered = [
      ...rail.order.filter((s) => fromFile.includes(s)),
      ...fromFile.filter((s) => !rail.order.includes(s)),
    ];
    setStates(ordered.length > 0 ? ordered : rail.order);
    setCurrent(prop.value ?? null);

    const onChange = () => setCurrent(prop.value ?? null);
    prop.on(onChange);
    return () => prop.off(onChange);
  }, [enumProp, rail.order]);

  const write = useCallback(
    (value: string) => {
      const prop = enumProp();
      if (!prop) return;
      prop.value = value;
      /* Read straight back: if the write did not take, the rail must not lie. */
      setCurrent(prop.value ?? null);
    },
    [enumProp],
  );

  /* Manual pick: take control, set the state, arm the resume timer. */
  const onSelect = useCallback(
    (value: string) => {
      manualUntil.current = performance.now() + cycleResumeDelay;
      write(value);

      /* One-shots would loop forever if the enum stayed set (the file's Idle
         re-enters them), so hand the state back to rest once played. */
      if (rail.oneShots.includes(value)) {
        window.setTimeout(() => {
          if (enumProp()?.value === value) write(rail.rest);
        }, ONE_SHOT_HOLD_MS);
      }
    },
    [cycleResumeDelay, write, rail.oneShots, rail.rest, enumProp],
  );

  /* The ambient walk. Sustained states only, so nothing self-loops. */
  useEffect(() => {
    if (!rive || !active || reducedMotion || failed) return;

    let step = 0;
    const tick = window.setInterval(() => {
      /* Yield while the visitor still owns the state. */
      if (manualUntil.current !== null) {
        if (performance.now() < manualUntil.current) return;
        manualUntil.current = null;
      }
      step = (step + 1) % rail.autoCycle.length;
      write(rail.autoCycle[step]);
    }, stateDwell);

    return () => window.clearInterval(tick);
  }, [rive, active, reducedMotion, failed, stateDwell, rail.autoCycle, write]);

  /* Idle correctness + reduced motion: rest the character rather than leaving it
     mid-cycle when the modal closes or motion is suppressed. */
  useEffect(() => {
    if (!rive) return;
    if (active && !reducedMotion) {
      rive.play();
    } else {
      if (reducedMotion) write(rail.rest);
      rive.pause();
    }
  }, [rive, active, reducedMotion, write, rail.rest]);

  useScrollActivePillIntoView(wrapRef, current);

  if (failed) {
    return (
      <div className="nosey-hero" data-state="failed">
        <span className="nosey-hero__placeholder">{hero.fallbackLabel}</span>
      </div>
    );
  }

  return (
    <div className="nosey-hero" ref={wrapRef}>
      <div
        className="nosey-hero__canvas-wrap"
        style={{
          aspectRatio: `${hero.width} / ${hero.height}`,
          maxWidth: hero.maxWidth ? `${hero.maxWidth}px` : undefined,
        }}
      >
        <RiveComponent className="nosey-hero__canvas" />
      </div>

      <StateRail
        states={states}
        active={current}
        onSelect={onSelect}
        label={`${hero.credit.file} agent state`}
      />
    </div>
  );
}

export default NoseyHero;
