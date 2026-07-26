import { NoseyHero } from "./NoseyHero";
import { RiveHero } from "./RiveHero";
import { DEFAULT_DIALS, type ModalDials } from "./dials";
import type { UseCaseHero } from "./useCaseContent";
import "./ModalHero.css";

export interface ModalHeroProps {
  hero: UseCaseHero;
  /** The modal is open — threaded down so the canvas can idle when it is not. */
  active?: boolean;
  /** Resolved motion dials; defaults let the hero render standalone in tests. */
  dials?: ModalDials;
  reducedMotion?: boolean;
}

/**
 * The hero slot — spec §4.2. Holds a live, credited .riv: the thesis is "the site
 * is made of the product", so this is never a video. `type: "pending"` renders a
 * labeled placeholder until a real file is wired (§8: never a broken canvas).
 *
 * Two integration modes (spec §5), chosen by what the content model provides:
 * - `rail` → first-party, state driven through data binding (Nosey).
 * - `ghost` → third-party, a ghost cursor demonstrates a pointer interaction.
 *
 * The credit chip is load-bearing — live and credited proves interactivity and,
 * for community work, social proof in one artifact. Where the file carries a
 * licence it is also a legal requirement, so it ships in every state including
 * mobile. Only community files earn the "from the community" suffix.
 */
export function ModalHero({
  hero,
  active = true,
  dials = DEFAULT_DIALS,
  reducedMotion = false,
}: ModalHeroProps) {
  const credit = hero.type === "pending" ? undefined : hero.credit;
  const caption = hero.type === "riv" ? hero.caption : undefined;

  return (
    <figure className="modal-hero" data-kind={hero.type}>
      {hero.type === "riv" ? (
        hero.rail ? (
          <NoseyHero
            hero={{ ...hero, rail: hero.rail }}
            active={active}
            stateDwell={dials.stateDwell}
            cycleResumeDelay={dials.cycleResumeDelay}
            reducedMotion={reducedMotion}
          />
        ) : (
          <RiveHero
            hero={hero}
            active={active}
            ghostIdleDelay={dials.ghostIdleDelay}
            reducedMotion={reducedMotion}
          />
        )
      ) : hero.type === "image" ? (
        <img className="modal-hero__media" src={hero.src} alt={hero.alt} />
      ) : (
        <span className="modal-hero__placeholder">{hero.label}</span>
      )}

      {(caption || credit) && (
        <figcaption className="modal-hero__caption">
          {caption && <span className="modal-hero__caption-text">{caption}</span>}
          {credit && <CreditChip credit={credit} />}
        </figcaption>
      )}
    </figure>
  );
}

function CreditChip({ credit }: { credit: NonNullable<Exclude<UseCaseHero, { type: "pending" }>["credit"]> }) {
  const text =
    credit.provenance === "community"
      ? `${credit.file} · by ${credit.creator} · from the community`
      : `${credit.file} · by ${credit.creator}`;

  /* The licence is context, not copy — it belongs in the accessible name and the
     tooltip. "Original work" needs no CC framing on the surface. */
  const described = credit.license ? `${text} · ${credit.license}` : text;

  /* With no URL yet, the chip is still shown — as text, never a dead link. */
  if (!credit.href) {
    return (
      <span className="modal-hero__credit" title={described} aria-label={described}>
        {text}
      </span>
    );
  }

  return (
    <a
      className="modal-hero__credit"
      href={credit.href}
      target="_blank"
      rel="noreferrer"
      title={described}
      aria-label={described}
    >
      {text}
    </a>
  );
}

export default ModalHero;
