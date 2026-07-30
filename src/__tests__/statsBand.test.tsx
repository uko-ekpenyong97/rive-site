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
  ROLL_OVERLAP_MS,
  OFFSET,
  CENTER_OFFSET,
  SPIN_BLUR_PX,
  SPIN_OPACITY,
  SPIN_EXIT_MS,
  SPIN_DURATION_MS,
  SPIN_MIN_TARGET,
  TAIL_DWELLS,
  frameFor,
  springFrame,
  blurFrame,
  delayFor,
  mirror,
  transformFor,
  countPlan,
  spinValueAt,
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
 *
 * THE STROBE METRIC IS PARTLY BLIND — read this before optimising against it.
 * The smoothness investigation scored candidates on max per-frame movement of
 * the ink centroid. That metric cannot see glyph-shape churn: an outgoing and an
 * incoming glyph rise past each other and their centroids largely cancel, so a
 * candidate can score well and still visibly strobe. It ranked a "reduced
 * travel" variant best; frame captures showed that variant had simply amputated
 * the motion into a dissolve-in-place, with MORE frozen frames than the version
 * it replaced. The montage adjudicated, not the number. Any future tuning here
 * must be judged on rendered frames — improving the metric alone is capable of
 * making this worse.
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

  /* Incoming and outgoing already run concurrently, so a symmetric crossfade
     bottoms at max(e, 1-e) = 0.50 — measured 0.504. Holding the outgoing at
     full strength for this long lifts the crossing to a measured 0.955.

     THE MARGIN AGAINST THE LAYER CAP IS ZERO: an outgoing layer now lives
     ROLL_OVERLAP_MS + SPRING_DURATION_MS = 200ms, against a shortest tail dwell
     of 150ms, so it outlives the next arrival and the measured peak is exactly
     MAX_LAYERS. Any tail dwell shorter than 200ms would want a fourth layer and
     the cap would cull a still-visible glyph. */
  it("overlaps rolls, and stays inside the layer cap while doing it", () => {
    expect(ROLL_OVERLAP_MS).toBe(50);
    const outgoingLifetime = ROLL_OVERLAP_MS + SPRING_DURATION_MS;
    expect(outgoingLifetime).toBe(200);
    const shortestDwell = Math.min(...TAIL_DWELLS);
    /* One overlap deep is fine (that is the third layer). Two would not be. */
    expect(outgoingLifetime).toBeLessThan(shortestDwell * 2);
  });
});

/* ── the count plan ──────────────────────────────────────────────────────── */

describe("count plan: a spin that clunks home", () => {
  const BIG = [90, 120];

  it.each(BIG)("target %i spins, then lands through a crafted tail", (t) => {
    const plan = countPlan(t);
    expect(plan.spin).not.toBeNull();
    expect(plan.spin!.to).toBe(t - TAIL_DWELLS.length);
    expect(plan.tail.map((s) => s.value)).toEqual([t - 2, t - 1, t]);
  });

  it.each(BIG)("target %i still totals ~1.2s", (t) => {
    expect(countPlan(t).total).toBeCloseTo(1200, 0);
  });

  /* Half of a big stat is the landing, and that IS the design — a plain
     ease-out cannot decelerate into a roll on its own, so the tail is what
     makes the deceleration land rather than stop dead. */
  it("splits a big count evenly between spinning and landing", () => {
    const plan = countPlan(120);
    expect(plan.spin!.duration).toBe(SPIN_DURATION_MS);
    expect(plan.total - plan.spin!.duration).toBe(600);
  });

  it("lengthens each tail dwell so the wheel clunks home", () => {
    expect(TAIL_DWELLS).toEqual([150, 200, 250]);
    for (let i = 1; i < TAIL_DWELLS.length; i += 1) {
      expect(TAIL_DWELLS[i]).toBeGreaterThan(TAIL_DWELLS[i - 1]);
    }
    /* Every tail dwell must clear a roll, or the landing is not crafted. */
    for (const d of TAIL_DWELLS) expect(d).toBeGreaterThanOrEqual(150);
  });

  /* Nothing to spin: a two-step count has no fast phase to smooth, so 2 and 4
     are all landing. */
  it.each([2, 4, SPIN_MIN_TARGET])("target %i does not spin at all", (t) => {
    const plan = countPlan(t);
    expect(plan.spin).toBeNull();
    expect(plan.tail.map((s) => s.value)).toEqual(
      Array.from({ length: t }, (_, i) => i + 1),
    );
  });

  it.each([2, 4, 90, 120])("target %i lands exactly on target", (t) => {
    const plan = countPlan(t);
    expect(plan.tail[plan.tail.length - 1].value).toBe(t);
  });

  it.each([2, 4, 90, 120])("target %i never repeats a tail value", (t) => {
    const values = countPlan(t).tail.map((s) => s.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("commits every tail step in increasing time order", () => {
    const tail = countPlan(120).tail;
    for (let i = 1; i < tail.length; i += 1) {
      expect(tail[i].at).toBeGreaterThan(tail[i - 1].at);
    }
  });
});

describe("the spin curve", () => {
  /* Deceleration is linear IN RATE — what a wheel under constant braking does —
     chosen so the rate at handoff is exactly one integer per roll. The
     continuous phase arrives at the discrete cadence instead of being cut off
     at it. */
  it("decelerates: each successive 100ms covers fewer integers", () => {
    const { to, duration } = countPlan(120).spin!;
    const samples = [0, 100, 200, 300, 400, 500, 600].map((t) =>
      spinValueAt(t, to, duration),
    );
    const deltas = samples.slice(1).map((v, i) => v - samples[i]);
    for (let i = 1; i < deltas.length; i += 1) {
      expect(deltas[i]).toBeLessThanOrEqual(deltas[i - 1]);
    }
  });

  it("starts at 0 and hands off exactly at the spin target", () => {
    const { to, duration } = countPlan(120).spin!;
    expect(spinValueAt(0, to, duration)).toBe(0);
    expect(spinValueAt(duration, to, duration)).toBe(to);
    expect(spinValueAt(duration * 2, to, duration)).toBe(to);
  });

  /* The whole point of the redesign: during the fast phase the number must
     change on essentially every frame, not hold for six and then flash. */
  it("changes value on most frames during the fast phase", () => {
    const { to, duration } = countPlan(120).spin!;
    const frames = Array.from({ length: 18 }, (_, i) =>
      spinValueAt(i * (1000 / 60), to, duration),
    );
    const changes = frames.slice(1).filter((v, i) => v !== frames[i]).length;
    expect(changes).toBe(frames.length - 1);
  });
});

describe("spin state values (pinned)", () => {
  it("holds a sustained blur and a slight dim, not a pulse", () => {
    expect(SPIN_BLUR_PX).toBe(4);
    expect(SPIN_OPACITY).toBe(0.8);
  });

  /* A digit leaves spin once it has held the same character for a roll's worth
     of time — "changing slower than a roll can complete" is exactly when a
     discrete roll becomes possible. */
  it("exits spin after one roll's worth of stillness", () => {
    expect(SPIN_EXIT_MS).toBe(SPRING_DURATION_MS);
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

/* ── the two regimes, on the stat that has both ───────────────────────────── */

describe("regimes: 120 spins, then rolls", () => {
  /** The 3-digit stat is the last `.stats-band__value` in the band. */
  const bigStat = () => {
    const values = [...host!.querySelectorAll(".stats-band__value")];
    return values[values.length - 1];
  };

  it("spins without stacking layers — no ghosting while the wheel turns", async () => {
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
    // 300ms in: the spin phase runs 0-600ms.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    for (const slot of bigStat().querySelectorAll(".stats-band__slot")) {
      expect(slot.querySelectorAll(".stats-band__char")).toHaveLength(1);
    }
  });

  it("marks spinning digits with the spin state", async () => {
    await mount();
    await act(async () => {
      observers.forEach((fire) => fire(true));
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    const states = [...bigStat().querySelectorAll(".stats-band__char")].map(
      (c) => c.getAttribute("data-state"),
    );
    expect(states).toContain("spin");
  });

  /* The landing is a real roll, not a continuation of the spin — this is the
     "clunks home" half, and it is what the whole tail exists to buy. */
  it("stacks layers again once it reaches the crafted tail", async () => {
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
    // Past the 600ms spin, into the 118 -> 119 -> 120 tail.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    const stacked = [...bigStat().querySelectorAll(".stats-band__slot")].filter(
      (s) => s.querySelectorAll(".stats-band__char").length > 1,
    );
    expect(stacked.length).toBeGreaterThan(0);
  });

  it("leaves nothing spinning once it has landed", async () => {
    await mount();
    await act(async () => {
      observers.forEach((fire) => fire(true));
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    for (const char of host!.querySelectorAll(".stats-band__char")) {
      expect(char.getAttribute("data-state")).not.toBe("spin");
    }
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
