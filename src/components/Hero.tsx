import { RiveButton } from "./RiveButton";
import { GET_STARTED_ROCKET, R_LOGO_SHUFFLE } from "./riveSiteAssets";
import { usePrefersReducedMotion } from "./UseCaseModal/usePrefersReducedMotion";
import "./Hero.css";

const EDITOR_URL = "https://editor.rive.app";

export interface HeroProps {
  /**
   * The small mono line under the CTAs. A prop because it is a ticker, not
   * copy — it carries whatever is newest, and the live site changes it.
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
export function Hero({ status = "SCRIPTING IS LIVE", reducedMotion }: HeroProps) {
  const systemReduce = usePrefersReducedMotion();
  const reduce = reducedMotion ?? systemReduce;

  return (
    <section className="hero">
      {/* Letterspacing is CSS, not literal spaces: "R I V E" in the markup
          would be announced letter-by-letter. */}
      <span className="hero__wordmark">RIVE</span>

      <h1 className="hero__title">
        Interactive graphics that ship straight to production
      </h1>

      <p className="hero__subhead">
        Design, animate, and code in one tool — then run the same file natively
        on web, mobile, games, and cars.
      </p>

      <p className="hero__range">From a single button to two billion users.</p>

      <div className="hero__ctas">
        <RiveButton
          asset={GET_STARTED_ROCKET}
          label="Get started"
          href={EDITOR_URL}
          variant="primary"
          reducedMotion={reduce}
        />
        <RiveButton
          asset={R_LOGO_SHUFFLE}
          label="Downloads"
          href="#"
          variant="secondary"
          reducedMotion={reduce}
        />
      </div>

      <p className="hero__status">{status}</p>
    </section>
  );
}

export default Hero;
