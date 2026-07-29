/**
 * CaseStudies: real posters replace the demo placeholders.
 *
 * Ported from `.context/modal-smoke.mjs` (the untracked hand-run smoke script).
 * Every assertion here encodes a real past bug or a deliberate design decision —
 * including the ones that look redundant. Redundancy is the point: the same fact
 * is checked from the data model and from the rendered HTML.
 */

import { renderToString } from "react-dom/server";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { count } from "./helpers";
import { CaseStudies } from "../components/CaseStudies";

/*
 * StoryRow measures its panel with `useLayoutEffect`, which React warns about
 * under `renderToString`. That is a known SSR-only warning from a client-side
 * measurement effect — the component is correct as written, so the noise is
 * silenced here in the test file only, never "fixed" in the component.
 */
const realConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("useLayoutEffect")) return;
    realConsoleError(...args);
  };
});
afterAll(() => {
  console.error = realConsoleError;
});

let csHtml = "";

beforeAll(() => {
  csHtml = renderToString(<CaseStudies />);
});

const EXPECTED = ["spotify", "linkedin", "duolingo", "brilliant"] as const;

describe("CaseStudies: real posters replace the demo placeholders", () => {
  it("CaseStudies renders", () => {
    expect(csHtml).toBeTruthy();
  });

  /* THE MAPPING GUARD: pair each panel with the first <img> inside it, so a
     poster cannot silently land on the wrong company's card. */
  describe("panel → poster mapping guard", () => {
    const pairs = (): [string, string][] =>
      [
        ...csHtml.matchAll(
          /case-study-panel-([a-z]+)"[\s\S]*?<img[^>]*src="([^"]*)"/g,
        ),
      ].map((m) => [m[1], m[2]] as [string, string]);

    it("4 panels each render a poster", () => {
      expect(pairs()).toHaveLength(4);
    });

    for (const id of EXPECTED) {
      it(`${id} card → ${id}-poster.avif`, () => {
        const hit = pairs().find(([p]) => p === id);
        expect(hit, `${id} card got: no image`).toBeDefined();
        expect(hit![1], `${id} card got: ${hit![1]}`).toContain(`${id}-poster`);
        expect(hit![1].split("/").pop()).toBe(`${id}-poster.avif`);
      });
    }
  });

  it("all four posters lazy-loaded", () => {
    expect(count(csHtml, /loading="lazy"/g)).toBe(4);
  });

  it("all four use empty alt (claim already names the company)", () => {
    expect(count(csHtml, /alt=""/g)).toBe(4);
  });

  it("no remote image URLs", () => {
    expect(/<img[^>]*src="https?:/.test(csHtml)).toBe(false);
  });

  it("DemoSlot placeholder gone from this section", () => {
    expect(csHtml.includes("demo-slot")).toBe(false);
  });

  it("no DEMO SLOT captions left", () => {
    expect(/DEMO SLOT/i.test(csHtml)).toBe(false);
  });

  /* Crop overrides are per-story data. Brilliant's mascot sits bottom-left and
     a centred crop sliced it, so that one is anchored low; the rest centre. */
  it("exactly one crop override set", () => {
    expect(count(csHtml, /object-position/g)).toBe(1);
  });

  it("the override is on brilliant, anchored low", () => {
    expect(
      /case-study-panel-brilliant"[\s\S]*?object-position:\s*center 85%/.test(
        csHtml,
      ),
    ).toBe(true);
  });

  it(`all ${EXPECTED.length} poster files resolve locally`, () => {
    // The original called node's `existsSync` against paths relative to the
    // process CWD. `import.meta.glob` is the same on-disk question asked through
    // Vite: it enumerates files that actually exist under the directory, and is
    // anchored on this file rather than on wherever vitest happened to start.
    // (It also keeps the suite free of `@types/node`, which this repo does not
    // install, so `tsc -b` stays green.)
    const onDisk = import.meta.glob("../assets/case-studies/*.avif");
    const absent = EXPECTED.map(
      (id) => `../assets/case-studies/${id}-poster.avif`,
    ).filter((f) => !(f in onDisk));
    expect(absent, `missing on disk: ${absent.join(", ")}`).toEqual([]);
  });
});
