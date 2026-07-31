import { Fragment, useEffect, useRef, useState } from "react";
import { DialRoot } from "dialkit";
import "dialkit/styles.css";
import Button, { type ButtonVariant } from "../components/Button";
import BentoCell, { type BentoCellSize } from "../components/BentoCell";
import TileVideo from "../components/TileVideo";
import UseCaseBento from "../components/UseCaseBento";
import {
  USE_CASES,
  UseCaseModal,
  useModalDials,
  exitDurationMs,
  type ModalDials,
  type UseCaseContent,
} from "../components/UseCaseModal";

/** Motion values threaded from the page's single DialKit registration. */
interface DialProps {
  dials: ModalDials;
  reducedMotion: boolean;
}

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

  /* One registration for the whole page — DialKit keys panels by name, so
     calling useModalDials twice would collide on "UseCaseModal". The resolved
     values are threaded to every surface that renders a modal. */
  const [replayFor, setReplayFor] = useState<UseCaseContent | null>(null);
  const replayRef = useRef<{ dials: ModalDials; reduced: boolean } | null>(null);
  const replayTimer = useRef<number | undefined>(undefined);
  const lastOpened = useRef<UseCaseContent | null>(null);

  const { dials, reducedMotion } = useModalDials(() => {
    /* Re-trigger the entrance: close, wait exactly as long as the exit actually
       takes (derived from the live dials, not a magic number), then reopen. */
    const cfg = replayRef.current;
    const wait = cfg ? exitDurationMs(cfg.dials, cfg.reduced) + 32 : 320;
    const target = lastOpened.current ?? USE_CASES[0];
    window.clearTimeout(replayTimer.current);
    setReplayFor(null);
    replayTimer.current = window.setTimeout(() => setReplayFor(target), wait);
  });

  replayRef.current = { dials, reduced: reducedMotion };

  useEffect(() => () => window.clearTimeout(replayTimer.current), []);

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
      <TileVideoSection />
      <BentoSection dials={dials} reducedMotion={reducedMotion} />
      <UseCaseModalSection
        dials={dials}
        reducedMotion={reducedMotion}
        replayFor={replayFor}
        onReplayHandled={setReplayFor}
        onOpened={(useCase) => {
          lastOpened.current = useCase;
        }}
      />

      {/* DialKit's panel — mounted on the showcase (the design-system surface)
          rather than the app root, so no site page pulls in the tuning
          dependency. It auto-hides in production builds. */}
      <DialRoot position="top-right" theme="dark" defaultOpen={false} />
    </div>
  );
}

/* -------------------------------------------------------- UseCaseModal -- */

interface UseCaseModalSectionProps extends DialProps {
  /** Set by the panel's replay action; cleared once applied. */
  replayFor: UseCaseContent | null;
  onReplayHandled: (useCase: UseCaseContent | null) => void;
  onOpened: (useCase: UseCaseContent) => void;
}

function UseCaseModalSection({
  dials,
  reducedMotion,
  replayFor,
  onReplayHandled,
  onOpened,
}: UseCaseModalSectionProps) {
  const [active, setActive] = useState<UseCaseContent | null>(null);

  /* The replay action drives the same state the buttons do. */
  useEffect(() => {
    if (replayFor) {
      setActive(replayFor);
      onReplayHandled(null);
    }
  }, [replayFor, onReplayHandled]);

  const open = (useCase: UseCaseContent) => {
    onOpened(useCase);
    setActive(useCase);
  };

  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
    >
      <h2 style={sectionHeadingStyle}>UseCaseModal</h2>
      <span style={{ ...labelStyle, maxWidth: "64ch" }}>
        Portal, blurred scrim, scroll-lock, overlay-as-scroller, focus trap,
        Escape / close / scrim-click dismiss, two-speed entrance/exit. Every §6
        value is a live DialKit dial (panel, top-right) — including the entrance
        bezier editor. Toggle <code>reducedMotion</code> there to preview the
        crossfade fallback, and hit “Replay entrance” while tuning.
      </span>

      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
        {USE_CASES.map((useCase) => (
          <Button
            key={useCase.slug}
            variant={useCase.tier === "full" ? "primary" : "secondary"}
            onClick={() => open(useCase)}
          >
            {useCase.name}
          </Button>
        ))}
      </div>

      <UseCaseModal
        useCase={active}
        onClose={() => setActive(null)}
        dials={dials}
        reducedMotion={reducedMotion}
      />
    </section>
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

/* ------------------------------------------------------------- TileVideo -- */

/**
 * Both states side by side, because the reduced-motion one is otherwise only
 * reachable by changing an OS setting. The right-hand column is forced via the
 * prop — the same escape hatch BentoCell's `state` gives the hover appearance.
 */
function TileVideoSection() {
  const withMedia = USE_CASES.filter((c) => c.tileMedia);

  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
    >
      <h2 style={sectionHeadingStyle}>TileVideo</h2>

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
        <div style={labelStyle}>Autoplay loop</div>
        <div style={labelStyle}>Reduced motion</div>

        {withMedia.map((useCase) => (
          <Fragment key={useCase.slug}>
            <div style={labelStyle}>{useCase.slug}</div>
            {[false, true].map((reduce) => (
              <div
                key={String(reduce)}
                style={{
                  height: 236,
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                }}
              >
                {useCase.tileMedia && (
                  <TileVideo media={useCase.tileMedia} reducedMotion={reduce} />
                )}
              </div>
            ))}
          </Fragment>
        ))}

        {/* The absent-media state is a real one: campaigns ships no tileMedia,
            so its cell keeps the labelled placeholder. */}
        <div style={labelStyle}>no tileMedia</div>
        <div style={{ height: 236 }}>
          <BentoCell
            size="small"
            eyebrow="CAMPAIGNS"
            title="Falls back to the placeholder"
            href="#"
            style={{ height: "100%" }}
          />
        </div>
        <div />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- BentoCell -- */

const MATRIX_CELL_HEIGHT = 280;

function BentoSection({ dials, reducedMotion }: DialProps) {
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

      {/* Use-case grid — the shared Home section component (one source of
          truth), wired to the same dials so its cell modals tune live too. */}
      <UseCaseBento dials={dials} reducedMotion={reducedMotion} />
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
