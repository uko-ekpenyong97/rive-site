import { useState } from "react";
import Button, { type ButtonVariant } from "../components/Button";
import BentoCell, { type BentoCellSize } from "../components/BentoCell";

type Theme = "dark" | "light";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost"];
const BUTTON_COLUMNS = ["Default", "Hover", "Disabled"] as const;
const BENTO_SIZES: BentoCellSize[] = ["small", "wide", "large"];

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--font-size-caption)",
  color: "var(--text-secondary)",
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: "var(--font-size-h2)",
  fontWeight: 700,
  color: "var(--text-heading)",
};

function Showcase() {
  const [theme, setTheme] = useState<Theme>("dark");

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    setTheme(next);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "var(--surface-canvas)",
        padding: "var(--space-8)",
        boxSizing: "border-box",
        transition: "background var(--duration-base) var(--ease-standard)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-16)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-6)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--font-size-eyebrow)",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-accent)",
            }}
          >
            Design System
          </span>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "var(--font-size-h1)",
              fontWeight: 700,
              color: "var(--text-heading)",
              lineHeight: 1.1,
            }}
          >
            Components
          </h1>
        </div>

        <Button variant="secondary" onClick={toggleTheme}>
          {theme === "dark" ? "Switch to light" : "Switch to dark"}
        </Button>
      </header>

      <ButtonSection />
      <BentoSection />
    </div>
  );
}

/* ---------------------------------------------------------------- Button -- */

function ButtonSection() {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
    >
      <h2 style={sectionHeadingStyle}>Button</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto repeat(3, max-content)",
          gap: "var(--space-6)",
          alignItems: "center",
          justifyContent: "start",
        }}
      >
        <div />
        {BUTTON_COLUMNS.map((col) => (
          <div key={col} style={labelStyle}>
            {col}
          </div>
        ))}

        {VARIANTS.map((variant) => (
          <ButtonRow key={variant} variant={variant} />
        ))}
      </div>
    </section>
  );
}

function ButtonRow({ variant }: { variant: ButtonVariant }) {
  return (
    <>
      <div style={{ ...labelStyle, textTransform: "capitalize" }}>{variant}</div>
      <div>
        <Button variant={variant}>Button</Button>
      </div>
      <div>
        <Button variant={variant} state="hover">
          Button
        </Button>
      </div>
      <div>
        <Button variant={variant} disabled>
          Button
        </Button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- BentoCell -- */

const MATRIX_CELL_HEIGHT = 280;

function BentoSection() {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
    >
      <h2 style={sectionHeadingStyle}>BentoCell</h2>

      {/* Variant matrix: rows Small/Wide/Large, columns Default/Hover */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 420px 420px",
          gap: "var(--space-6)",
          alignItems: "center",
          justifyContent: "start",
        }}
      >
        <div />
        <div style={labelStyle}>Default</div>
        <div style={labelStyle}>Hover</div>

        {BENTO_SIZES.map((size) => (
          <BentoRow key={size} size={size} />
        ))}

        {/* Large + Featured */}
        <div style={{ ...labelStyle, textTransform: "capitalize" }}>
          large · featured
        </div>
        <div style={{ height: MATRIX_CELL_HEIGHT }}>
          <BentoCell
            size="large"
            featured
            eyebrow="Featured"
            title="Featured cell"
            description="Accent border that holds through hover."
            href="#"
            style={{ height: "100%" }}
          />
        </div>
        <div style={{ height: MATRIX_CELL_HEIGHT }}>
          <BentoCell
            size="large"
            featured
            state="hover"
            eyebrow="Featured"
            title="Featured cell"
            description="Accent border that holds through hover."
            href="#"
            style={{ height: "100%" }}
          />
        </div>
      </div>

      {/* Use-case grid — mirrors the Figma arrangement */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <h3 style={{ ...labelStyle, textTransform: "uppercase" }}>Use-case grid</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "420px 360px 280px",
            gap: "var(--space-6)",
          }}
        >
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
      </div>
    </section>
  );
}

function BentoRow({ size }: { size: BentoCellSize }) {
  const shared = {
    size,
    eyebrow: size,
    title: `${size[0].toUpperCase()}${size.slice(1)} cell`,
    description: "A token-driven bento cell.",
    href: "#",
  } as const;

  return (
    <>
      <div style={{ ...labelStyle, textTransform: "capitalize" }}>{size}</div>
      <div style={{ height: MATRIX_CELL_HEIGHT }}>
        <BentoCell {...shared} style={{ height: "100%" }} />
      </div>
      <div style={{ height: MATRIX_CELL_HEIGHT }}>
        <BentoCell {...shared} state="hover" style={{ height: "100%" }} />
      </div>
    </>
  );
}

export default Showcase;
