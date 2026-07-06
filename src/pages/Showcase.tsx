import { useState } from "react";
import Button, { type ButtonVariant } from "../components/Button";
import BentoCell, { type BentoCellSize } from "../components/BentoCell";
import UseCaseBento from "../components/UseCaseBento";

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
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        width: "100%",
        background: "transparent",
        padding: "var(--space-8)",
        boxSizing: "border-box",
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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "var(--space-2)",
          }}
        >
          <Button variant="secondary" onClick={toggleTheme}>
            {theme === "dark" ? "Switch to light" : "Switch to dark"}
          </Button>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--text-muted)",
              textAlign: "right",
              maxWidth: "320px",
            }}
          >
            Light mode is a token-system capability demo — the shipped site is
            dark-only, per Rive's brand.
          </span>
        </div>
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

      {/* Use-case grid — now the shared Home section component (one source of truth) */}
      <UseCaseBento />
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
