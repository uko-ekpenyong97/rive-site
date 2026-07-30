import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { CommunityShowcase } from "../components/CommunityShowcase";
import { USE_CASES } from "../components/UseCaseModal/useCaseContent";
import { text, count } from "./helpers";

/**
 * CommunityWall — 18 real Featured marketplace files.
 *
 * These are CC BY, so attribution is a licence obligation rather than a caption.
 * The guards below are mostly about that obligation surviving: the credit has to
 * be in the accessible name whether or not anyone hovers, and the duplicated
 * marquee copies must not make a screen reader read all 18 credits twice.
 */

const rendered = renderToString(<CommunityShowcase />);
/* React emits a `<!-- -->` separator between adjacent text nodes, so the creator
   line arrives as `by <!-- -->name`. Stripped here so span contents can be read
   whole — the same artifact scripts/fetch-community.mjs documents for Rive's own
   <title> tags, which is where this project first met it. */
const html = rendered.replace(/<!--\s*-->/g, "");

/** Every thumbnail this repo has actually committed. */
const onDisk = import.meta.glob("../assets/community/*");

/* ── the files ────────────────────────────────────────────────────────────── */

describe("the wall is real, harvested work", () => {
  it("renders three rows of six", () => {
    expect(count(html, /community-showcase__row/g)).toBe(3);
    /* Six per row, doubled for the seamless loop. */
    expect(count(html, /community-showcase__tile/g)).toBe(36);
  });

  it("every tile links to a rive.app marketplace page", () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((h) => h.includes("marketplace"));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toMatch(/^https:\/\/rive\.app\/marketplace\/[\w-]+\/$/);
    }
  });

  it("links to 18 distinct files", () => {
    const hrefs = new Set(
      [...html.matchAll(/href="(https:\/\/rive\.app\/marketplace\/[^"]+)"/g)].map(
        (m) => m[1],
      ),
    );
    expect(hrefs.size).toBe(18);
  });

  /* Hot-linking someone's CC BY thumbnail off their CDN is both a performance
     and a courtesy problem. Every image is committed here. */
  it("serves every thumbnail locally, none remote", () => {
    const srcs = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.length).toBe(36);
    for (const src of srcs) expect(src).not.toMatch(/^https?:/);
  });

  it("commits every thumbnail it references as AVIF", () => {
    const files = Object.keys(onDisk).filter((f) => f.endsWith(".avif"));
    /* 18 wall files + the 9 the CommunityStrip credits. */
    expect(files.length).toBe(27);
    expect(Object.keys(onDisk).filter((f) => f.endsWith(".png"))).toEqual([]);
  });
});

/* ── the licence obligation ───────────────────────────────────────────────── */

describe("attribution survives without a hover", () => {
  /* The overlay hides with opacity, never display/visibility — so the title and
     creator stay in the accessible name. A tile named only by its URL would
     leave the CC BY obligation unmet for anyone who cannot hover. */
  it("puts title and creator in the link's own text", () => {
    const body = text(html);
    expect(body).toContain("Interactive Aquarium");
    expect(body).toContain("by nickyinprogress");
    expect(body).toContain("Batter up, Bunny!");
    expect(body).toContain("by MikkelBorris");
  });

  /* The pattern is visible-text-first with a hidden append — never an aria-label
     that REPLACES the name the visible text already computes. */
  it("never replaces the accessible name with aria-label", () => {
    expect(html).not.toMatch(/class="community-showcase__tile"[^>]*aria-label/);
  });

  it("gives the thumbnail an empty alt so the credit is not read twice", () => {
    expect(count(html, /<img[^>]*alt=""/g)).toBe(36);
  });

  /* The regex that reads these pages was non-greedy and mangled any title
     containing " by ": StudioRun parsed as title "StudioRun - A Cosmic Game"
     with creator "TheLittleLabs by thelittlelabs". The username cross-check in
     the harvester caught it. Asserted on the SPANS, not the flattened text —
     flattened, a correct render legitimately reads "…by TheLittleLabs by
     thelittlelabs", because the title really does end in "by TheLittleLabs". */
  it("splits the StudioRun title and creator where the page does", () => {
    const titles = [...html.matchAll(/community-showcase__title">([^<]*)</g)].map(
      (m) => m[1],
    );
    const creators = [
      ...html.matchAll(/community-showcase__creator">([^<]*)</g),
    ].map((m) => m[1]);

    expect(titles).toContain("StudioRun - A Cosmic Game by TheLittleLabs");
    expect(creators).toContain("by thelittlelabs");
    /* The truncated parse, which must never come back. */
    expect(titles).not.toContain("StudioRun - A Cosmic Game");
    expect(creators).not.toContain("by TheLittleLabs by thelittlelabs");
  });
});

/* ── marquee accessibility ────────────────────────────────────────────────── */

describe("the duplicated copies are invisible to assistive tech", () => {
  /* Without this a keyboard user tabs through 36 links to cross an 18-file wall
     and a screen reader reads every credit twice. */
  it("hides exactly half the tiles and removes them from the tab order", () => {
    expect(count(html, /aria-hidden="true"/g)).toBe(18);
    expect(count(html, /tabindex="-1"/g)).toBe(18);
  });

  /* The two attributes must travel together: hidden from the tree AND out of
     the tab order. Either alone leaves a phantom — a focusable node nobody can
     hear, or an announced node nobody can reach. */
  it("pairs every aria-hidden tile with a removed tab stop", () => {
    const tiles = html
      .split("<a ")
      .filter((t) => t.includes("community-showcase__tile"))
      .map((t) => t.slice(0, t.indexOf(">")));
    expect(tiles.length).toBe(36);

    const hidden = tiles.filter((t) => t.includes('aria-hidden="true"'));
    const untabbable = tiles.filter((t) => t.includes('tabindex="-1"'));
    expect(hidden.length).toBe(18);
    expect(untabbable.length).toBe(18);
    for (const t of hidden) expect(t).toContain('tabindex="-1"');
    /* And the reachable half carries neither. */
    for (const t of tiles.filter((x) => !x.includes('aria-hidden="true"'))) {
      expect(t).not.toContain('tabindex="-1"');
    }
  });
});

/* ── no file is used twice on this site ───────────────────────────────────── */

describe("the wall is disjoint from every other community surface", () => {
  const wallHrefs = new Set(
    [...html.matchAll(/href="(https:\/\/rive\.app\/marketplace\/[^"]+)"/g)].map(
      (m) => m[1].replace(/\/+$/, ""),
    ),
  );

  /* The 18 were chosen as Featured MINUS what this site already uses. If a file
     ever appears in both places the page credits the same work twice and the
     wall stops being a wider sample. */
  it("shares no file with the CommunityStrip", () => {
    const strip = USE_CASES.flatMap((c) => c.community ?? []).map((i) =>
      i.href.replace(/\/+$/, ""),
    );
    expect(strip.length).toBeGreaterThan(0);
    for (const href of strip) expect(wallHrefs.has(href)).toBe(false);
  });

  it("shares no file with a modal hero credit", () => {
    const heroes = USE_CASES.map((c) => c.hero)
      .filter((h): h is Extract<NonNullable<typeof h>, { type: "riv" }> => h?.type === "riv")
      .map((h) => h.credit.href)
      .filter((h): h is string => Boolean(h))
      .map((h) => h.replace(/\/+$/, ""));
    for (const href of heroes) expect(wallHrefs.has(href)).toBe(false);
  });

  it("shares no thumbnail file with the strip", () => {
    const stripThumbs = new Set(
      USE_CASES.flatMap((c) => c.community ?? []).map((i) =>
        i.thumb.split("/").pop(),
      ),
    );
    const wallThumbs = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) =>
      m[1].split("/").pop(),
    );
    for (const t of wallThumbs) expect(stripThumbs.has(t)).toBe(false);
  });
});
