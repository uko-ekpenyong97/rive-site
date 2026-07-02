import { useEffect, useRef, useState } from "react";
import SectionHeader from "./SectionHeader";
import "./StatsBand.css";

interface Stat {
  value: number;
  suffix: string;
  label: string;
}

const STATS: Stat[] = [
  {
    value: 4,
    suffix: "×",
    label: "faster production than traditional motion workflows",
  },
  { value: 90, suffix: "%", label: "smaller files than equivalent video" },
  {
    value: 2,
    suffix: "×",
    label: "user engagement after teams ship with Rive",
  },
  { value: 120, suffix: "fps", label: "from browsers to vehicle dashboards" },
];

const TARGETS = STATS.map((s) => s.value);
const DURATION_MS = 800;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Animates the four stat numbers from 0 to their targets exactly once, when
 * the band scrolls ~30% into view. Honors prefers-reduced-motion by rendering
 * the final values immediately (no animation, no initial flash of 0).
 */
function useCountUp() {
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [values, setValues] = useState<number[]>(() =>
    prefersReducedMotion() ? TARGETS : TARGETS.map(() => 0)
  );

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();

        let startTs: number | null = null;
        const tick = (ts: number) => {
          if (startTs === null) startTs = ts;
          const t = Math.min(1, (ts - startTs) / DURATION_MS);
          const eased = easeOut(t);
          setValues(TARGETS.map((v) => Math.round(v * eased)));
          if (t < 1) requestAnimationFrame(tick);
          else setValues(TARGETS);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, values };
}

export function StatsBand() {
  const { ref, values } = useCountUp();

  return (
    <section className="stats-band">
      <SectionHeader eyebrow="PROOF" title="Why teams ship with Rive" />

      <div className="stats-band__grid" ref={ref}>
        {STATS.map((stat, i) => (
          <div key={stat.label} className="stats-band__stat">
            <div className="stats-band__value">
              <span className="stats-band__number">{values[i]}</span>
              <span className="stats-band__suffix">{stat.suffix}</span>
            </div>
            <div className="stats-band__label">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StatsBand;
