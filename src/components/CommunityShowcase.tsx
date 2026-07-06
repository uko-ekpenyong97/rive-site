import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import SectionHeader from "./SectionHeader";
import "./CommunityShowcase.css";

const COMMUNITY_URL = "https://rive.app/community";

// Three distinct caption sets — one per row — so no two rows repeat a piece.
// Format stays "CREATOR — PIECE" to match the original placeholders. Eight per
// row; each row's track duplicates its set ×2 for the seamless -50% wrap.
const ROWS: string[][] = [
  [
    "AARON — ORBITAL LOADER",
    "MAYA — SPRING TOGGLE",
    "DEVON — PIXEL MASCOT",
    "LENA — WEATHER WIDGET",
    "KOJI — COMBAT HUD",
    "PRIYA — ONBOARDING FLOW",
    "SAM — AUDIO VISUALIZER",
    "NORA — CHECKOUT CHIME",
  ],
  [
    "IVY — PARALLAX HERO",
    "OMAR — LOADING SPINNER",
    "RHEA — EMOJI REACTIONS",
    "FELIX — MAP MARKERS",
    "TARA — CONFETTI BURST",
    "HUGO — SCROLL PROGRESS",
    "ZOE — MENU MORPH",
    "LUCA — BADGE UNLOCK",
  ],
  [
    "ELIAS — LIQUID SWIPE",
    "NINA — CURSOR TRAIL",
    "RAVI — PULSE BUTTON",
    "CORA — SKELETON STATE",
    "MILO — TOAST SLIDE",
    "ANYA — GAUGE DIAL",
    "THEO — PAGE TURN",
    "WREN — RIPPLE TAP",
  ],
];

// Different negative delay per row so tile seams never align vertically across
// rows (fractions of --wall-duration: 0, ~1/3, ~2/3).
const ROW_DELAYS = ["0s", "-33s", "-66s"];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function Tile({ caption, hidden }: { caption: string; hidden?: boolean }) {
  return (
    <a
      className="community-showcase__tile"
      href={COMMUNITY_URL}
      target="_blank"
      rel="noopener"
      // The duplicated copy is decorative — hide it from AT and the tab order.
      aria-hidden={hidden || undefined}
      aria-label={hidden ? undefined : caption}
      tabIndex={hidden ? -1 : undefined}
    >
      <span className="community-showcase__caption">{caption}</span>
    </a>
  );
}

function Row({ tiles, delay }: { tiles: string[]; delay: string }) {
  return (
    <div className="community-showcase__row">
      <div
        className="community-showcase__track"
        style={{ "--wall-delay": delay } as CSSProperties}
      >
        {/* Two back-to-back copies; translateX(-50%) advances exactly one. */}
        {tiles.map((caption) => (
          <Tile key={caption} caption={caption} />
        ))}
        {tiles.map((caption) => (
          <Tile key={`dup-${caption}`} caption={caption} hidden />
        ))}
      </div>
    </div>
  );
}

/**
 * The community work wall — the page's one deliberate full-bleed section. Three
 * counter-scrolling rows of tiles (middle row reversed) that hard-cut at the
 * viewport edges (no edge fade — that's what sets it apart from LogoMarquee).
 *
 * Reduced motion is a render branch (not just a CSS media query): the moving
 * wall and the static grid are genuinely different DOM (24 duplicated nodes vs
 * a contained 8-tile grid), so branching in JS keeps each markup honest rather
 * than shipping 40 hidden nodes to reduced-motion users.
 */
export function CommunityShowcase() {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <section className="community-showcase">
      <SectionHeader eyebrow="FROM THE COMMUNITY" title="Made with Rive" />

      {reduced ? (
        // Static fallback: a contained 4-column grid of row 1's eight tiles,
        // matching the section's previous in-column presentation.
        <div className="community-showcase__grid">
          {ROWS[0].map((caption) => (
            <Tile key={caption} caption={caption} />
          ))}
        </div>
      ) : (
        <div
          className="community-showcase__wall"
          aria-label="Animations made with Rive by the community"
        >
          {ROWS.map((tiles, i) => (
            <Row key={i} tiles={tiles} delay={ROW_DELAYS[i]} />
          ))}
        </div>
      )}

      <a className="text-link" href={COMMUNITY_URL} target="_blank" rel="noopener">
        Explore the community →
      </a>
    </section>
  );
}

export default CommunityShowcase;
