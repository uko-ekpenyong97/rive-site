import SectionHeader from "./SectionHeader";
import "./ExpertsStrip.css";

const NETWORK_URL = "https://contra.com/rive";

/**
 * A Rive Expert, as listed on contra.com/rive.
 *
 * Names and taglines were read from each profile's own `<title>` on 2026-07-29,
 * not written from memory. Three deliberate departures from the raw meta, each
 * because the raw string would misrepresent the person:
 *
 * - Val Guerra's profile reads "Hiring as an Individual", which is a Contra
 *   account MODE, not a specialty. A neutral "Rive Expert" is used rather than
 *   inventing a discipline for her.
 * - Javier's reads "…building creatives experiences." — his own typo. Repeating
 *   it verbatim would read as ours.
 * - Emoji are stripped (George Weatherhead's 🚀): a tagline that may truncate
 *   should spend its last characters on words.
 */
interface Expert {
  name: string;
  tagline: string;
  href: string;
}

/**
 * The eight listed at contra.com/rive?view=people, in that page's order, plus
 * this site's author last.
 *
 * The author is appended rather than featured on purpose. Being discoverable in
 * the network is the honest claim; putting the person who built the page at the
 * top of the hire-us list would be the section selling itself instead of the
 * network. That position is pinned by a test, so moving it is a decision rather
 * than an accident.
 *
 * NOTE ON THAT LAST ENTRY: contra.com/rive lists eight people and this profile
 * is not among them — it was supplied directly and verified by fetching it (the
 * page does claim "Rive expert"). Its Contra display name is "Lu & Ko Studio",
 * the author's studio; the person's name is used here, the same call made for
 * Javier, whose profile displays "JAVIER @DSpot".
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
    name: "Val Guerra",
    tagline: "Rive Expert",
    href: "https://contra.com/valguerra",
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
    name: "Dmytro Petrenko",
    tagline: "Product, UI/UX & Motion Design for Web",
    href: "https://contra.com/ortymdesign",
  },
  {
    name: "Brynjar Palsson",
    tagline: "2D Animator",
    href: "https://contra.com/brynjar_palsson_ryzx2jec",
  },
  {
    name: "Uko Ekpenyong",
    tagline: "Interaction Designer",
    href: "https://contra.com/luandko_timksmg2",
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
              {/* A monogram, never a photo. We hold no rights to eight people's
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
