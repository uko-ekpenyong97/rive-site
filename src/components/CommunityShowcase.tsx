import SectionHeader from "./SectionHeader";
import "./CommunityShowcase.css";

const TILES = [
  "AARON — ORBITAL LOADER",
  "MAYA — SPRING TOGGLE",
  "DEVON — PIXEL MASCOT",
  "LENA — WEATHER WIDGET",
  "KOJI — COMBAT HUD",
  "PRIYA — ONBOARDING FLOW",
  "SAM — AUDIO VISUALIZER",
  "NORA — CHECKOUT CHIME",
];

export function CommunityShowcase() {
  return (
    <section className="community-showcase">
      <SectionHeader eyebrow="FROM THE COMMUNITY" title="Made with Rive" />

      <div className="community-showcase__grid">
        {TILES.map((caption) => (
          <figure key={caption} className="community-showcase__tile">
            <div className="community-showcase__thumb" />
            <figcaption className="community-showcase__caption">
              {caption}
            </figcaption>
          </figure>
        ))}
      </div>

      <a className="text-link" href="#">
        Explore the community →
      </a>
    </section>
  );
}

export default CommunityShowcase;
