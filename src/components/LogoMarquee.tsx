import type { CSSProperties, FunctionComponent, SVGProps } from "react";
import Spotify from "../assets/logos/spotify.svg?react";
import Notion from "../assets/logos/notion.svg?react";
import Google from "../assets/logos/google.svg?react";
import Duolingo from "../assets/logos/duolingo.svg?react";
import Samsung from "../assets/logos/samsung.svg?react";
import Figma from "../assets/logos/figma.svg?react";
import LinkedIn from "../assets/logos/linkedin.svg?react";
import Pepsi from "../assets/logos/pepsi.svg?react";
import Adobe from "../assets/logos/adobe.svg?react";
import Philips from "../assets/logos/philips.svg?react";
import Dropbox from "../assets/logos/dropbox.svg?react";
import Atlassian from "../assets/logos/atlassian.svg?react";
import SoundCloud from "../assets/logos/soundcloud.svg?react";
import Brilliant from "../assets/logos/brilliant.svg?react";
import Sonos from "../assets/logos/sonos.svg?react";
import "./LogoMarquee.css";

interface Logo {
  name: string;
  Svg: FunctionComponent<SVGProps<SVGSVGElement>>;
  // TODO: swap '#' for each company's real case-study URL when they're written.
  href: string;
  // Optical scale: every logo sits in an identical box, so wordmarks are
  // normalized by cap-height (not bounding box) via a per-brand multiplier.
  scale: number;
}

// Ordered for rhythm — a deliberate mix of wide and compact marks.
const LOGOS: Logo[] = [
  { name: "Spotify", Svg: Spotify, href: "#", scale: 0.6 },
  { name: "Notion", Svg: Notion, href: "#", scale: 0.55 },
  { name: "Google", Svg: Google, href: "#", scale: 0.6 },
  { name: "Duolingo", Svg: Duolingo, href: "https://rive.app/blog", scale: 0.64 },
  { name: "Samsung", Svg: Samsung, href: "#", scale: 0.9 },
  { name: "Figma", Svg: Figma, href: "#", scale: 1.7 },
  { name: "LinkedIn", Svg: LinkedIn, href: "#", scale: 0.56 },
  { name: "Pepsi", Svg: Pepsi, href: "#", scale: 0.58 },
  { name: "Adobe", Svg: Adobe, href: "#", scale: 0.55 },
  { name: "Philips", Svg: Philips, href: "#", scale: 0.74 },
  { name: "Dropbox", Svg: Dropbox, href: "#", scale: 0.9 },
  { name: "Atlassian", Svg: Atlassian, href: "#", scale: 1.08 },
  { name: "SoundCloud", Svg: SoundCloud, href: "#", scale: 0.55 },
  { name: "Brilliant", Svg: Brilliant, href: "#", scale: 0.59 },
  { name: "Sonos", Svg: Sonos, href: "#", scale: 2.83 },
];

function LogoGroup({ hidden }: { hidden?: boolean }) {
  return (
    <div className="marquee__group" aria-hidden={hidden || undefined}>
      {LOGOS.map(({ name, Svg, href, scale }) => (
        <a
          key={name}
          className="marquee__logo"
          href={href}
          aria-label={hidden ? undefined : name}
          // The duplicated copy is decorative — keep it out of the tab order.
          tabIndex={hidden ? -1 : undefined}
          style={{ "--logo-scale": scale } as CSSProperties}
        >
          <Svg className="marquee__svg" role="img" />
        </a>
      ))}
    </div>
  );
}

export function LogoMarquee() {
  return (
    <section className="marquee" aria-label="Companies building with Rive">
      <p className="marquee__label">
        TRUSTED IN PRODUCTS REACHING 2 BILLION PEOPLE
      </p>

      <div className="marquee__viewport">
        <div className="marquee__track">
          {/* Two back-to-back copies; translateX(-50%) advances exactly one. */}
          <LogoGroup />
          <LogoGroup hidden />
        </div>
      </div>
    </section>
  );
}

export default LogoMarquee;
