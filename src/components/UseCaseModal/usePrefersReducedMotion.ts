import { useEffect, useState } from "react";

/**
 * Live `prefers-reduced-motion` state. Shared so every part of the modal — the
 * sheet choreography, the hero canvas, and the ghost cursor — resolves the
 * preference the same way, including when no explicit override is passed.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return reduce;
}
