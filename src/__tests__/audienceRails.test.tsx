// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { USE_CASES } from "../components/UseCaseModal/useCaseContent";

/**
 * AudienceRails glyphs — integration guards for docs/specs/audiencerails-glyphs-spec.md §7.
 *
 * The Rive runtime is mocked. That is deliberate and it is the right layer: these
 * assertions are about OUR contract with the runtime — which artboard each rail
 * asks for, that the token colours get written, that an offscreen glyph stops
 * advancing, that reduced motion lands on Rest instead of the machine. Whether
 * WebGL2 then draws the right pixels is Rive's job, and jsdom could not answer it
 * anyway.
 */

/* ── the fake runtime ─────────────────────────────────────────────────────── */

const fake = vi.hoisted(() => {
  interface Spy {
    (...args: unknown[]): void;
    calls: unknown[][];
  }
  const spy = (): Spy => {
    const calls: unknown[][] = [];
    const fn = ((...args: unknown[]) => {
      calls.push(args);
    }) as Spy;
    fn.calls = calls;
    return fn;
  };

  interface FakeRive {
    opts: Record<string, unknown>;
    play: Spy;
    pause: Spy;
    colors: Record<string, number[][]>;
    booleans: Record<string, boolean>;
    viewModelInstance: {
      color: (name: string) => { rgb: (r: number, g: number, b: number) => void };
      boolean: (name: string) => { value: boolean };
    };
  }

  const state = {
    /** Per-artboard, so the identity stays stable across re-renders. */
    byArtboard: new Map<string, FakeRive>(),
    order: [] as string[],
    failLoad: false,
  };

  const get = (opts: Record<string, unknown>): FakeRive => {
    const key = String(opts.artboard);
    const existing = state.byArtboard.get(key);
    if (existing) {
      existing.opts = opts;
      return existing;
    }
    const colors: Record<string, number[][]> = {};
    const booleans: Record<string, boolean> = {};
    const inst: FakeRive = {
      opts,
      play: spy(),
      pause: spy(),
      colors,
      booleans,
      viewModelInstance: {
        color: (name) => ({
          rgb: (r, g, b) => {
            (colors[name] ??= []).push([r, g, b]);
          },
        }),
        boolean: (name) => ({
          get value() {
            return booleans[name] ?? false;
          },
          set value(v: boolean) {
            booleans[name] = v;
          },
        }),
      },
    };
    state.byArtboard.set(key, inst);
    state.order.push(key);
    return inst;
  };

  const reset = () => {
    state.byArtboard.clear();
    state.order.length = 0;
    state.failLoad = false;
  };

  return { state, get, reset };
});

vi.mock("@rive-app/react-webgl2", async () => {
  const React = await import("react");
  return {
    useRive: (opts: Record<string, unknown>) => {
      const inst = fake.get(opts);
      const failing = fake.state.failLoad;
      React.useEffect(() => {
        if (failing) (opts.onLoadError as (() => void) | undefined)?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [failing]);
      return {
        rive: failing ? null : inst,
        RiveComponent: (props: Record<string, unknown>) =>
          React.createElement("canvas", props),
      };
    },
  };
});

/* ── controllable IntersectionObserver ────────────────────────────────────── */

class FakeIO {
  static instances: FakeIO[] = [];
  private cb: IntersectionObserverCallback;
  private elements: Element[] = [];
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    FakeIO.instances.push(this);
  }
  observe(el: Element) {
    this.elements.push(el);
  }
  unobserve() {}
  disconnect() {
    this.elements = [];
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  fire(isIntersecting: boolean) {
    if (!this.elements.length) return;
    this.cb(
      this.elements.map(
        (target) => ({ target, isIntersecting }) as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
  static fireAll(isIntersecting: boolean) {
    for (const io of FakeIO.instances) io.fire(isIntersecting);
  }
}

/* jsdom does not resolve var() in computed styles, so the component's token
   resolver would always miss. Stub only the var() lookup and delegate everything
   else — this still exercises the real code path (set a colour, read the COMPUTED
   colour, parse rgb, write it), which is the behaviour worth pinning. */
const TOKEN_RGB: Record<string, string> = {
  "--text-secondary": "rgb(138, 143, 152)", // #8A8F98
  "--accent-default": "rgb(255, 164, 28)", // #FFA41C
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  vi.resetModules(); // fresh module = fresh token cache
  fake.reset();
  FakeIO.instances = [];
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeIO;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;

  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(((el: Element) => {
    const declared = (el as HTMLElement).style?.color ?? "";
    const token = /var\((--[a-z-]+)\)/.exec(declared)?.[1];
    if (token && TOKEN_RGB[token]) {
      return { color: TOKEN_RGB[token] } as CSSStyleDeclaration;
    }
    return real(el);
  }) as typeof window.getComputedStyle);

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

async function mountRails(opts: { reduced?: boolean } = {}) {
  window.matchMedia = ((query: string) => ({
    matches: opts.reduced === true && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  const { AudienceRails } = await import("../components/AudienceRails");
  await act(async () => {
    root!.render(<AudienceRails />);
  });
  return host!;
}

async function approach() {
  await act(async () => {
    FakeIO.fireAll(true);
  });
}

const GLYPHS = ["GlyphDesigner", "GlyphAnimator", "GlyphDeveloper"] as const;

/* ── the guards ───────────────────────────────────────────────────────────── */

describe("AudienceRails glyphs: mounting and artboard mapping", () => {
  it("nothing is fetched before the rails are approached (lazy on approach)", async () => {
    await mountRails();
    expect(fake.state.order).toEqual([]);
    expect(host!.querySelectorAll("canvas")).toHaveLength(0);
  });

  it("three canvases mount once the rails are approached", async () => {
    await mountRails();
    await approach();
    expect(host!.querySelectorAll("canvas")).toHaveLength(3);
    expect(fake.state.order).toHaveLength(3);
  });

  /* THE MAPPING GUARD. Each rail must get its own craft's drawing — the whole
     argument of the section is that the pen tool belongs to the designer, the
     timeline to the animator, the state machine to the developer. Pair each rail
     by its visible marker text with the artboard its canvas asked for, so a
     reordering cannot silently land the Designer glyph on the Developer rail. */
  it.each([
    ["01 — DESIGNERS", "GlyphDesigner"],
    ["02 — ANIMATORS", "GlyphAnimator"],
    ["03 — DEVELOPERS", "GlyphDeveloper"],
  ])("rail %s draws %s", async (marker, artboard) => {
    await mountRails();
    await approach();

    const rail = [...host!.querySelectorAll(".audience-rails__rail")].find((el) =>
      el.textContent?.includes(marker),
    );
    expect(rail, `rail ${marker} not found`).toBeTruthy();

    /* Position of this rail among the rails === position of its canvas among the
       mounted artboards, because each rail mounts exactly one. */
    const rails = [...host!.querySelectorAll(".audience-rails__rail")];
    const index = rails.indexOf(rail!);
    expect(fake.state.order[index]).toBe(artboard);
  });

  it("all three artboards are distinct (no rail doubles up)", async () => {
    await mountRails();
    await approach();
    expect(new Set(fake.state.order).size).toBe(3);
    expect([...fake.state.order].sort()).toEqual([...GLYPHS].sort());
  });

  it("every canvas loads the one shared .riv", async () => {
    await mountRails();
    await approach();
    for (const artboard of GLYPHS) {
      const src = String(fake.state.byArtboard.get(artboard)!.opts.src);
      expect(src).toContain("audience_glyphs");
    }
  });
});

describe("AudienceRails glyphs: the view-model colour write (spec §7)", () => {
  /* Load-bearing, not cosmetic: the .riv ships theme-agnostic by design, so
     without this write the glyphs render at their baked defaults. */
  it("writes token-resolved strokeColor into every GlyphVM", async () => {
    await mountRails();
    await approach();
    for (const artboard of GLYPHS) {
      const inst = fake.state.byArtboard.get(artboard)!;
      expect(inst.colors.strokeColor?.[0]).toEqual([138, 143, 152]);
    }
  });

  it("writes token-resolved accentColor into every GlyphVM", async () => {
    await mountRails();
    await approach();
    for (const artboard of GLYPHS) {
      const inst = fake.state.byArtboard.get(artboard)!;
      expect(inst.colors.accentColor?.[0]).toEqual([255, 164, 28]);
    }
  });

  it("binds the view model, without which both writes would no-op", async () => {
    await mountRails();
    await approach();
    for (const artboard of GLYPHS) {
      expect(fake.state.byArtboard.get(artboard)!.opts.autoBind).toBe(true);
    }
  });
});

describe("AudienceRails glyphs: hover is driven by the rail, not the canvas", () => {
  it("pointerenter on the rail sets GlyphVM.hover on that rail's glyph only", async () => {
    await mountRails();
    await approach();

    const rails = [...host!.querySelectorAll(".audience-rails__rail")];
    await act(async () => {
      rails[1].dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true }),
      );
      rails[1].dispatchEvent(
        new PointerEvent("pointerenter", { bubbles: false }),
      );
    });

    expect(fake.state.byArtboard.get("GlyphAnimator")!.booleans.hover).toBe(true);
    expect(fake.state.byArtboard.get("GlyphDesigner")!.booleans.hover).toBe(
      false,
    );
    expect(fake.state.byArtboard.get("GlyphDeveloper")!.booleans.hover).toBe(
      false,
    );
  });

  it("pointerleave releases it", async () => {
    await mountRails();
    await approach();

    const rails = [...host!.querySelectorAll(".audience-rails__rail")];
    await act(async () => {
      rails[1].dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      rails[1].dispatchEvent(new PointerEvent("pointerenter"));
    });
    await act(async () => {
      rails[1].dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
      rails[1].dispatchEvent(new PointerEvent("pointerleave"));
    });

    expect(fake.state.byArtboard.get("GlyphAnimator")!.booleans.hover).toBe(
      false,
    );
  });
});

describe("AudienceRails glyphs: idle correctness", () => {
  it("plays the state machine while visible", async () => {
    await mountRails();
    await approach();
    for (const artboard of GLYPHS) {
      expect(fake.state.byArtboard.get(artboard)!.play.calls.length).toBeGreaterThan(
        0,
      );
    }
  });

  /* A glyph nobody can see must not advance its machine. */
  it("pauses every glyph once it scrolls offscreen", async () => {
    await mountRails();
    await approach();
    await act(async () => {
      FakeIO.fireAll(false);
    });
    for (const artboard of GLYPHS) {
      expect(
        fake.state.byArtboard.get(artboard)!.pause.calls.length,
      ).toBeGreaterThan(0);
    }
  });

  it("never autoplays — playback is always an explicit decision", async () => {
    await mountRails();
    await approach();
    for (const artboard of GLYPHS) {
      expect(fake.state.byArtboard.get(artboard)!.opts.autoplay).toBe(false);
    }
  });
});

describe("AudienceRails glyphs: reduced motion", () => {
  /* Rest is a linear animation and deliberately NOT a state in Glyph_SM, so the
     reduced-motion path must drive the timeline directly. Naming the state
     machine here would start Idle_Loop — the exact thing being avoided. */
  it("drives the Rest timeline, not the state machine", async () => {
    await mountRails({ reduced: true });
    await approach();
    for (const artboard of GLYPHS) {
      const opts = fake.state.byArtboard.get(artboard)!.opts;
      expect(opts.animations).toBe("Rest");
      expect(opts.stateMachines).toBeUndefined();
    }
  });

  it("plays Rest exactly once to land on the authored rest frame", async () => {
    await mountRails({ reduced: true });
    await approach();
    for (const artboard of GLYPHS) {
      const inst = fake.state.byArtboard.get(artboard)!;
      expect(inst.play.calls).toEqual([["Rest"]]);
    }
  });

  it("disables hover writes so the rest pose stays put", async () => {
    await mountRails({ reduced: true });
    await approach();

    const rails = [...host!.querySelectorAll(".audience-rails__rail")];
    await act(async () => {
      rails[0].dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      rails[0].dispatchEvent(new PointerEvent("pointerenter"));
    });

    expect(
      fake.state.byArtboard.get("GlyphDesigner")!.booleans.hover,
    ).toBeUndefined();
  });

  it("still writes the token colours (theme is not motion)", async () => {
    await mountRails({ reduced: true });
    await approach();
    expect(
      fake.state.byArtboard.get("GlyphDesigner")!.colors.strokeColor?.[0],
    ).toEqual([138, 143, 152]);
  });
});

describe("AudienceRails glyphs: failure renders nothing", () => {
  /* Deliberately NOT the modal hero's §8 rule. A hero that fails degrades to a
     labelled placeholder because the sheet reserved space for it. These glyphs
     are decorative-plus — the rail text carries the information — so a failed
     glyph leaves no trace and the rail collapses to exactly the rail that
     shipped before it existed. */
  it("renders no placeholder box, no label and no canvas when the asset fails", async () => {
    fake.state.failLoad = true;
    await mountRails();
    await approach();

    expect(host!.querySelectorAll(".audience-glyph")).toHaveLength(0);
    expect(host!.querySelectorAll("canvas")).toHaveLength(0);
    expect(host!.textContent).not.toMatch(/glyph/i);
  });

  it("leaves the rail text completely intact", async () => {
    fake.state.failLoad = true;
    await mountRails();
    await approach();

    expect(host!.textContent).toContain("Design with real logic");
    expect(host!.textContent).toContain("Animate for runtime");
    expect(host!.textContent).toContain("Ship it natively");
    expect(host!.querySelectorAll(".audience-rails__rail")).toHaveLength(3);
  });
});

describe("AudienceRails glyphs: accessibility", () => {
  /* The rail heading and body name the audience and carry the offer. The glyph
     is illustration, so announcing it would add noise without information. */
  it("every glyph host is aria-hidden", async () => {
    await mountRails();
    await approach();
    const hosts = [...host!.querySelectorAll(".audience-glyph")];
    expect(hosts).toHaveLength(3);
    for (const el of hosts) {
      expect(el.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("adds no images, labels or roles to the accessible tree", async () => {
    await mountRails();
    await approach();
    for (const el of host!.querySelectorAll(".audience-glyph")) {
      expect(el.getAttribute("role")).toBeNull();
      expect(el.getAttribute("aria-label")).toBeNull();
    }
  });

  it("server-renders the reserved slot with no canvas and aria-hidden intact", async () => {
    const { AudienceRails } = await import("../components/AudienceRails");
    const html = renderToString(<AudienceRails />);
    expect(html).toContain("audience-glyph");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<canvas");
  });
});

describe("AudienceRails copy: X-card discipline (spec §1)", () => {
  /* Heading plus at most two lines. Asserted as a character budget because the
     rendered line count is a layout fact the DOM cannot report here: at the
     three-column rail width the body wraps at roughly 50 characters, so 100 is
     the two-line ceiling. */
  const MAX_BODY = 100;

  it.each([
    ["01 — DESIGNERS"],
    ["02 — ANIMATORS"],
    ["03 — DEVELOPERS"],
  ])("rail %s body fits in two lines", async (marker) => {
    await mountRails();
    const rail = [...host!.querySelectorAll(".audience-rails__rail")].find((el) =>
      el.textContent?.includes(marker),
    );
    const body = rail!.querySelector(".audience-rails__body")!.textContent ?? "";
    expect(body.length).toBeLessThanOrEqual(MAX_BODY);
  });

  it("every rail keeps exactly one heading and one body", async () => {
    await mountRails();
    for (const rail of host!.querySelectorAll(".audience-rails__rail")) {
      expect(rail.querySelectorAll(".audience-rails__headline")).toHaveLength(1);
      expect(rail.querySelectorAll(".audience-rails__body")).toHaveLength(1);
    }
  });

  /* The animator rail used to end "…and the files stay tiny." That is a
     performance claim on a craft rail, and StatsBand already owns the size
     argument — so it was cut rather than reworded. */
  it("the animator rail makes no file-size claim", async () => {
    await mountRails();
    const rail = [...host!.querySelectorAll(".audience-rails__rail")].find((el) =>
      el.textContent?.includes("02 — ANIMATORS"),
    );
    const body = rail!.querySelector(".audience-rails__body")!.textContent ?? "";
    expect(body).not.toMatch(/tiny|small|kilobyte|file size|lightweight/i);
  });

  it("every rail still keeps its call to action", async () => {
    await mountRails();
    const links = [...host!.querySelectorAll(".audience-rails__rail .text-link")];
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.textContent?.trim()).toMatch(/→$/);
    }
  });
});

/* ── the not-a-hero guard ─────────────────────────────────────────────────── */

describe("AudienceRails glyphs are NOT heroes", () => {
  /* The five-hero regression block in modalContent.test.tsx pins the five shipped
     modal heroes. These three glyphs are a different kind of object — decorative,
     unlicensed, aria-hidden, on the homepage rather than behind a modal — and
     they must never be folded into that block or counted by a hero completeness
     check. These assertions are the tripwire for exactly that mistake. */

  const rivHeroes = () =>
    USE_CASES.map((c) => c.hero).filter(
      (h): h is Extract<NonNullable<typeof h>, { type: "riv" }> =>
        h?.type === "riv",
    );

  it("there are still exactly five shipped modal heroes", () => {
    expect(rivHeroes()).toHaveLength(5);
  });

  it("no glyph artboard appears among the hero artboards", () => {
    const heroArtboards = rivHeroes().map((h) => h.artboard);
    for (const glyph of GLYPHS) {
      expect(heroArtboards).not.toContain(glyph);
    }
  });

  it("audience_glyphs.riv is not registered as any use case's hero", () => {
    for (const hero of rivHeroes()) {
      expect(hero.src).not.toContain("audience_glyphs");
    }
  });

  it("no use case gained a Glyph_SM state machine", () => {
    for (const hero of rivHeroes()) {
      expect(hero.stateMachine).not.toBe("Glyph_SM");
    }
  });

  it("the glyphs carry no credit, licence or provenance (nothing to attribute)", async () => {
    /* A hero without a credit chip would be a licensing bug. A glyph with one
       would be a category error — it is our own drawing, and it is decoration. */
    await mountRails();
    await approach();
    for (const el of host!.querySelectorAll(".audience-glyph")) {
      expect(el.textContent?.trim()).toBe("");
    }
  });
});
