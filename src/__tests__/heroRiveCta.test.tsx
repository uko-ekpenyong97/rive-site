// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Hero + Rive CTA system — guards for docs/specs/hero-rive-cta-spec.md.
 *
 * The runtime is mocked, at the same layer AudienceRails mocks it and for the
 * same reason: these assertions are about OUR contract with it — which artboard
 * and machine each button asks for, which inputs it drives, and above all what
 * the DOM does when the runtime is slow, absent, or unwanted. Whether WebGL2
 * then paints a cat is Rive's job and jsdom could not answer it.
 *
 * The load-bearing guard here is the LABEL HANDOFF. `rive.wasm` is 2.41 MB and
 * the hero CTA is the most LCP-sensitive element on the page, so the button is
 * DOM-first and the canvas only enhances it. Both directions are pinned below:
 * canvas live → the DOM label yields to visually-hidden (never removed, so the
 * accessible name survives); canvas failed or reduced motion → the DOM label
 * stays visible and the button still works.
 */

/* ── the fake runtime ─────────────────────────────────────────────────────── */

const fake = vi.hoisted(() => {
  const state = {
    /** Simulates onLoadError — the ".riv fails" branch. */
    failLoad: false,
    /** Simulates the runtime never resolving — the "wasm still in flight" branch. */
    neverResolve: false,
    /** Every input the fake machine exposes, by state-machine name. */
    inputs: new Map<string, { name: string; value: boolean }[]>(),
    /** Every `useRive` call this render made, for asserting what was requested. */
    calls: [] as (Record<string, unknown> | null)[],
  };
  const reset = () => {
    state.failLoad = false;
    state.neverResolve = false;
    state.inputs.clear();
    state.calls.length = 0;
  };
  return { state, reset };
});

vi.mock("@rive-app/react-webgl2", async () => {
  const React = await import("react");
  return {
    useRive: (opts: Record<string, unknown> | null) => {
      fake.state.calls.push(opts);
      /* Reduced motion passes null — the hook must tolerate it and, crucially,
         nothing may be requested in that state. */
      if (!opts) return { rive: null, RiveComponent: () => null };

      const failing = fake.state.failLoad;
      React.useEffect(() => {
        if (failing) (opts.onLoadError as (() => void) | undefined)?.();
      }, [failing]);

      if (failing || fake.state.neverResolve) {
        return {
          rive: null,
          RiveComponent: (p: Record<string, unknown>) =>
            React.createElement("canvas", p),
        };
      }

      const smName = String(opts.stateMachines ?? "");
      if (!fake.state.inputs.has(smName)) fake.state.inputs.set(smName, []);
      const rive = {
        stateMachineInputs: (name: string) => fake.state.inputs.get(name) ?? [],
      };
      return {
        rive,
        RiveComponent: (p: Record<string, unknown>) =>
          React.createElement("canvas", p),
      };
    },
  };
});

/* Imported after the mock so the components pick it up. */
const { Hero } = await import("../components/Hero");
const { Nav } = await import("../components/Nav");
const { RiveButton, SEARCH_DIALS } = await import("../components/RiveButton");
const {
  GET_STARTED_CAT,
  GET_STARTED_ROCKET,
  R_LOGO_SHUFFLE,
  RIVE_SITE_ASSETS,
} = await import("../components/riveSiteAssets");
const { RIVE_WORDMARK_PATH, RIVE_WORDMARK_VIEWBOX } = await import(
  "../components/riveWordmark"
);

/* jsdom gives `import.meta.url` an http scheme, so fileURLToPath cannot be used
   here the way the node-environment suites use it. Vitest runs from the project
   root, so cwd is the stable anchor. */
const ROOT = process.cwd();
const PUBLIC = resolve(ROOT, "public");

/* jsdom implements no matchMedia, and usePrefersReducedMotion reads it on
   mount. Default to "no preference" so the ordinary path is what runs unless a
   test passes the prop explicitly. */
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

let container: HTMLDivElement;
let root: Root;

function mount(node: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return container;
}

beforeEach(() => {
  fake.reset();
  document.body.innerHTML = "";
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("hero structure", () => {
  /* SSR is the honest first-paint check: effects have not run, so this is
     literally what a visitor sees before any Rive code executes. */
  const ssr = renderToString(<Hero />);

  it("renders the centred stack in reading order", () => {
    const order = [
      "hero__wordmark",
      "hero__title",
      "hero__subhead",
      "hero__range",
      "hero__ctas",
    ].map((cls) => ssr.indexOf(cls));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("both CTAs are present and are real links at first paint", () => {
    expect(ssr).toContain("Get started");
    expect(ssr).toContain("Downloads");
    expect(ssr).toContain('href="https://editor.rive.app"');
  });

  it("the retired DemoSlot is gone", () => {
    expect(ssr.includes("demo-slot")).toBe(false);
    expect(ssr.includes("hero__demo")).toBe(false);
  });

  it("the hero ships no status line, and reserves nothing for one", () => {
    /* Retired from the hero but kept as a slot. Absent must render NOTHING —
       not an empty <p> — so the stack simply ends at the CTAs. */
    expect(ssr.includes("hero__status")).toBe(false);
    expect(ssr.includes("SCRIPTING IS LIVE")).toBe(false);
  });

  it("the status slot still works when a caller passes one", () => {
    const withStatus = renderToString(<Hero status="RENDER IS LIVE" />);
    expect(withStatus).toContain("hero__status");
    expect(withStatus).toContain("RENDER IS LIVE");
  });

  it("the status slot keeps its entrance index for when it returns", () => {
    expect(readHeroCss()).toContain(".hero__status");
  });

  it("reserves no vertical space for the overflow", () => {
    /* REGRESSION. An earlier version reserved 210px above and below the CTA row
       "for the rocket's overflow" and made the hero 1044px against a 620px
       pre-Rive baseline. Absolutely positioned canvases cannot shift layout, so
       any reservation is pure dead space. */
    const css = readHeroCss();
    expect(css.includes("--rocket-clearance")).toBe(false);
    expect(/margin-block:\s*var\(--rocket/.test(css)).toBe(false);
  });

  it("entrance indices cover the six-element stack with no gap", () => {
    /* Still six: the status line keeps index 6 even though the hero no longer
       renders it, so restoring it needs no cascade surgery. A duplicate or
       missing index makes an element pop out of the stagger. */
    const css = readHeroCss();
    const indices = [...css.matchAll(/--enter-index:\s*(\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(indices.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("CTA row: layering, dim, and gap", () => {
  const css = readHeroCss();

  it("the rocket paints OVER Downloads, matching the live site", () => {
    /* rive.app puts the rocket subtree at z-index 1 and DOWNLOADS at 0, so the
       smoke drifts over it. Ours inherited the opposite from DOM order, because
       both buttons were `z-index: auto`. The browser pass pins the other half:
       elementFromPoint at Downloads' centre must still return Downloads. */
    const primary = css.match(/\[data-variant="primary"\]\s*\{[^}]*\}/)?.[0] ?? "";
    const secondary = css.match(/\[data-variant="secondary"\]\s*\{[^}]*\}/)?.[0] ?? "";
    expect(/z-index:\s*1/.test(primary)).toBe(true);
    expect(/z-index:\s*0/.test(secondary)).toBe(true);
  });

  it("the canvas stays inert, so raising the primary changes paint only", () => {
    /* The whole reason the z-order lift is safe. If this ever became `auto`, the
       rocket's 500×500 canvas would start swallowing clicks meant for
       DOWNLOADS. */
    const buttonCss = readFileSync(
      resolve(ROOT, "src/components/RiveButton.css"),
      "utf8",
    );
    expect(buttonCss).toContain("pointer-events: none");
    expect(buttonCss.includes("pointer-events: auto")).toBe(false);
  });

  it("dimming is a tunable property, not a hardcoded opacity", () => {
    expect(css).toContain("--cta-dim-opacity: 0.4");
    expect(css).toMatch(/opacity:\s*var\(--cta-dim-opacity\)/);
    expect(css).toMatch(/transition:\s*opacity 200ms/);
  });

  it("the dim is driven by the PRIMARY's hover, not the secondary's", () => {
    /* Load-bearing: `:hover` on the secondary would require the pointer to be on
       DOWNLOADS, which is the opposite of the intended behaviour. */
    expect(css).toContain('[data-primary-hovered] .rive-button[data-variant="secondary"]');
    expect(
      /\.rive-button\[data-variant="secondary"\]:hover\s*\{[^}]*opacity/.test(css),
    ).toBe(false);
  });

  it("hovering the primary sets the row's dim flag, canvas or no canvas", () => {
    /* DOM-first: the dim must work while the 2.41 MB wasm is in flight, so the
       callback is NOT gated on the canvas being live. */
    fake.state.neverResolve = true;
    const el = mount(<Hero />);
    const row = el.querySelector(".hero__ctas") as HTMLElement;
    const primary = row.querySelector('[data-variant="primary"]') as HTMLElement;
    expect(row.hasAttribute("data-primary-hovered")).toBe(false);

    act(() => {
      primary.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    });
    expect(row.hasAttribute("data-primary-hovered")).toBe(true);

    act(() => {
      primary.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
    });
    expect(row.hasAttribute("data-primary-hovered")).toBe(false);
  });

  it("the row gap is the token, not the old measured 6px", () => {
    const row = css.match(/\.hero__ctas\s*\{[^}]*\}/)?.[0] ?? "";
    expect(row).toMatch(/gap:\s*var\(--space-3\)/);
    expect(/gap:\s*6px/.test(row)).toBe(false);
  });
});

function readHeroCss() {
  return readFileSync(resolve(ROOT, "src/components/Hero.css"), "utf8");
}

/* ───────────────────────────────────────────────────────────────────────── */
describe("nav carries the cat", () => {
  it("renders the cat CTA, not the plain button", () => {
    const ssr = renderToString(<Nav />);
    expect(ssr).toContain("rive-button");
    expect(ssr).toContain("nav__cta");
    expect(ssr).toContain("Get started");
  });

  it("asks the runtime for the cat's artboard and machine", () => {
    mount(<Nav />);
    const call = fake.state.calls.find((c) => c?.src === GET_STARTED_CAT.src);
    expect(call).toBeTruthy();
    expect(call?.artboard).toBe("Cat");
    expect(call?.stateMachines).toBe("Motion");
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("label handoff — .riv resolves", () => {
  it("DOM label yields to visually-hidden once the canvas is live", () => {
    const el = mount(
      <RiveButton asset={GET_STARTED_ROCKET} label="Get started" />,
    );
    const label = el.querySelector(".rive-button__label");
    expect(label?.getAttribute("data-hidden")).toBe("true");
    /* Yielded, NOT removed — the accessible name must still read "Get started",
       because the text the visitor sees is painted inside the artboard where no
       assistive technology can reach it (WCAG 2.5.3 Label in Name). */
    expect(label?.textContent).toBe("Get started");
    expect(el.querySelector("canvas")).toBeTruthy();
  });

  it("a file that paints no label keeps its DOM label visible", () => {
    /* The R logo carries no font and no text — probe-confirmed. */
    const el = mount(<RiveButton asset={R_LOGO_SHUFFLE} label="Downloads" />);
    const label = el.querySelector(".rive-button__label");
    expect(label?.getAttribute("data-hidden")).toBe(null);
    expect(label?.textContent).toBe("Downloads");
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("label handoff — .riv fails or is still loading", () => {
  it("failed load leaves a working DOM button with a visible label", () => {
    fake.state.failLoad = true;
    const el = mount(
      <RiveButton asset={GET_STARTED_ROCKET} label="Get started" href="/x" />,
    );
    const label = el.querySelector(".rive-button__label");
    expect(label?.getAttribute("data-hidden")).toBe(null);
    expect(label?.textContent).toBe("Get started");
    const anchor = el.querySelector("a.rive-button");
    expect(anchor?.getAttribute("href")).toBe("/x");
    expect(el.querySelector(".rive-button__canvas")).toBe(null);
  });

  it("mounts the canvas BEFORE the runtime resolves", () => {
    /* REGRESSION. The first version of this component rendered RiveComponent
       only once `rive` was non-null — but `useRive` attaches the runtime to the
       canvas after it is in the document, so `rive` never resolved, the .riv was
       never requested, and all three buttons sat silently in their DOM fallback
       looking exactly like a deliberate choice. Caught in a browser, not here,
       which is why this test exists. */
    fake.state.neverResolve = true;
    const el = mount(
      <RiveButton asset={GET_STARTED_ROCKET} label="Get started" />,
    );
    const canvas = el.querySelector(".rive-button__canvas");
    expect(canvas).toBeTruthy();
    /* Present but not yet painting — invisible until the file loads. */
    expect(canvas?.getAttribute("data-live")).toBe(null);
  });

  it("runtime still in flight also leaves the DOM label visible", () => {
    /* The 2.41 MB wasm is the reason this state matters: it is what every
       visitor sees for the first few hundred ms. */
    fake.state.neverResolve = true;
    const el = mount(
      <RiveButton asset={GET_STARTED_ROCKET} label="Get started" />,
    );
    expect(
      el.querySelector(".rive-button__label")?.getAttribute("data-hidden"),
    ).toBe(null);
    expect(el.querySelector(".rive-button")?.getAttribute("data-canvas")).toBe(
      "dom",
    );
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("reduced motion", () => {
  it("mounts no canvas and never requests the .riv", () => {
    const el = mount(
      <RiveButton asset={GET_STARTED_ROCKET} label="Get started" reducedMotion />,
    );
    expect(el.querySelector("canvas")).toBe(null);
    expect(el.querySelector(".rive-button__canvas")).toBe(null);
    /* The decisive assertion: `useRive` was called with null, so no src was
       ever handed to the runtime. Same guarantee TileVideo makes by rendering
       an <img> rather than a paused <video>. */
    expect(fake.state.calls).toContain(null);
    expect(fake.state.calls.some((c) => c?.src)).toBe(false);
  });

  it("the button stays fully functional with its label", () => {
    const el = mount(
      <RiveButton
        asset={GET_STARTED_ROCKET}
        label="Get started"
        href="https://editor.rive.app"
        reducedMotion
      />,
    );
    const anchor = el.querySelector("a.rive-button");
    expect(anchor?.getAttribute("href")).toBe("https://editor.rive.app");
    expect(anchor?.textContent).toBe("Get started");
    expect(
      el.querySelector(".rive-button__label")?.getAttribute("data-hidden"),
    ).toBe(null);
  });

  it("the whole hero honours it", () => {
    mount(<Hero reducedMotion />);
    expect(fake.state.calls.every((c) => c === null)).toBe(true);
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("the canvas is display-only; the button is the whole hitbox", () => {
  /* This replaced a three-mode system in which a file carrying its own pointer
     listeners took the events directly on its canvas. rive.app does not work
     that way — its canvases are decoration over an ordinary button — and a
     500×500 transparent canvas that accepts pointers makes the copy beneath it
     unselectable for nothing. There is now no code path that gives a canvas
     pointer events, which is what makes the hitbox provably the button rect. */

  it("only two pointer models exist, and each file is on the right one", () => {
    expect({
      cat: GET_STARTED_CAT.pointer,
      rocket: GET_STARTED_ROCKET.pointer,
      rLogo: R_LOGO_SHUFFLE.pointer,
    }).toEqual({ cat: "manual", rocket: "manual", rLogo: "none" });
  });

  it("no asset can ask for a canvas-driven model", () => {
    /* The union is "manual" | "none". Pinned as data so re-adding a third mode
       has to come through this test rather than arriving by accident. */
    const models = RIVE_SITE_ASSETS.map((a) => a.pointer);
    expect([...new Set(models)].sort()).toEqual(["manual", "none"]);
    expect(models).not.toContain("listeners");
  });

  it("the rocket's listeners are recorded as evidence, not as a code path", () => {
    /* The probe says this file HAS listeners; a browser A/B says they never
       fire (Δ non-transparent pixels: 7 canvas-driven vs 2828 button-driven,
       against an idle noise floor of ±11). That finding is kept in the source
       map because it is true and expensive, but nothing branches on it — the
       file is driven from its button like every other. */
    expect(GET_STARTED_ROCKET.pointer).toBe("manual");
    expect(
      "listenersInert" in (GET_STARTED_ROCKET as unknown as Record<string, unknown>),
    ).toBe(false);
  });

  it("anchors aim the overflow: cat hangs below, rocket rides above", () => {
    /* anchorY is where the BUTTON sits inside the canvas box. Below 0.5 the art
       hangs downward (the cat, out of the nav bar); above it, the art rides up
       (the rocket). */
    expect(GET_STARTED_CAT.anchorY).toBeLessThan(0.5);
    expect(GET_STARTED_ROCKET.anchorY).toBeGreaterThan(0.5);
  });

  it("anchors reproduce the measured rive.app offsets", () => {
    /* canvasTop − btnTop = btnH/2 − anchorY·canvasH, and likewise for x. These
       are the numbers measured off the live site at 1456px on 2026-07-31, so a
       nudged anchor or a resized button rect fails here rather than drifting. */
    const rocketTopOffset = 47 / 2 - GET_STARTED_ROCKET.anchorY! * 500;
    expect(Math.round(rocketTopOffset)).toBe(-328);

    const catLeftOffset = 119 / 2 - GET_STARTED_CAT.anchorX! * 269;
    const catTopOffset = 34 / 2 - GET_STARTED_CAT.anchorY! * 150;
    expect(Math.round(catLeftOffset)).toBe(-76);
    expect(Math.round(catTopOffset)).toBe(-11);
  });
});

/** Every input the cat file declares, as fresh mutable handles. */
function allCatInputs() {
  return [
    ...GET_STARTED_CAT.declaredInputs.map((h) => h.name),
    ...(GET_STARTED_CAT.undrivenInputs ?? []),
    ...(GET_STARTED_CAT.escalation ?? []).map((e) => e.to),
  ].map((name) => ({ name, value: false }));
}

describe("hover inputs match the live site's mechanism", () => {
  it("the cat is two halves, split at the midpoint", () => {
    /* Observed on rive.app's running instance: the button carries two invisible
       hitbox halves (LeftHit 60px, RightHit 59px of a 119px button — 0.504 /
       0.496, a plain midpoint split). Enter left → isHoverLeft, enter right →
       isHoverRight, cross → swap, leave → both clear. */
    expect(
      Object.fromEntries(GET_STARTED_CAT.declaredInputs.map((h) => [h.name, h.zone])),
    ).toEqual({
      isHoverLeft: [0, 0.5],
      isHoverRight: [0.5, 1],
    });
  });

  it("the escalation pairs each half with its nested partner", () => {
    expect(GET_STARTED_CAT.escalation).toEqual([
      { from: "isHoverLeft", to: "isHoverLeft2" },
      { from: "isHoverRight", to: "isHoverRight2" },
    ]);
    /* Every `from` must be a half we actually drive on hover, or the escalation
       could never fire. `check:assets` asserts the same against the bytes. */
    const halves = GET_STARTED_CAT.declaredInputs.map((h) => h.name);
    for (const e of GET_STARTED_CAT.escalation ?? []) {
      expect(halves).toContain(e.from);
    }
  });

  it("only the rocket and R logo have no escalation", () => {
    expect(GET_STARTED_ROCKET.escalation ?? []).toEqual([]);
    expect(R_LOGO_SHUFFLE.escalation ?? []).toEqual([]);
  });

  it("only isHovercenter stays undriven; the 2-family is now escalation", () => {
    /* Left2/Right2 moved OUT of undrivenInputs when the paw search was wired —
       they are driven on the falling edge by design decision, not on hover.
       isHovercenter stays undriven: it measures as no visual change, because
       centre is the neutral forward pose. */
    expect(GET_STARTED_CAT.undrivenInputs).toEqual(["isHovercenter"]);
    const driven = GET_STARTED_CAT.declaredInputs.map((h) => h.name);
    for (const name of GET_STARTED_CAT.undrivenInputs ?? []) {
      expect(driven).not.toContain(name);
    }
  });

  it("isHovercenter keeps the file's lowercase spelling", () => {
    /* The file's own internal name — the Recticle precedent. It is undriven
       now, but the spelling still has to match or `check:assets` cannot verify
       the input is still there. */
    expect(GET_STARTED_CAT.undrivenInputs).toContain("isHovercenter");
    expect(GET_STARTED_CAT.undrivenInputs).not.toContain("isHoverCenter");
  });

  it("the rocket drives isHover and nothing else", () => {
    /* Recon suggested Smoke/NoSmoke inputs; the probe found they are TIMELINES.
       Pinned so nobody re-adds an input the file does not have. */
    expect(GET_STARTED_ROCKET.declaredInputs.map((h) => h.name)).toEqual([
      "isHover",
    ]);
    expect(GET_STARTED_ROCKET.undrivenInputs ?? []).toEqual([]);
  });

  it("the R logo is autonomous — no inputs to drive", () => {
    expect(R_LOGO_SHUFFLE.declaredInputs).toEqual([]);
    expect(R_LOGO_SHUFFLE.paintsOwnLabel).toBe(false);
    expect(R_LOGO_SHUFFLE.pointer).toBe("none");
  });

  it("crossing halves swaps them, and leaving clears both", () => {
    const inputs = [
      ...GET_STARTED_CAT.declaredInputs.map((h) => h.name),
      ...(GET_STARTED_CAT.undrivenInputs ?? []),
    ].map((name) => ({ name, value: false }));
    fake.state.inputs.set("Motion", inputs);
    const el = mount(<RiveButton asset={GET_STARTED_CAT} label="Get started" />);
    const button = el.querySelector(".rive-button") as HTMLElement;
    button.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;

    const move = (clientX: number) =>
      act(() => {
        button.dispatchEvent(
          new MouseEvent("pointermove", { bubbles: true, clientX }),
        );
      });
    const on = () => inputs.filter((i) => i.value).map((i) => i.name);

    move(25);
    expect(on()).toEqual(["isHoverLeft"]);

    move(75);
    expect(on()).toEqual(["isHoverRight"]);

    move(20);
    expect(on()).toEqual(["isHoverLeft"]);

    /* Leaving no longer clears immediately — it starts the paw search, which
       HOLDS the active half so the file can escalate it. The full sequence and
       its eventual clear are pinned in the escalation tests below; this one only
       asserts that crossing between halves is exclusive. */
    act(() => {
      button.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
    });
    expect(on()).toEqual(["isHoverLeft"]);
  });

  it("leaving escalates: half held → 2 raised → both cleared", () => {
    /* THE PAW SEARCH, pinned at the input level. The unit suite can only assert
       the CAUSE — jsdom paints nothing — so `npm run check:exit` pins that the
       resulting art actually reaches down past the nav bar. */
    vi.useFakeTimers();
    try {
      const inputs = allCatInputs();
      fake.state.inputs.set("Motion", inputs);
      const el = mount(<RiveButton asset={GET_STARTED_CAT} label="Get started" />);
      const button = el.querySelector(".rive-button") as HTMLElement;
      button.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;
      const on = () => inputs.filter((i) => i.value).map((i) => i.name).sort();

      act(() => {
        button.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 25 }));
      });
      expect(on()).toEqual(["isHoverLeft"]);

      /* Leaving must NOT clear — that is the whole change. */
      act(() => {
        button.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
      });
      expect(on()).toEqual(["isHoverLeft"]);

      /* After the delay the reach is raised, NESTED on top of the half. */
      act(() => { vi.advanceTimersByTime(SEARCH_DIALS.delayMs); });
      expect(on()).toEqual(["isHoverLeft", "isHoverLeft2"]);

      /* After the hold both clear, so the file's `_end` timeline can play. */
      act(() => { vi.advanceTimersByTime(SEARCH_DIALS.holdMs); });
      expect(on()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-entering during the search cancels it and resumes the halves", () => {
    vi.useFakeTimers();
    try {
      const inputs = allCatInputs();
      fake.state.inputs.set("Motion", inputs);
      const el = mount(<RiveButton asset={GET_STARTED_CAT} label="Get started" />);
      const button = el.querySelector(".rive-button") as HTMLElement;
      button.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;
      const on = () => inputs.filter((i) => i.value).map((i) => i.name).sort();

      act(() => {
        button.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 25 }));
        button.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
      });
      act(() => { vi.advanceTimersByTime(SEARCH_DIALS.delayMs); });
      expect(on()).toEqual(["isHoverLeft", "isHoverLeft2"]);

      /* Cursor comes back — the cat must stop searching for it. */
      act(() => {
        button.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 75 }));
      });
      expect(on()).toEqual(["isHoverRight"]);

      /* And the cancelled timer must not fire later and clear the new state. */
      act(() => { vi.advanceTimersByTime(SEARCH_DIALS.holdMs * 2); });
      expect(on()).toEqual(["isHoverRight"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a file with no escalation still clears immediately on leave", () => {
    vi.useFakeTimers();
    try {
      const inputs = [{ name: "isHover", value: false }];
      fake.state.inputs.set("Motion", inputs);
      const el = mount(<RiveButton asset={GET_STARTED_ROCKET} label="Get started" />);
      const button = el.querySelector(".rive-button") as HTMLElement;
      act(() => {
        button.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
      });
      expect(inputs[0].value).toBe(true);
      act(() => {
        button.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
      });
      expect(inputs[0].value).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the undriven inputs are never written, at any pointer position", () => {
    /* The purity claim in data form: sweep the whole button and assert nothing
       outside `declaredInputs` was ever touched. */
    const inputs = [
      ...GET_STARTED_CAT.declaredInputs.map((h) => h.name),
      ...(GET_STARTED_CAT.undrivenInputs ?? []),
    ].map((name) => ({ name, value: false }));
    fake.state.inputs.set("Motion", inputs);
    const el = mount(<RiveButton asset={GET_STARTED_CAT} label="Get started" />);
    const button = el.querySelector(".rive-button") as HTMLElement;
    button.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;

    const touched = new Set<string>();
    for (let x = 0; x <= 100; x += 5) {
      act(() => {
        button.dispatchEvent(
          new MouseEvent("pointermove", { bubbles: true, clientX: x }),
        );
      });
      for (const i of inputs) if (i.value) touched.add(i.name);
    }
    expect([...touched].sort()).toEqual(["isHoverLeft", "isHoverRight"]);
  });

  it("a single-input file switches on entering the button, not on movement", () => {
    /* The rocket has one input covering the whole button, so position is
       meaningless and pointermove would be per-frame work on the heaviest canvas
       on the page. It uses enter/leave instead. */
    const inputs = [{ name: "isHover", value: false }];
    fake.state.inputs.set("Motion", inputs);
    const el = mount(
      <RiveButton asset={GET_STARTED_ROCKET} label="Get started" />,
    );
    const button = el.querySelector(".rive-button") as HTMLElement;

    act(() => {
      button.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    });
    expect(inputs[0].value).toBe(true);

    act(() => {
      button.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
    });
    expect(inputs[0].value).toBe(false);
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("committed bytes answer every path", () => {
  for (const asset of RIVE_SITE_ASSETS) {
    it(`${asset.src} exists and is non-empty`, () => {
      const onDisk = `${PUBLIC}${asset.src}`;
      expect(existsSync(onDisk)).toBe(true);
      expect(statSync(onDisk).size).toBeGreaterThan(1024);
    });

    it(`${asset.src} matches its recorded byte count`, () => {
      /* Not decoration: a re-export that changed the file would change what the
         probe found, and check:assets reads the same bytes. */
      expect(statSync(`${PUBLIC}${asset.src}`).size).toBe(asset.bytes);
    });
  }
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("weight stays out of the JS bundle", () => {
  /* Same rule as the tile videos: a literal public/ path is copied verbatim, an
     import would put a hashed URL in the chunk. Vite rewrites imported assets to
     /assets/<name>-<hash>, so an absent hash proves these were never imported. */
  for (const asset of RIVE_SITE_ASSETS) {
    it(`${asset.artboard} references a public/ path, not a bundled asset`, () => {
      expect(asset.src.startsWith("/rive/site/")).toBe(true);
      expect(/-[A-Za-z0-9_-]{8}\.riv$/.test(asset.src)).toBe(false);
    });
  }

  it("site-icons.riv is not committed", () => {
    /* Deliberately left out — nothing in this build has a home for it, and an
       11-artboard shared file runs against the one-artboard-per-file rule. */
    expect(existsSync(`${PUBLIC}/rive/site/site-icons.riv`)).toBe(false);
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("accessibility", () => {
  it("no aria-label anywhere in the hero or nav", () => {
    /* An aria-label would REPLACE the name computed from the button's own text
       — the same rule BentoCell follows. */
    expect(renderToString(<Hero />).includes("aria-label")).toBe(false);
    expect(renderToString(<Nav />).includes("aria-label")).toBe(false);
  });

  it("the canvas layer is hidden from the accessibility tree", () => {
    const el = mount(<RiveButton asset={GET_STARTED_ROCKET} label="Get started" />);
    expect(
      el.querySelector(".rive-button__canvas")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("the wordmark is the logotype, sharing FooterMark's letterforms", () => {
    /* Was an amber text eyebrow. It is now the mark itself, drawn from the same
       constant FooterMark uses — so the hero and the footer cannot disagree
       about the letterforms, and no new asset entered the repo. */
    const ssr = renderToString(<Hero />);
    expect(ssr).toContain(RIVE_WORDMARK_VIEWBOX);
    expect(ssr).toContain(RIVE_WORDMARK_PATH.slice(0, 40));
    /* The old treatments, both gone: literal spaced letters would be announced
       one at a time, and the amber text eyebrow is what the mark replaced. */
    expect(ssr.includes("R I V E")).toBe(false);
    expect(ssr.includes(">RIVE<")).toBe(false);
  });

  it("the wordmark takes its colour from the token, not the path", () => {
    /* `fill="currentColor"` is what lets Hero.css paint it --text-primary while
       FooterMark strokes the same geometry differently. A hardcoded fill here
       would break one of the two. */
    const ssr = renderToString(<Hero />);
    expect(ssr).toContain('fill="currentColor"');
  });

  it("the wordmark is decorative, so the hero stays aria-label-free", () => {
    /* The nav already exposes "RIVE" as the home link and the H1 carries the
       proposition; labelling the mark would announce the brand twice. Hiding it
       is also what keeps `aria-label` out of the section entirely — one on a CTA
       would replace the name computed from the button's own text. */
    const ssr = renderToString(<Hero />);
    expect(ssr).toContain('class="hero__wordmark" aria-hidden="true"');
  });
});
