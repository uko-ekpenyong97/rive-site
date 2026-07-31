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
const { RiveButton } = await import("../components/RiveButton");
const {
  GET_STARTED_CAT,
  GET_STARTED_ROCKET,
  R_LOGO_SHUFFLE,
  RIVE_SITE_ASSETS,
} = await import("../components/riveSiteAssets");

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
      "hero__status",
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

  it("status line is a prop with the live site's default", () => {
    expect(ssr).toContain("SCRIPTING IS LIVE");
    expect(renderToString(<Hero status="RENDER IS LIVE" />)).toContain(
      "RENDER IS LIVE",
    );
  });

  it("entrance indices cover the six-element stack with no gap", () => {
    /* The old order ended at 6 with the DemoSlot; re-indexed for the new stack.
       A duplicate or missing index makes an element pop out of cascade. */
    const css = readHeroCss();
    const indices = [...css.matchAll(/--enter-index:\s*(\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(indices.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
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
describe("hover inputs match the probe", () => {
  it("the cat drives its five zones, left to right, without gaps", () => {
    const zones = GET_STARTED_CAT.hoverInputs.map((h) => h.zone);
    expect(zones).toEqual([
      [0, 0.2],
      [0.2, 0.4],
      [0.4, 0.6],
      [0.6, 0.8],
      [0.8, 1],
    ]);
    /* Contiguous: every pointer position lands in exactly one zone. */
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i][0]).toBe(zones[i - 1][1]);
    }
  });

  it("isHovercenter keeps the file's lowercase spelling", () => {
    /* The file's own internal name — the Recticle precedent. Correcting it to
       isHoverCenter would silently stop the centre zone from firing. */
    const names = GET_STARTED_CAT.hoverInputs.map((h) => h.name);
    expect(names).toContain("isHovercenter");
    expect(names).not.toContain("isHoverCenter");
  });

  it("the rocket drives isHover and nothing else", () => {
    /* Recon suggested Smoke/NoSmoke inputs; the probe found they are TIMELINES.
       Pinned so nobody re-adds an input the file does not have. */
    expect(GET_STARTED_ROCKET.hoverInputs.map((h) => h.name)).toEqual([
      "isHover",
    ]);
  });

  it("the R logo is autonomous — no inputs to drive", () => {
    expect(R_LOGO_SHUFFLE.hoverInputs).toEqual([]);
    expect(R_LOGO_SHUFFLE.paintsOwnLabel).toBe(false);
  });

  it("pointer movement sets exactly one zone at a time", () => {
    const inputs = GET_STARTED_CAT.hoverInputs.map((h) => ({
      name: h.name,
      value: false,
    }));
    fake.state.inputs.set("Motion", inputs);
    const el = mount(<RiveButton asset={GET_STARTED_CAT} label="Get started" />);
    const button = el.querySelector(".rive-button") as HTMLElement;
    button.getBoundingClientRect = () =>
      ({ left: 0, width: 100 }) as DOMRect;

    const move = (clientX: number) =>
      act(() => {
        button.dispatchEvent(
          new MouseEvent("pointermove", { bubbles: true, clientX }),
        );
      });

    move(50);
    expect(inputs.filter((i) => i.value).map((i) => i.name)).toEqual([
      "isHovercenter",
    ]);

    move(95);
    expect(inputs.filter((i) => i.value).map((i) => i.name)).toEqual([
      "isHoverRight2",
    ]);

    /* Leaving must clear every zone, or the cat stays frozen mid-lean after the
       cursor has gone. React delegates onPointerLeave from `pointerout`. */
    act(() => {
      button.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
    });
    expect(inputs.filter((i) => i.value)).toEqual([]);
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

  it("the wordmark is letterspaced in CSS, not with literal spaces", () => {
    /* "R I V E" in the markup would be announced letter by letter. */
    const ssr = renderToString(<Hero />);
    expect(ssr).toContain(">RIVE<");
    expect(ssr.includes("R I V E")).toBe(false);
  });
});
