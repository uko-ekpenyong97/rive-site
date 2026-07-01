import { useState } from "react";
import Button, { type ButtonVariant } from "./components/Button";

type Theme = "dark" | "light";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost"];
const COLUMNS = ["Default", "Hover", "Disabled"] as const;

function App() {
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

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--font-size-caption)",
    color: "var(--text-secondary)",
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
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-6)",
          marginBottom: "var(--space-12)",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
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
            Button
          </h1>
        </div>

        <Button variant="secondary" onClick={toggleTheme}>
          {theme === "dark" ? "Switch to light" : "Switch to dark"}
        </Button>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto repeat(3, max-content)",
          gap: "var(--space-6)",
          alignItems: "center",
          justifyContent: "start",
        }}
      >
        {/* Header row: empty corner + column labels */}
        <div />
        {COLUMNS.map((col) => (
          <div key={col} style={labelStyle}>
            {col}
          </div>
        ))}

        {/* One row per variant */}
        {VARIANTS.map((variant) => (
          <Row key={variant} variant={variant} labelStyle={labelStyle} />
        ))}
      </div>
    </div>
  );
}

function Row({
  variant,
  labelStyle,
}: {
  variant: ButtonVariant;
  labelStyle: React.CSSProperties;
}) {
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

export default App;
