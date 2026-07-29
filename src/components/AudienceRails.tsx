import { useState } from "react";
import SectionHeader from "./SectionHeader";
import { AudienceGlyph, type GlyphArtboard } from "./AudienceGlyph";
import { usePrefersReducedMotion } from "./UseCaseModal/usePrefersReducedMotion";
import "./AudienceRails.css";

interface Rail {
  marker: string;
  headline: string;
  body: string;
  cta: string;
  href: string;
  /* Which artboard in audience_glyphs.riv draws this craft. The pairing is the
     whole point — the designer's rail gets the pen tool, the animator's gets the
     timeline, the developer's gets the state machine — so it is asserted in the
     smoke suite rather than left to reading order. */
  glyph: GlyphArtboard;
}

/* Copy discipline (spec §1): heading plus at most two lines per rail. The glyph
   carries the feel; the text carries the offer. */
const RAILS: Rail[] = [
  {
    marker: "01 — DESIGNERS",
    headline: "Design with real logic",
    body: "The pen tool and components you know — plus state machines you build visually, not in code.",
    cta: "Explore the editor →",
    href: "https://editor.rive.app",
    glyph: "GlyphDesigner",
  },
  {
    marker: "02 — ANIMATORS",
    headline: "Animate for runtime",
    body: "Timelines, keyframes, and easing you already know — except the output ships interactive.",
    cta: "See animation tools →",
    href: "#",
    glyph: "GlyphAnimator",
  },
  {
    marker: "03 — DEVELOPERS",
    headline: "Ship it natively",
    body: "Open-source runtimes everywhere. Data binding is the contract — bind in code, design keeps moving.",
    cta: "Read the docs →",
    href: "https://rive.app/docs",
    glyph: "GlyphDeveloper",
  },
];

export function AudienceRails() {
  const reducedMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section className="audience-rails">
      <SectionHeader
        eyebrow="MADE FOR YOUR WHOLE TEAM"
        title="One tool, three crafts"
      />

      <div className="audience-rails__grid">
        {RAILS.map((rail) => (
          <div
            key={rail.marker}
            className="audience-rails__rail"
            /* The RAIL is the hover surface, not the canvas (spec §7). It is the
               whole column the reader is actually pointing at and it is far
               larger than the 220px glyph, so hovering the heading animates the
               drawing too. An in-file Rive listener could only ever see the
               canvas hitbox. */
            onPointerEnter={() => setHovered(rail.marker)}
            onPointerLeave={() =>
              setHovered((current) =>
                current === rail.marker ? null : current,
              )
            }
          >
            <AudienceGlyph
              artboard={rail.glyph}
              hovered={hovered === rail.marker}
              reducedMotion={reducedMotion}
            />
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
