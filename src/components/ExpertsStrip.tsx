import SectionHeader from "./SectionHeader";
import "./ExpertsStrip.css";

const NETWORK_URL = "https://contra.com/rive";

/**
 * A Rive Expert on Contra.
 *
 * Every name and tagline was read from the person's own live profile on
 * 2026-07-29 — harvested, never written from memory.
 *
 * TWO SOURCE FIELDS, KNOWINGLY MIXED. Contra profiles carry a short role in
 * `<title>` ("Katy Sander - 2D Animator") and a longer self-written bio line on
 * the page itself. Five of these come from the title, four from the bio, because
 * the bio was the more specific line for those four. Both are the person's own
 * words; if this list is ever re-harvested, check BOTH fields rather than
 * assuming the title is the tagline.
 *
 * Two deliberate departures, each because the raw string would misrepresent
 * someone, and each pinned by a test:
 *
 * - Javier's reads "…building creatives experiences." — his own typo, which
 *   would read as ours. Corrected, not paraphrased.
 * - Emoji are stripped (George Weatherhead's rocket): a tagline that may
 *   truncate should spend its last characters on words.
 */
interface Expert {
  name: string;
  tagline: string;
  href: string;
}

/**
 * A CURATED NINE, not the roster.
 *
 * contra.com/rive headlines "186 Experts". Its signed-out view serves only eight
 * cards and its preview panel is login-gated, so the full network cannot be read
 * anonymously — an earlier version of this comment said the page "lists exactly
 * eight", which was the first page of a virtualised list mistaken for the whole
 * thing. These nine are a chosen sample; the CTA below is what points at the
 * network proper.
 *
 * Order is deliberate but carries no ranking — it is the order the section reads
 * best in, and nothing in the markup distinguishes one card from another.
 */
const EXPERTS: Expert[] = [
  {
    name: "Javier Oliver",
    tagline: "Branding/UX-UI designer building creative experiences",
    href: "https://contra.com/javier_oliver",
  },
  {
    name: "Katy Sander",
    tagline: "2D Animator",
    href: "https://contra.com/katysanderitsme",
  },
  {
    name: "George Weatherhead",
    tagline: "I animate interactive, gamified worlds",
    href: "https://contra.com/georgeweatherhead",
  },
  {
    name: "Leo Mazzei",
    tagline: "Motion & Interactivity | Rive Ambassador",
    href: "https://contra.com/leomazzei",
  },
  {
    name: "Matthew Haar",
    tagline: "3D Animator",
    href: "https://contra.com/matthew_haar_503t9n8f",
  },
  {
    name: "Radityo Nugroho",
    tagline: "Interaction Designer",
    href: "https://contra.com/radityo_nugroho_u4aqwcg3",
  },
  {
    name: "Bartek Radziejewski",
    /* The full stop is his. */
    tagline: "Not boring: Apps, Web, Rive animations, Framer.",
    href: "https://contra.com/bart_radz",
  },
  {
    name: "Ashley Best",
    tagline: "Interactive / Animation / Web Development / Sound Design",
    href: "https://contra.com/ashleybest",
  },
  {
    name: "Emanuele Colombo",
    tagline: "Motion Designer",
    href: "https://contra.com/emanuele_colombo_z1y8crrl",
    /* Deliberate adjacency, not a coincidence: his featured work includes
       Spotify Wrapped 2025 — the same project CaseStudies opens the page with.
       Someone who reads that case study and then scrolls here can hire a person
       who worked on it. Verified on his profile at harvest time. */
  },
];

/** First letters of the first two words — "Katy Sander" → "KS". */
function monogram(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The hire-the-network band.
 *
 * This answers the one question nothing else on the page does: someone wants
 * this built and has nobody to build it. So the angle is procurement, not
 * celebration — and this is the ONE section where sending a visitor off-site is
 * the conversion rather than the bounce. No modal, no interception, no capture;
 * the links go straight out to Contra.
 */
export function ExpertsStrip() {
  return (
    <section className="experts-strip">
      <SectionHeader
        eyebrow="NEED IT BUILT?"
        title="Hire someone who already knows Rive"
      />

      <p className="experts-strip__line">
        Vetted independents who build in Rive for a living. Brief one directly on
        Contra.
      </p>

      <ul className="experts-strip__grid">
        {EXPERTS.map((expert) => (
          <li key={expert.href}>
            <a
              className="experts-strip__card"
              href={expert.href}
              target="_blank"
              rel="noopener"
            >
              {/* A monogram, never a photo. We hold no rights to nine people's
                  likenesses and no way to keep a scraped avatar current, so this
                  is a rights decision rather than a style one. It also means the
                  row cannot decay into nine broken-image icons if a CDN moves. */}
              <span className="experts-strip__monogram" aria-hidden="true">
                {monogram(expert.name)}
              </span>
              <span className="experts-strip__who">
                <span className="experts-strip__name">{expert.name}</span>
                {/* Truncated in CSS; `title` carries the full line for anyone
                    who meets the ellipsis. */}
                <span className="experts-strip__tagline" title={expert.tagline}>
                  {expert.tagline}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <a className="text-link" href={NETWORK_URL} target="_blank" rel="noopener">
        Browse all Rive Experts →
      </a>
    </section>
  );
}

export default ExpertsStrip;
