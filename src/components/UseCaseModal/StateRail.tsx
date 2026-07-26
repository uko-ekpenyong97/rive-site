import { useEffect, useRef } from "react";
import "./StateRail.css";

/* ──────────────────────────────────────────────────────────────────────────
 * STATE RAIL — live status readout AND control surface.
 *
 * The rail is the argument the Product UI hero exists to make: the character's
 * state is a data-bound enum, so the same value that drives the animation can be
 * read back as status and written to as a control. The active pill therefore
 * reflects what the runtime reports, never what we assumed a click did.
 *
 * Kept deliberately pure — it takes the state list and the active value as plain
 * props, so it renders identically in tests and carries no Rive dependency.
 * ────────────────────────────────────────────────────────────────────────── */

export interface StateRailProps {
  /** Ordered state values, ultimately sourced from the file's own enum. */
  states: string[];
  /** The runtime's current value. */
  active: string | null;
  onSelect: (state: string) => void;
  /** Labels the group for assistive tech, e.g. "Nosey agent state". */
  label: string;
}

export function StateRail({ states, active, onSelect, label }: StateRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  /* Roving tabindex: the group holds one tab stop and arrows move within it. */
  const activeIndex = Math.max(0, states.indexOf(active ?? ""));

  /* When focus is inside the rail, keep it on the pill that is actually current
     so arrow navigation continues from where the eye is. */
  const focusIndex = (index: number) => {
    const pills = railRef.current?.querySelectorAll<HTMLButtonElement>(
      "[role='radio']",
    );
    pills?.[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const last = states.length - 1;
    let next: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = activeIndex >= last ? 0 : activeIndex + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = activeIndex <= 0 ? last : activeIndex - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }

    event.preventDefault();
    /* Radiogroup convention: arrowing selects, it does not merely move focus. */
    onSelect(states[next]);
    focusIndex(next);
  };

  return (
    <div
      ref={railRef}
      className="state-rail"
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {states.map((state, index) => {
        const isActive = state === active;
        return (
          <button
            key={state}
            type="button"
            role="radio"
            aria-checked={isActive}
            /* Only the current pill is tabbable — the group is one tab stop. */
            tabIndex={index === activeIndex ? 0 : -1}
            className="state-rail__pill"
            data-active={isActive || undefined}
            onClick={() => onSelect(state)}
          >
            {state}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Scrolls the active pill into view when the auto-cycle advances past the
 * visible edge of a narrow rail. Separate from the component so the rail itself
 * stays free of layout side effects.
 */
export function useScrollActivePillIntoView(
  containerRef: React.RefObject<HTMLElement | null>,
  active: string | null,
) {
  useEffect(() => {
    if (!active) return;
    const pill = containerRef.current?.querySelector<HTMLElement>(
      "[role='radio'][data-active]",
    );
    pill?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [containerRef, active]);
}

export default StateRail;
