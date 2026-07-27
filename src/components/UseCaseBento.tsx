import { useEffect, useRef, useState } from "react";
import BentoCell from "./BentoCell";
import SectionHeader from "./SectionHeader";
import { UseCaseModal } from "./UseCaseModal/UseCaseModal";
import {
  getUseCase,
  preloadHero,
  type UseCaseContent,
} from "./UseCaseModal/useCaseContent";
import { resolveDials, type ModalDials } from "./UseCaseModal/dials";
import "./UseCaseBento.css";

/* Cell layout — grid placement lives with the cell, content lives in
 * useCaseContent.ts. Adding a use case is a data edit plus one placement. */
const CELLS: {
  slug: string;
  size: "small" | "wide" | "large";
  featured?: boolean;
  /** Bento cells carry their own shorter title; the modal owns the full claim. */
  title: string;
  description?: string;
  gridColumn: string | number;
  gridRow: number;
}[] = [
  {
    slug: "product-ui",
    size: "large",
    featured: true,
    title: "Interfaces that respond in real time",
    description: "State-driven components running natively in your product.",
    gridColumn: "1 / 3",
    gridRow: 1,
  },
  {
    slug: "game-ui",
    size: "small",
    title: "Menus and HUDs at engine speed",
    gridColumn: 3,
    gridRow: 1,
  },
  {
    slug: "websites",
    size: "small",
    title: "Sites that respond to every visitor",
    gridColumn: 1,
    gridRow: 2,
  },
  {
    slug: "automotive",
    size: "small",
    title: "Dashboards at 120fps",
    gridColumn: 2,
    gridRow: 2,
  },
  {
    slug: "film-tv-broadcast",
    size: "small",
    title: "Live graphics that never miss",
    gridColumn: 3,
    gridRow: 2,
  },
  {
    slug: "campaigns",
    size: "wide",
    /* Retitled when the modal was anchored on Strava Year in Sport: the cell
       used to lead with Spotify Wrapped and its numbers, which both mismatched
       the modal behind it and kept Spotify material outside CaseStudies, where
       that story is reserved. */
    title: "Wrapped moments, made personal",
    description: "Interactive year-in-review campaigns, personalized for millions.",
    gridColumn: "1 / -1",
    gridRow: 3,
  },
];

export interface UseCaseBentoProps {
  /** Motion overrides from the DialKit tuning surface (showcase only). */
  dials?: Partial<ModalDials>;
  reducedMotion?: boolean;
}

export function UseCaseBento({ dials, reducedMotion }: UseCaseBentoProps = {}) {
  /* The open modal IS the section's only navigation state — cells no longer
     leak off the homepage (spec §1). */
  const [active, setActive] = useState<UseCaseContent | null>(null);

  /* Hover intent (§6 hover-preload-delay): a deliberate hover buys the .riv a
     head start, while a cursor sweeping across the grid costs nothing. */
  const preloadTimer = useRef<number | undefined>(undefined);
  const preloadDelay = resolveDials(dials).hoverPreloadDelay;

  const armPreload = (useCase: UseCaseContent) => {
    /* Nothing to warm for a heroless modal. */
    if (!useCase.hero) return;
    const { hero } = useCase;
    window.clearTimeout(preloadTimer.current);
    preloadTimer.current = window.setTimeout(
      () => preloadHero(hero),
      preloadDelay,
    );
  };
  const cancelPreload = () => window.clearTimeout(preloadTimer.current);

  useEffect(() => () => window.clearTimeout(preloadTimer.current), []);

  return (
    <section className="use-case-bento">
      <SectionHeader eyebrow="WHERE RIVE RUNS" title="Built for every surface" />

      <div className="use-case-bento__grid">
        {CELLS.map((cell) => {
          const content = getUseCase(cell.slug);
          return (
            <BentoCell
              key={cell.slug}
              size={cell.size}
              featured={cell.featured}
              eyebrow={content?.eyebrow ?? ""}
              title={cell.title}
              description={cell.description}
              href={content?.pageHref ?? "#"}
              onExpand={content ? () => setActive(content) : undefined}
              expandLabel={content?.name}
              onPointerEnter={content ? () => armPreload(content) : undefined}
              onPointerLeave={cancelPreload}
              style={{ gridColumn: cell.gridColumn, gridRow: cell.gridRow }}
            />
          );
        })}
      </div>

      <a href="#" className="text-link">
        Explore all use cases →
      </a>

      <UseCaseModal
        useCase={active}
        onClose={() => setActive(null)}
        dials={dials}
        reducedMotion={reducedMotion}
      />
    </section>
  );
}

export default UseCaseBento;
