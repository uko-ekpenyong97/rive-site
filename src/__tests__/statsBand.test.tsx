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
  COUNT_STAGGER_MS,
  BLUR_EASING,
  BLUR_PX,
  MAX_LAYERS,
  OFFSET,
  CENTER_OFFSET,
  EVERY_INTEGER_MAX,
  FIRST_DWELL_MS,
  LAST_DWELL_MS,
  frameFor,
  springFrame,
  blurFrame,
  delayFor,
  mirror,
  transformFor,
  tickValues,
  tickSchedule,
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
    expect([0, 1, 2, 3].map((i) => delayFor(i))).toEqual([0, 50, 100, 150]);
  });

  /* The ripple is a REVEAL concept. During counting it must be off: at 50ms a
     3-digit stat gives its third slot a 100ms delay while the next tick commits
     at 80ms, so that digit would animate a value that is already stale. */
  it("switches the ripple off during counting", () => {
    expect(COUNT_STAGGER_MS).toBe(0);
    expect([0, 1, 2, 3].map((i) => delayFor(i, COUNT_STAGGER_MS))).toEqual([
      0, 0, 0, 0,
    ]);
  });

  /* The blur runs on its OWN easing across the full duration. Riding the spring,
     it clamped at its floor at 47% of the roll and left 2 of 9 frames visibly
     blurred — the owner reported "no blurs", correctly. Decoupled: 6 of 9. */
  it("keeps the blur off the spring", () => {
    expect(BLUR_EASING).toBe("linear");
    expect(BLUR_EASING).not.toBe(SPRING_EASING);
  });

  it("splits a frame into a spring half and a blur half that lose nothing", () => {
    for (const phase of ["settled", "incoming", "outgoing"] as const) {
      expect({ ...springFrame(phase), ...blurFrame(phase) }).toEqual(
        frameFor(phase),
      );
    }
  });

  it("caps live layers per slot at 3", () => {
    expect(MAX_LAYERS).toBe(3);
  });
});

/* ── the count schedule ───────────────────────────────────────────────────── */

describe("tick schedule", () => {
  const TARGETS = [4, 90, 2, 120];

  it.each(TARGETS)("target %i starts at 0 and lands exactly on target", (t) => {
    const { values } = tickSchedule(t);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(t);
  });

  it.each(TARGETS)("target %i is strictly increasing, no repeats", (t) => {
    const { values } = tickSchedule(t);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    expect(new Set(values).size).toBe(values.length);
  });

  /* Deceleration, asserted on the SCHEDULE rather than on observed frame times:
     the ramp step at ten ticks is 8.9ms, smaller than a 60Hz frame, so sampled
     dwells invert order even though the schedule never does. */
  it.each(TARGETS)("target %i has non-decreasing intervals", (t) => {
    const { intervals } = tickSchedule(t);
    for (let i = 1; i < intervals.length; i += 1) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
  });

  it("ticks every integer below the threshold, so 0→4 counts 0,1,2,3,4", () => {
    expect(tickValues(4)).toEqual([0, 1, 2, 3, 4]);
    expect(tickValues(2)).toEqual([0, 1, 2]);
    expect(tickValues(EVERY_INTEGER_MAX)).toHaveLength(EVERY_INTEGER_MAX + 1);
  });

  /* A constant sampled-step count is what keeps a bigger number from being a
     longer wait — 90, 120 and 999 all take the same 1200ms. */
  it.each([19, 20, 90, 120, 999])(
    "target %i samples to a tick count inside 8–12",
    (t) => {
      const steps = tickSchedule(t).values.length - 1;
      expect(steps).toBeGreaterThanOrEqual(8);
      expect(steps).toBeLessThanOrEqual(12);
    },
  );

  it("runs the two big stats for ~1.2s, inside the 1.0–1.4s band", () => {
    expect(tickSchedule(90).total).toBeCloseTo(1200, 0);
    expect(tickSchedule(120).total).toBeCloseTo(1200, 0);
  });

  /* Small targets finish sooner, and that is the accepted trade. Normalising
     totals would make 2× flip every 260ms beside 120fps at 71ms — a 3.7×
     cadence spread that reads as one of them being broken. */
  it("lets small stats finish early rather than stretching them", () => {
    expect(tickSchedule(2).total).toBeLessThan(tickSchedule(120).total);
    expect(tickSchedule(4).total).toBeLessThan(tickSchedule(90).total);
  });

  it("dwells inside the requested 70–90ms / 150–200ms windows", () => {
    const { intervals } = tickSchedule(120);
    expect(intervals[0]).toBe(FIRST_DWELL_MS);
    expect(intervals[intervals.length - 1]).toBe(LAST_DWELL_MS);
    expect(FIRST_DWELL_MS).toBeGreaterThanOrEqual(70);
    expect(FIRST_DWELL_MS).toBeLessThanOrEqual(90);
    expect(LAST_DWELL_MS).toBeGreaterThanOrEqual(150);
    expect(LAST_DWELL_MS).toBeLessThanOrEqual(200);
  });

  /* Without the reservation clamp, ease-out rounding saturates near the end and
     the tail becomes 11,12,12,12,12 — duplicates, and a target reached early. */
  it("never saturates early, even where rounding wants to", () => {
    for (const t of [11, 12, 13, 15, 21, 37]) {
      const { values } = tickSchedule(t);
      expect(new Set(values).size).toBe(values.length);
      expect(values[values.length - 1]).toBe(t);
      expect(values[values.length - 2]).toBeLessThan(t);
    }
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
  /* The count is driven by setTimeout against absolute deadlines, so the whole
     ~1.2s schedule is steppable without waiting for it. */
  vi.useFakeTimers();
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * What a reader actually sees as the value: the newest layer of each slot.
 *
 * NOT `.stats-band__digits`.textContent — during a roll every slot holds two or
 * three stacked characters, so the raw text of "76" mid-roll reads as "6786".
 * They are absolutely positioned on top of each other, so that string never
 * appears on screen, but a test that asserted on it would be measuring the DOM
 * rather than the design.
 */
function visibleValues(): string[] {
  return [...host!.querySelectorAll(".stats-band__digits")].map((run) =>
    [...run.querySelectorAll(".stats-band__slot")]
      .map((slot) => {
        const layers = slot.querySelectorAll(".stats-band__char");
        return layers[layers.length - 1]?.textContent ?? "";
      })
      .join(""),
  );
}

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
    const slotCounts = () =>
      [...host!.querySelectorAll(".stats-band__value")].map(
        (v) => v.querySelectorAll(".stats-band__slot").length,
      );

    /* Pre-reveal the count sits at 0, so every stat is one digit + its suffix.
       The digit run still reserves the TARGET's width, so nothing shifts when
       the count grows into it. */
    expect(slotCounts()).toEqual([2, 2, 2, 2]);
    expect(
      [...host!.querySelectorAll(".stats-band__digits")].map((d) =>
        (d as HTMLElement).style.getPropertyValue("--digit-width"),
      ),
    ).toEqual(["1", "2", "1", "3"]);

    await act(async () => {
      observers.forEach((fire) => fire(true));
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Settled: 4× · 90% · 2× · 120fps → 1+1, 2+1, 1+1, 3+1
    expect(slotCounts()).toEqual([2, 3, 2, 4]);
  });

  it("marks the suffix slot so it can size to its own text", async () => {
    await mount();
    const suffixes = [...host!.querySelectorAll(".stats-band__slot--suffix")];
    expect(suffixes).toHaveLength(4);
    expect(suffixes.map((s) => s.textContent)).toEqual(["××", "%%", "××", "fpsfps"]);
    // Doubled because each suffix slot carries an aria-hidden sizer copy.
  });

  /* DELIBERATELY INVERTED (2026-07-29). This assertion previously read "renders
     the real numbers, never an intermediate count" and enforced the opposite
     rule: the earlier spec forbade ticking through integers. The owner reversed
     it — the numbers must now count. Inverting rather than deleting keeps the
     reversal legible, so nobody later reads the absence of a rule as an
     oversight and "restores" it. */
  it("DOES render intermediate values while counting", async () => {
    await mount();
    // Before reveal the count sits at 0 — the reveal is what starts it.
    expect(visibleValues()).toEqual(["0", "0", "0", "0"]);

    await act(async () => {
      observers.forEach((fire) => fire(true));
    });

    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
      visibleValues().forEach((d) => seen.add(d));
    }
    // The 120 stat must pass through values that are neither 0 nor the target.
    const intermediates = [...seen].filter(
      (v) => v !== "" && v !== "0" && !["4", "90", "2", "120"].includes(v),
    );
    expect(intermediates.length).toBeGreaterThan(0);
  });

  it("lands on the exact targets, never one short", async () => {
    await mount();
    await act(async () => {
      observers.forEach((fire) => fire(true));
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(visibleValues()).toEqual(["4", "90", "2", "120"]);
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

/* ── the change path, now live ────────────────────────────────────────────── */

describe("digit roll: old and new characters coexist during a tick", () => {
  /* This is the test I flagged as missing when the change path was dormant. It
     is not dormant now — every tick drives it. */
  it("stacks a new layer instead of mutating the old one", async () => {
    const calls: Array<{ keyframes: unknown; options: unknown }> = [];
    vi.spyOn(Element.prototype, "animate").mockImplementation(function (
      this: Element,
      keyframes: unknown,
      options: unknown,
    ) {
      calls.push({ keyframes, options });
      return {
        finished: new Promise(() => {}), // never settles: hold the roll open
        cancel() {},
        commitStyles() {},
      } as unknown as Animation;
    } as typeof Element.prototype.animate);

    await mount();
    await act(async () => {
      observers.forEach((fire) => fire(true));
    });
    // Far enough in for the ones digit of 120 to have ticked several times.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    const slots = [...host!.querySelectorAll(".stats-band__slot")];
    const stacked = slots.filter(
      (s) => s.querySelectorAll(".stats-band__char").length > 1,
    );
    expect(stacked.length).toBeGreaterThan(0);

    /* Only the newest layer carries the value; the ones leaving are decoration
       and must not be announced twice. */
    for (const slot of stacked) {
      const chars = [...slot.querySelectorAll(".stats-band__char")];
      const hidden = chars.filter((c) => c.getAttribute("aria-hidden") === "true");
      expect(hidden).toHaveLength(chars.length - 1);
      expect(chars[chars.length - 1].getAttribute("aria-hidden")).toBeNull();
    }
  });

  it("never stacks more than the cap", async () => {
    vi.spyOn(Element.prototype, "animate").mockImplementation(
      () =>
        ({
          finished: new Promise(() => {}),
          cancel() {},
          commitStyles() {},
        }) as unknown as Animation,
    );

    await mount();
    await act(async () => {
      observers.forEach((fire) => fire(true));
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    for (const slot of host!.querySelectorAll(".stats-band__slot")) {
      expect(
        slot.querySelectorAll(".stats-band__char").length,
      ).toBeLessThanOrEqual(MAX_LAYERS);
    }
  });

  it("drives each roll with a spring pair and a separate linear blur", async () => {
    const eased: string[] = [];
    vi.spyOn(Element.prototype, "animate").mockImplementation(function (
      _keyframes: unknown,
      options: { easing?: string },
    ) {
      if (options?.easing) eased.push(options.easing);
      return {
        finished: new Promise(() => {}),
        cancel() {},
        commitStyles() {},
      } as unknown as Animation;
    } as typeof Element.prototype.animate);

    await mount();
    await act(async () => {
      observers.forEach((fire) => fire(true));
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(eased).toContain(SPRING_EASING);
    expect(eased).toContain(BLUR_EASING);
    // Every spring animation is paired with a blur animation.
    expect(eased.filter((e) => e === BLUR_EASING).length).toBe(
      eased.filter((e) => e === SPRING_EASING).length,
    );
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
