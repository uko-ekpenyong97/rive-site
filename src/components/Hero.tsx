import { useState } from "react";
import { RiveButton } from "./RiveButton";
import { RIVE_WORDMARK_PATH, RIVE_WORDMARK_VIEWBOX } from "./riveWordmark";
import { GET_STARTED_ROCKET, R_LOGO_SHUFFLE } from "./riveSiteAssets";
import { usePrefersReducedMotion } from "./UseCaseModal/usePrefersReducedMotion";
import "./Hero.css";

const EDITOR_URL = "https://editor.rive.app";

export interface HeroProps {
  /**
   * The small mono line under the CTAs. A prop because it is a ticker, not
   * copy — it carries whatever is newest, and the live site changes it.
   *
   * NO DEFAULT, and the hero no longer passes one: omitted renders nothing and
   * reserves no space, so an empty ticker reads as designed-without rather than
   * as a gap. The slot and its entrance index stay wired for when it returns.
   */
  status?: string;
  /** Forces the reduced-motion path; showcase only. */
  reducedMotion?: boolean;
}

/**
 * The homepage hero — a centred single-column stack, carrying forward the live
 * site's structure and its animated Rive CTAs.
 *
 * THE CTAs ARE THE HERO DEMO. This replaced a 620px `DemoSlot` reservation that
 * had sat as a labelled placeholder since the first build. Retiring it was a
 * deliberate call, not a deferral: the layout is now centred and single-column,
 * so there is no side column for an artifact to live in, and the how-it-works
 * weight belongs to WorkflowStack immediately below. Any future hero artifact is
 * a fresh decision against this layout, not the resumption of a held slot.
 *
 * Copy is a hybrid. The headline, subhead and proof line are ours and stay:
 * they lead with what the product does and what it has reached, where the live
 * site's "THE INTERACTIVE EXPERIENCE ENGINE" asserts a category with nothing
 * behind it. What the live site does better is typographic — the letterspaced
 * wordmark opening the stack, and the mono status line closing it — so those
 * two slots are carried over.
 */
export function Hero({ status, reducedMotion }: HeroProps) {
  const systemReduce = usePrefersReducedMotion();
  const reduce = reducedMotion ?? systemReduce;

  /* The live site dims the secondary CTA while the primary is hovered, so the
     rocket's smoke drifts over a receded button rather than a competing one.
     State lives here rather than in RiveButton because it is a relationship
     BETWEEN the two buttons; RiveButton just reports its own hover. */
  const [primaryHovered, setPrimaryHovered] = useState(false);

  return (
    <section className="hero">
      {/* The logotype as vector outlines, from the same constant FooterMark
          draws — one source for the letterforms.

          DECORATIVE, deliberately. The nav already exposes "RIVE" as the home
          link and the H1 carries the proposition, so labelling this mark would
          make a screen reader announce the brand twice in a row for no added
          meaning. It is also what keeps the section free of `aria-label`
          entirely, which the CTAs depend on: a label there would REPLACE the
          name computed from the button's own text (WCAG 2.5.3 Label in Name). */}
      <span className="hero__wordmark" aria-hidden="true">
        <svg viewBox={RIVE_WORDMARK_VIEWBOX}>
          <path d={RIVE_WORDMARK_PATH} fill="currentColor" />
        </svg>
      </span>

      <h1 className="hero__title">
        Interactive graphics that ship straight to production
      </h1>

      <p className="hero__subhead">
        Design, animate, and code in one tool — then run the same file natively
        on web, mobile, games, and cars.
      </p>

      <p className="hero__range">From a single button to two billion users.</p>

      <div className="hero__ctas" data-primary-hovered={primaryHovered || undefined}>
        <RiveButton
          asset={GET_STARTED_ROCKET}
          label="Get started"
          href={EDITOR_URL}
          variant="primary"
          reducedMotion={reduce}
          onHoverChange={setPrimaryHovered}
        />
        <RiveButton
          asset={R_LOGO_SHUFFLE}
          label="Downloads"
          href="#"
          variant="secondary"
          reducedMotion={reduce}
        />
      </div>

      {/* Omitted entirely when absent — no empty <p>, no reserved line. */}
      {status && <p className="hero__status">{status}</p>}
    </section>
  );
}

export default Hero;
