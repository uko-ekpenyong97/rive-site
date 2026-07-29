// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  SPRING_DURATION_MS,
  SPRING_DURATION_S,
  SPRING_BOUNCE,
  SPRING_EASING,
  STAGGER_MS,
  BLUR_PX,
  OFFSET,
  CENTER_OFFSET,
  frameFor,
  delayFor,
  mirror,
  transformFor,
} from "../components/statsBandMotion";

/**
 * StatsBand digit roll.
 *
 * NO MID-FLIGHT STYLE SAMPLING. These animations run on the Web Animations API,
 * so the values in flight live on the animation, not the style attribute — a
 * test that read `el.style` mid-animation would be reading nothing and would
 * pass for the wrong reason. Instead this pins the motion CONTRACT (the exact
 * frames, the stagger arithmetic, the baked curve) and leaves the settled-state
 * check to scripts/render-check.mjs, which asks a real browser.
 */

/* ── the contract ─────────────────────────────────────────────────────────── */

describe("digit-roll motion values (pinned — a softer 'cleanup' must fail here)", () => {
  it("spring is bounce 0.2 over 150ms", () => {
    expect(SPRING_BOUNCE).toBe(0.2);
    expect(SPRING_DURATION_MS).toBe(150);
  });

  /* Framer states durations in seconds; WAAPI takes ms. CLAUDE.md: convert at
     the boundary. Both forms are pinned so they cannot drift apart. */
  it("the seconds and ms forms describe the same duration", () => {
    expect(SPRING_DURATION_S).toBe(0.15);
    expect(SPRING_DURATION_MS).toBe(SPRING_DURATION_S * 1000);
  });

  it("blur is 4px", () => {
    expect(BLUR_PX).toBe(4);
  });

  it("stagger is 50ms per position", () => {
    expect(STAGGER_MS).toBe(50);
  });

  it("offsets are ±50% around a settled 0, composed on a -50% centering", () => {
    expect(OFFSET).toEqual({ settled: 0, outgoing: -50, incoming: 50 });
    expect(CENTER_OFFSET).toBe(-50);
  });

  /* Increment: the outgoing digit leaves upward, the incoming arrives from
     below. Resolved against the centering transform, that is -100% / 0%. */
  it("resolves increment frames to the right transforms", () => {
    expect(frameFor("settled").transform).toBe("translateY(-50%)");
    expect(frameFor("outgoing").transform).toBe("translateY(-100%)");
    expect(frameFor("incoming").transform).toBe("translateY(0%)");
  });

  it("mirrors the direction for a decrement", () => {
    expect(frameFor("outgoing", -1).transform).toBe("translateY(0%)");
    expect(frameFor("incoming", -1).transform).toBe("translateY(-100%)");
    expect(mirror(OFFSET.incoming)).toBe(-50);
    expect(transformFor(0)).toBe("translateY(-50%)");
  });

  it("only the settled frame is opaque and unblurred", () => {
    expect(frameFor("settled")).toMatchObject({
      opacity: 1,
      filter: "blur(0px)",
    });
    for (const phase of ["incoming", "outgoing"] as const) {
      expect(frameFor(phase)).toMatchObject({
        opacity: 0,
        filter: "blur(4px)",
      });
    }
  });

  it("ripples leftmost-first, 50ms apart, with the suffix riding last", () => {
    // "120" + "fps" → four elements, the suffix at index 3.
    expect([0, 1, 2, 3].map(delayFor)).toEqual([0, 50, 100, 150]);
  });
});

/* ── the baked curve ──────────────────────────────────────────────────────── */

describe("the baked spring is provably Framer's, not merely spring-ish", () => {
  /* `motion` is imported HERE AND ONLY HERE, in a test. It must never reach a
     component: StatsBand is on Home, and importing motion into the entry chunk
     measured +43.4 kB gzipped (171,506 → 214,934) to animate four numbers.
     CLAUDE.md keeps it off visitor-facing chunks; /showcase is lazy for exactly
     that reason. This import is the regeneration check, not a dependency. */
  it("regenerates byte-identically from the real motion package", async () => {
    const { spring, generateLinearEasing, calcGeneratorDuration } =
      await import("motion");

    const generator = spring({
      duration: SPRING_DURATION_MS,
      bounce: SPRING_BOUNCE,
      keyframes: [0, 1],
    });
    const settleMs = calcGeneratorDuration(generator);
    const regenerated = generateLinearEasing(
      (t: number) => generator.next(t * settleMs).value,
      settleMs,
    );

    expect(settleMs).toBe(SPRING_DURATION_MS);
    expect(regenerated).toBe(SPRING_EASING);
  });

  it("overshoots, because bounce 0.2 is supposed to", () => {
    const points = SPRING_EASING.match(/[\d.]+/g)!.map(Number);
    expect(Math.max(...points)).toBeGreaterThan(1);
    expect(Math.max(...points)).toBeCloseTo(1.0151, 4);
  });

  /* The overshoot rides the TRANSFORM. Opacity and blur clamp at their floors
     when the curve passes target — correct, and deliberately not asserted as
     applying unclamped to `filter`. This test exists to say so out loud. */
  it("starts at 0 and ends at exactly 1", () => {
    const points = SPRING_EASING.match(/[\d.]+/g)!.map(Number);
    expect(points[0]).toBe(0);
    expect(points[points.length - 1]).toBe(1);
  });
});

/* ── rendering ────────────────────────────────────────────────────────────── */

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
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  /* jsdom has no WAAPI. The component must not crash without it, and these
     assertions are about structure, not playback. */
  if (!Element.prototype.animate) {
    Element.prototype.animate = function () {
      return {
        finished: Promise.resolve(),
        cancel() {},
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

  const { StatsBand } = await import("../components/StatsBand");
  await act(async () => {
    root!.render(<StatsBand />);
  });
  return host!;
}

describe("StatsBand structure", () => {
  it("splits every stat into per-digit slots plus a suffix slot", async () => {
    await mount();
    const values = [...host!.querySelectorAll(".stats-band__value")];
    expect(values).toHaveLength(4);
    // 4× · 90% · 2× · 120fps  →  1+1, 2+1, 1+1, 3+1
    expect(values.map((v) => v.querySelectorAll(".stats-band__slot").length)).toEqual(
      [2, 3, 2, 4],
    );
  });

  it("marks the suffix slot so it can size to its own text", async () => {
    await mount();
    const suffixes = [...host!.querySelectorAll(".stats-band__slot--suffix")];
    expect(suffixes).toHaveLength(4);
    expect(suffixes.map((s) => s.textContent)).toEqual(["××", "%%", "××", "fpsfps"]);
    // Doubled because each suffix slot carries an aria-hidden sizer copy.
  });

  it("renders the real numbers, never an intermediate count", async () => {
    await mount();
    const text = host!.textContent ?? "";
    for (const n of ["4", "90", "2", "120"]) expect(text).toContain(n);
    // The old implementation started every stat at 0 and ticked upward.
    expect(host!.querySelector(".stats-band__value")?.textContent).not.toBe("0");
  });
});

describe("StatsBand reveal", () => {
  it("hides the characters before paint, then settles them once in view", async () => {
    await mount();
    const chars = () => [...host!.querySelectorAll(".stats-band__char")];
    expect(chars().every((c) => c.getAttribute("data-state") === "hidden")).toBe(
      true,
    );

    await act(async () => {
      observers.forEach((fire) => fire(true));
    });
    await act(async () => {});

    expect(chars().every((c) => !c.hasAttribute("data-state"))).toBe(true);
  });

  /* The animation is an enhancement. Server-rendered markup carries the settled
     value, so a visitor whose JS never runs still sees the numbers. */
  it("server-renders settled values with no hidden state", async () => {
    const { StatsBand } = await import("../components/StatsBand");
    const html = renderToString(<StatsBand />);
    expect(html).not.toContain('data-state="hidden"');
    /* Tags stripped WITHOUT inserting spaces: each digit is its own span, so
       "120" is only contiguous once the markup is removed. */
    const bare = html.replace(/<[^>]+>/g, "");
    expect(bare).toContain("120");
    expect(bare).toContain("fps");
  });
});

describe("StatsBand reduced motion", () => {
  it("renders settled immediately — no hidden state, no animation", async () => {
    const spy = vi.spyOn(Element.prototype, "animate");
    await mount(true);
    const chars = [...host!.querySelectorAll(".stats-band__char")];
    expect(chars.length).toBeGreaterThan(0);
    expect(chars.some((c) => c.hasAttribute("data-state"))).toBe(false);

    await act(async () => {
      observers.forEach((fire) => fire(true));
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
