import BentoCell from "./BentoCell";
import SectionHeader from "./SectionHeader";
import "./UseCaseBento.css";

export function UseCaseBento() {
  return (
    <section className="use-case-bento">
      <SectionHeader eyebrow="WHERE RIVE RUNS" title="Built for every surface" />

      <div className="use-case-bento__grid">
        <BentoCell
          size="large"
          featured
          eyebrow="PRODUCT UI"
          title="Interfaces that respond in real time"
          description="State-driven components running natively in your product."
          href="#"
          style={{ gridColumn: "1 / 3", gridRow: 1 }}
        />
        <BentoCell
          size="small"
          eyebrow="GAME UI"
          title="Menus and HUDs at engine speed"
          href="#"
          style={{ gridColumn: 3, gridRow: 1 }}
        />
        <BentoCell
          size="small"
          eyebrow="WEBSITES"
          title="Sites that respond to every visitor"
          href="#"
          style={{ gridColumn: 1, gridRow: 2 }}
        />
        <BentoCell
          size="small"
          eyebrow="AUTOMOTIVE"
          title="Dashboards at 120fps"
          href="#"
          style={{ gridColumn: 2, gridRow: 2 }}
        />
        <BentoCell
          size="small"
          eyebrow="FILM, TV & BROADCAST"
          title="Live graphics that never miss"
          href="#"
          style={{ gridColumn: 3, gridRow: 2 }}
        />
        <BentoCell
          size="wide"
          eyebrow="CAMPAIGNS"
          title="Brand moments like Spotify Wrapped"
          description="300M users engaged. 630M shares. Built in Rive."
          href="#"
          style={{ gridColumn: "1 / -1", gridRow: 3 }}
        />
      </div>

      <a href="#" className="text-link">
        Explore all use cases →
      </a>
    </section>
  );
}

export default UseCaseBento;
