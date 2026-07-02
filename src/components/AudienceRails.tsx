import SectionHeader from "./SectionHeader";
import "./AudienceRails.css";

interface Rail {
  marker: string;
  headline: string;
  body: string;
  cta: string;
  href: string;
}

const RAILS: Rail[] = [
  {
    marker: "01 — DESIGNERS",
    headline: "Design with real logic",
    body: "The pen tool, layouts, and components you know — plus state machines you build visually. Ship interactive work without writing code.",
    cta: "Explore the editor →",
    href: "https://editor.rive.app",
  },
  {
    marker: "02 — ANIMATORS",
    headline: "Animate for runtime",
    body: "Timelines, keyframes, and easing like the tools you came from — except your work stays interactive and the files stay tiny.",
    cta: "See animation tools →",
    href: "#",
  },
  {
    marker: "03 — DEVELOPERS",
    headline: "Ship it natively",
    body: "Open-source runtimes for every platform. Data binding is the contract — bind view models in code while design keeps iterating. Script custom behavior when you need it.",
    cta: "Read the docs →",
    href: "https://rive.app/docs",
  },
];

export function AudienceRails() {
  return (
    <section className="audience-rails">
      <SectionHeader
        eyebrow="MADE FOR YOUR WHOLE TEAM"
        title="One tool, three crafts"
      />

      <div className="audience-rails__grid">
        {RAILS.map((rail) => (
          <div key={rail.marker} className="audience-rails__rail">
            <span className="audience-rails__marker">{rail.marker}</span>
            <h3 className="audience-rails__headline">{rail.headline}</h3>
            <p className="audience-rails__body">{rail.body}</p>
            <a className="text-link" href={rail.href}>
              {rail.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

export default AudienceRails;
