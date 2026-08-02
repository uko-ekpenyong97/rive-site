import { useState } from "react";
import SectionHeader from "./SectionHeader";
import { AudienceGlyph, type GlyphArtboard } from "./AudienceGlyph";
import { usePrefersReducedMotion } from "./UseCaseModal/usePrefersReducedMotion";
import glyphDesignerUrl from "../assets/rive/glyph_designer.riv?url";
import glyphAnimatorUrl from "../assets/rive/glyph_animator.riv?url";
import glyphDeveloperUrl from "../assets/rive/glyph_developer.riv?url";
import "./AudienceRails.css";

interface Rail {
  marker: string;
  headline: string;
  body: string;
  cta: string;
  href: string;
  /* One file per glyph. See the confirmed maps below for why this is three
     files and not one artboard-switched file. */
  src: string;
  artboard: GlyphArtboard;
  /** Recorded for the preload policy, as every .riv in this repo is. */
  bytes: number;
}

/* ──────────────────────────────────────────────────────────────────────
 * CONFIRMED MAP — glyph_designer.riv / GlyphDesigner / Glyph_SM
 *
 * Read with the runtime probe (`node scripts/probe-riv.mjs`) against the
 * COMMITTED BYTES, not the editor. Nothing here is inferred from names.
 *
 * Artboard       GlyphDesigner    240 × 200   (sole artboard in the file)
 * StateMachine   Glyph_SM
 * ViewModel      GlyphVM — accentColor:color, hover:boolean, strokeColor:color
 *                one instance, "Instance"
 * Timelines      Idle_Loop        9s (540 frames @ 60fps) — spec §6
 *                Rest             1 frame — the reduced-motion pose
 *                Handles_Idle     1 frame ┐ the second SM layer's poses,
 *                Handles_Hover    1 frame ┘ spec §3.1's +2 handle enlargement
 * bytes          5,930
 *
 * HOUSE RULE — CARRIED OVER: the zero-Any-State audit was measured over the
 * MCP during the authoring session, when all three glyphs shared one editor
 * file. The probe re-verifies structure (artboard, state machine, view model,
 * timeline durations) but cannot read transition topology, so the audit itself
 * is inherited rather than re-measured. The durations matching spec §6 exactly
 * is the evidence that this is the same authored artboard, not a redraw.
 * ────────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────
 * CONFIRMED MAP — glyph_animator.riv / GlyphAnimator / Glyph_SM
 *
 * Read with the runtime probe against the committed bytes (not the editor).
 *
 * Artboard       GlyphAnimator    240 × 200   (sole artboard in the file)
 * StateMachine   Glyph_SM
 * ViewModel      GlyphVM — accentColor:color, hover:boolean, strokeColor:color
 *                one instance, "Instance"
 * Timelines      Idle_Loop        11s (660 frames @ 60fps) — spec §6
 *                Rest             1 frame — the reduced-motion pose
 * bytes          2,676
 *
 * HOUSE RULE — CARRIED OVER: as above; structure re-verified by probe,
 * transition topology inherited from the authoring session's MCP audit.
 * ────────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────
 * CONFIRMED MAP — glyph_developer.riv / GlyphDeveloper / Glyph_SM
 *
 * Read with the runtime probe against the committed bytes (not the editor).
 *
 * Artboard       GlyphDeveloper   240 × 200   (sole artboard in the file)
 * StateMachine   Glyph_SM
 * ViewModel      GlyphVM — accentColor:color, hover:boolean, strokeColor:color
 *                one instance, "Instance"
 * Timelines      Idle_Loop        13s (780 frames @ 60fps) — spec §6
 *                Rest             1 frame — the reduced-motion pose
 * bytes          4,299
 *
 * PROVENANCE NOTE: this file is byte-identical (sha256 650dc8b0…) to the
 * `audience_glyphs.riv` that shipped briefly and rendered only one glyph. That
 * file was never a three-artboard export — it was always this one. See spec §11.
 *
 * HOUSE RULE — CARRIED OVER: as above.
 * ────────────────────────────────────────────────────────────────────── */

/* Copy discipline (spec §1): heading plus at most two lines per rail. The glyph
   carries the feel; the text carries the offer.
 *
 * DESTINATIONS — each rail points at the docs page for its craft (verified 200
 * on 2026-08-01). All three leave the site, so all three open in a new tab; see
 * the rel/target note below.
 *
 * THE DESIGNER LABEL CHANGED WITH ITS DESTINATION. It read "Explore the editor →"
 * and pointed at editor.rive.app — the app itself. Pointing that label at a docs
 * page would have promised the editor and delivered documentation, so the label
 * moved with the link rather than being left behind. Rails 2 and 3 already named
 * documentation, so this brings the designer rail into line with them instead of
 * making it the odd one out. Logged in spec §11.
 */
const RAILS: Rail[] = [
  {
    marker: "01 — DESIGNERS",
    headline: "Design with real logic",
    body: "The pen tool and components you know — plus state machines you build visually, not in code.",
    cta: "Start with artboards →",
    href: "https://rive.app/docs/editor/fundamentals/artboards",
    src: glyphDesignerUrl,
    artboard: "GlyphDesigner",
    bytes: 5_930,
  },
  {
    marker: "02 — ANIMATORS",
    headline: "Animate for runtime",
    body: "Timelines, keyframes, and easing you already know — except the output ships interactive.",
    cta: "See animation tools →",
    /* Was "#" — a dead link shipped behind a live-looking label. */
    href: "https://rive.app/docs/editor/animate-mode/animate-mode-overview",
    src: glyphAnimatorUrl,
    artboard: "GlyphAnimator",
    bytes: 2_676,
  },
  {
    marker: "03 — DEVELOPERS",
    headline: "Ship it natively",
    body: "Open-source runtimes everywhere. Data binding is the contract — bind in code, design keeps moving.",
    cta: "Read the docs →",
    href: "https://rive.app/docs/runtimes/getting-started",
    src: glyphDeveloperUrl,
    artboard: "GlyphDeveloper",
    bytes: 4_299,
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
              src={rail.src}
              artboard={rail.artboard}
              hovered={hovered === rail.marker}
              reducedMotion={reducedMotion}
            />
            <span className="audience-rails__marker">{rail.marker}</span>
            <h3 className="audience-rails__headline">{rail.headline}</h3>
            <p className="audience-rails__body">{rail.body}</p>
            {/* Leaves the site, so it opens in a new tab like every other
                outbound link here. `noreferrer` alongside `noopener` is the
                house rel now — one convention, the stricter one. */}
            <a
              className="text-link"
              href={rail.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {rail.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

export default AudienceRails;
