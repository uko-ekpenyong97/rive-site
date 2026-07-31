// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { Footer } from "../components/Footer";
import {
  RIVE_WORDMARK_PATH,
  RIVE_WORDMARK_R_PATH,
  RIVE_WORDMARK_VIEWBOX,
} from "../components/riveWordmark";

/**
 * FooterMark — the layered outline wordmark that closes the page.
 *
 * The effect is four stacked copies of one path at different weights, ported
 * from business.x.com's footer mark. These pin the recipe, because every value
 * in it is load-bearing and none of it is guessable from looking at the result:
 * drop non-scaling-stroke and the hairlines fatten with the viewport; move the
 * ghosts onto an alpha token and they composite away to nothing.
 */

const html = renderToString(<Footer />);

/* ── the letterforms ──────────────────────────────────────────────────────── */

describe("the wordmark", () => {
  /* The rendered box is the logotype's, opened up on every side. It cannot be
     the raw one: the letterforms touch all four edges of 0 0 275 50, and an SVG
     clips to its viewBox, so the payload dot lost its top half every time it
     crossed the R's shoulder at y=0. */
  it("renders in the footer at a padded version of the logotype's viewBox", () => {
    expect(html).toContain('class="footer-mark"');
    const [vx, vy, vw, vh] = RIVE_WORDMARK_VIEWBOX.split(" ").map(Number);
    const rendered = html.match(/class="footer-mark"[^>]*viewBox="([^"]+)"/)?.[1];
    expect(rendered, "no viewBox on the mark").toBeTruthy();
    const [rx, ry, rw, rh] = rendered!.split(" ").map(Number);
    const pad = vx - rx;
    /* Enough for the dot's radius plus the widest half-stroke at the smallest
       width this renders at. */
    expect(pad).toBeGreaterThanOrEqual(2);
    expect(ry).toBe(vy - pad);
    expect(rw).toBe(vw + pad * 2);
    expect(rh).toBe(vh + pad * 2);
  });

  it("is the last thing in the footer", () => {
    const markAt = html.indexOf("footer-mark");
    const attributionAt = html.indexOf("footer__attribution");
    expect(markAt).toBeGreaterThan(attributionAt);
  });

  /* The footer already says RIVE in text above this; the mark is the page's
     closing word, not a second announcement of the same name. */
  it("is hidden from assistive tech and unfocusable", () => {
    expect(html).toMatch(/class="footer-mark"[^>]*aria-hidden="true"/);
    expect(html).toMatch(/class="footer-mark"[^>]*focusable="false"/);
  });
});

/* ── the four layers ──────────────────────────────────────────────────────── */

describe("the layer recipe (measured off X, pinned here)", () => {
  const layers = [...html.matchAll(/<path[^>]*class="footer-mark__layer"[^>]*>/g)].map(
    (m) => m[0],
  );

  it("stacks exactly four copies of the same path", () => {
    expect(layers).toHaveLength(4);
    const widths = layers.map(
      (l) => l.match(/stroke-width="([\d.]+)"/)?.[1],
    );
    expect(widths).toEqual(["1", "2.5", "1.5", "0.75"]);
  });

  it("keeps X's opacities, crisp layer last", () => {
    const opacities = layers.map(
      (l) => l.match(/stroke-opacity="([\d.]+)"/)?.[1],
    );
    expect(opacities).toEqual(["0.5", "0.3", "0.6", "1"]);
  });

  /* The ghosts must sit on an OPAQUE token. --border-subtle is already
     rgba(255,255,255,0.10), so a 0.3 stroke-opacity on it composites to 3% white
     on black and the halo vanishes — measured, not theorised. And the crisp
     layer is --text-primary because X's top layer is their maximum contrast;
     --text-secondary would translate their 100% into our 67%. */
  it("puts the ghosts on an opaque token and the hairline on the brightest", () => {
    const strokes = layers.map((l) => l.match(/stroke="([^"]+)"/)?.[1]);
    expect(strokes).toEqual([
      "var(--text-secondary)",
      "var(--text-secondary)",
      "var(--text-secondary)",
      "var(--text-primary)",
    ]);
    for (const s of strokes) {
      expect(s).not.toContain("border-subtle");
      expect(s).not.toContain("text-muted");
    }
  });

  /* Without this the hairlines thicken with the viewport and four distinct
     weights collapse into one fat outline. */
  it("gives every layer non-scaling-stroke", () => {
    for (const l of layers) expect(l).toContain('vector-effect="non-scaling-stroke"');
  });

  it("draws outlines, never fills", () => {
    for (const l of layers) expect(l).toContain('fill="none"');
  });

  it("uses the real logotype geometry on every layer", () => {
    for (const l of layers) expect(l).toContain(RIVE_WORDMARK_PATH);
  });
});

/* ── the payload dot ──────────────────────────────────────────────────────── */

describe("the payload dot", () => {
  it("rides the R on a motion path", () => {
    expect(html).toContain("footer-mark__dot");
    expect(html).toContain("offset-path");
    /* The R, not the whole wordmark: the other subpaths are relative to the
       letters before them and cannot be lifted out. */
    expect(html).toContain(RIVE_WORDMARK_R_PATH);
  });

  it("is the amber payload dot, not a new colour", () => {
    const dot = html.match(/<circle[^>]*footer-mark__dot[^>]*>/)?.[0] ?? "";
    expect(dot).toContain("var(--accent-default)");
  });

  /* The R subpath must remain independently valid — it is the one letter that
     opens with an absolute moveto. If a re-extraction ever makes it relative,
     the dot would start from wherever the previous letter ended. */
  it("travels a self-contained, absolutely-positioned subpath", () => {
    expect(RIVE_WORDMARK_R_PATH.startsWith("M")).toBe(true);
    expect(RIVE_WORDMARK_R_PATH.startsWith("m")).toBe(false);
    expect(RIVE_WORDMARK_PATH.startsWith(RIVE_WORDMARK_R_PATH)).toBe(true);
  });
});

/* ── motion behaviour ─────────────────────────────────────────────────────── */

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const observers: Array<(intersecting: boolean) => void> = [];

beforeEach(() => {
  observers.length = 0;
  class FakeIO {
    constructor(private cb: IntersectionObserverCallback) {
      observers.push((intersecting) =>
        this.cb(
          [{ isIntersecting: intersecting } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        ),
      );
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeIO;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  if (!Element.prototype.animate) {
    Element.prototype.animate = function () {
      return {
        play() {},
        pause() {},
        cancel() {},
        finished: Promise.resolve(),
      } as unknown as Animation;
    };
  }
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
});

async function mount(reduced = false) {
  window.matchMedia = ((q: string) => ({
    matches: reduced && q.includes("prefers-reduced-motion"),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  const { FooterMark } = await import("../components/FooterMark");
  await act(async () => {
    root!.render(<FooterMark />);
  });
  return host!;
}

describe("motion", () => {
  it("animates the dot once for a slow lap", async () => {
    const spy = vi.spyOn(Element.prototype, "animate");
    await mount();
    await act(async () => observers.forEach((f) => f(true)));

    expect(spy).toHaveBeenCalledTimes(1);
    const [frames, opts] = spy.mock.calls[0];
    expect(frames).toEqual([
      { offsetDistance: "0%" },
      { offsetDistance: "100%" },
    ]);
    expect(opts).toMatchObject({
      duration: 45_000,
      easing: "linear",
      iterations: Infinity,
    });
  });

  /* Idle correctness: a mark nobody can see does not animate. Sustained rather
     than one-shot, so it stops again when the footer scrolls away. */
  it("pauses while the footer is offscreen", async () => {
    const pause = vi.fn();
    vi.spyOn(Element.prototype, "animate").mockReturnValue({
      play() {},
      pause,
      cancel() {},
    } as unknown as Animation);

    await mount();
    await act(async () => observers.forEach((f) => f(false)));
    expect(pause).toHaveBeenCalled();
  });

  /* The layered mark carries itself without the dot — which is the thing X's
     static version proves. */
  it("renders no dot at all under reduced motion", async () => {
    const spy = vi.spyOn(Element.prototype, "animate");
    await mount(true);
    expect(host!.querySelector(".footer-mark__dot")).toBeNull();
    expect(host!.querySelectorAll(".footer-mark__layer")).toHaveLength(4);
    expect(spy).not.toHaveBeenCalled();
  });
});
