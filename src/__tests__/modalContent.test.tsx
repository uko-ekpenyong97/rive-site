/**
 * Modal content guards — ported from `.context/modal-smoke.mjs` (lines 558–787).
 *
 * See `./helpers.ts` for the history: this suite is the hand-run smoke script,
 * tracked. Every assertion below encodes a real past bug or a deliberate design
 * decision, and several facts are deliberately asserted twice — once from the
 * content model and once from the rendered HTML. That redundancy is the point:
 * the data model and the markup can drift apart, and each half catches the other.
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";

import { ModalHero } from "../components/UseCaseModal/ModalHero";
import { ModalSheet } from "../components/UseCaseModal/ModalSheet";
import { ProofReel } from "../components/UseCaseModal/ProofReel";
import { RuntimeChips } from "../components/UseCaseModal/RuntimeChips";
import { ModalCTA } from "../components/UseCaseModal/ModalCTA";
import { CommunityStrip } from "../components/UseCaseModal/CommunityStrip";
import {
  USE_CASES,
  getUseCase,
  PRELOAD_MAX_BYTES,
  shouldPreloadHero,
  EDITOR_URL,
  type UseCaseHero,
} from "../components/UseCaseModal/useCaseContent";
import { text, count } from "./helpers";

/* ── narrowing helpers ────────────────────────────────────────────────────
   The hero is a union and `UseCaseContent.hero` is optional, so nothing may
   touch `.artboard` / `.bytes` / `.credit` without narrowing first. These throw
   instead of casting: if a content edit drops a hero or swaps its variant, the
   suite fails loudly at that seam rather than silently asserting on `undefined`.
   ──────────────────────────────────────────────────────────────────────── */

type RivHero = Extract<UseCaseHero, { type: "riv" }>;

function heroOf(slug: string): UseCaseHero {
  const hero = getUseCase(slug)?.hero;
  if (!hero) throw new Error(`expected a hero for "${slug}"`);
  return hero;
}

function rivHeroOf(slug: string): RivHero {
  const hero = heroOf(slug);
  if (hero.type !== "riv") {
    throw new Error(`expected a riv hero for "${slug}", got "${hero.type}"`);
  }
  return hero;
}

/* ─────────────────────────────────────────────────────────────────────────
   drawsgood is credited twice on purpose — assert it stays that way.
   ───────────────────────────────────────────────────────────────────────── */
describe("drawsgood two-hero credit guard", () => {
  it("drawsgood intentionally credited on exactly two heroes", () => {
    const drawsgoodHeroes = USE_CASES.filter(
      (c) => c.hero?.type === "riv" && c.hero.credit?.creator === "drawsgood",
    ).map((c) => c.slug);
    expect(drawsgoodHeroes.slice().sort().join(",")).toBe(
      "film-tv-broadcast,game-ui",
    );
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("hover-preload size policy", () => {
  /* The original printed PRELOAD_MAX_BYTES here as context for the rows below:
     PRELOAD_MAX_BYTES = 1,000,000. */

  const preloadChecks = USE_CASES.flatMap((c) => {
    const hero = c.hero;
    if (!hero || hero.type !== "riv") return [];
    /* NaN, not 0, when a hero has no recorded size: `undefined <= n` was false
       in the original, and `NaN <= n` is false too — so a hero that loses its
       byte count fails this row instead of quietly agreeing with the policy. */
    const bytes = hero.bytes ?? Number.NaN;
    const want = bytes <= PRELOAD_MAX_BYTES;
    const got = shouldPreloadHero(hero);
    return [
      {
        label: `${c.slug} (${bytes.toLocaleString()} B) → ${got ? "preload" : "skip"}`,
        want,
        got,
      },
    ];
  });

  it.each(preloadChecks)("$label", ({ want, got }) => {
    expect(got).toBe(want);
  });

  it("automotive excluded from hover-preload (4.1 MB)", () => {
    expect(shouldPreloadHero(heroOf("automotive"))).toBe(false);
  });

  it("the other three heroes keep their head start", () => {
    const othersIncluded = ["game-ui", "product-ui", "websites"].every((s) =>
      shouldPreloadHero(heroOf(s)),
    );
    expect(othersIncluded).toBe(true);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   The surface box is scoped to the fallback: a live canvas gets no data-state,
   the placeholder gets data-state="failed" and keeps the box. (Whether the CSS
   actually resolves to a transparent background is asserted in the browser
   driver, which can read computed styles.)
   ───────────────────────────────────────────────────────────────────────── */
describe("hero container chrome is state-scoped", () => {
  /* Re-rendered here rather than shared across files: each suite stands alone. */
  const uko = rivHeroOf("websites");
  const ukoHtml = renderToString(<ModalHero hero={uko} active={true} />);
  const noseyHtml = renderToString(
    <ModalHero hero={rivHeroOf("product-ui")} active={true} />,
  );
  const gameHtml = renderToString(
    <ModalHero hero={rivHeroOf("game-ui")} active={true} />,
  );
  const driveHtml = renderToString(
    <ModalHero hero={rivHeroOf("automotive")} active={true} />,
  );
  const retHtml = renderToString(
    <ModalHero hero={rivHeroOf("film-tv-broadcast")} active={true} />,
  );
  const ukoMissing = renderToString(
    <ModalHero hero={{ type: "pending", label: uko.fallbackLabel }} />,
  );

  const chromeChecks: [string, boolean][] = [
    ["live websites canvas: no failed-state flag", !ukoHtml.includes('data-state="failed"')],
    ["live nosey canvas: no failed-state flag", !noseyHtml.includes('data-state="failed"')],
    ["live health bar canvas: no failed-state flag", !gameHtml.includes('data-state="failed"')],
    ["live automotive canvas: no failed-state flag", !driveHtml.includes('data-state="failed"')],
    ["live reticle canvas: no failed-state flag", !retHtml.includes('data-state="failed"')],
    ["fallback still flags itself", ukoMissing.includes('data-kind="pending"')],
  ];

  it.each(chromeChecks)("%s", (label, ok) => {
    expect(ok, label).toBe(true);
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("CommunityStrip: real marketplace files (Tier 1 only)", () => {
  const stripCounts: [string, number][] = [
    ["game-ui", 4],
    ["product-ui", 5],
  ];

  it.each(stripCounts)("%s: %d items (spec range 4–6)", (slug, want) => {
    expect(getUseCase(slug)?.community?.length).toBe(want);
  });

  /* Tier 2 must not carry a strip — that is what keeps it lite. */
  it("no lite modal carries a strip", () => {
    const tier2WithStrip = USE_CASES.filter(
      (c) => c.tier === "lite" && c.community,
    ).map((c) => c.slug);
    expect(tier2WithStrip).toEqual([]);
  });

  const allItems = USE_CASES.flatMap((c) => c.community ?? []);

  it(`every one of ${allItems.length} items is CC BY`, () => {
    const nonCC = allItems.filter((i) => i.license !== "CC BY");
    expect(nonCC.map((i) => i.title)).toEqual([]);
  });

  it("every href is a rive.app marketplace/community URL", () => {
    const badHref = allItems.filter(
      (i) => !/^https:\/\/rive\.app\/(community\/files|marketplace)\//.test(i.href),
    );
    expect(badHref.map((i) => i.href)).toEqual([]);
  });

  /* Thumbnails must exist on disk — a broken import would ship a dead image. */
  it(`all ${allItems.length} thumbnails resolve locally (no hot-linking)`, () => {
    /* Asked through Vite rather than `node:fs`: `import.meta.glob` enumerates
       only files that actually exist, is anchored on this file instead of the
       process CWD, and keeps the suite free of `@types/node` — which this repo
       does not install, and which would otherwise leak Node globals into the
       app's own typecheck. Same question, same answer, green `tsc -b`. */
    const onDisk = import.meta.glob("../assets/community/*");
    const missingThumb = allItems.filter((i) => {
      const name = i.thumb.split("/").pop()?.split("?")[0] ?? "";
      return !(`../assets/community/${name}` in onDisk);
    });
    expect(missingThumb.map((i) => i.title)).toEqual([]);
  });

  it("no thumbnail points at a remote URL", () => {
    const remoteThumb = allItems.filter((i) => /^https?:/.test(i.thumb));
    expect(remoteThumb.map((i) => i.title)).toEqual([]);
  });

  /* Multi-contributor files must carry their full credit line. */
  it("both multi-contributor files carry full credits", () => {
    const multi = allItems.filter((i) => i.credits);
    const ok =
      multi.length === 2 &&
      multi.some(
        (i) =>
          Boolean(i.credits?.includes("Jerry Liu")) &&
          Boolean(i.credits?.includes("Pedro Alpera")),
      ) &&
      multi.some(
        (i) =>
          Boolean(i.credits?.includes("Silvia Sguotti")) &&
          Boolean(i.credits?.includes("Gabriele Montinaro")),
      );
    expect(ok, `multi-credit set: ${multi.map((i) => i.title).join(", ")}`).toBe(
      true,
    );
  });

  const gameCommunity = getUseCase("game-ui")?.community ?? [];
  const stripHtml = renderToString(
    <CommunityStrip items={gameCommunity} label="game-ui" />,
  );
  const stripText = text(stripHtml);

  it("strip renders (game-ui)", () => {
    expect(stripHtml.length).toBeGreaterThan(0);
  });

  const stripChecks: [string, boolean][] = [
    ["4 links rendered", count(stripHtml, /community-strip__link/g) === 4],
    ["4 thumbnails rendered", count(stripHtml, /<img/g) === 4],
    ["thumbnails lazy-loaded", count(stripHtml, /loading="lazy"/g) === 4],
    ["empty alt (title already in the name)", count(stripHtml, /alt=""/g) === 4],
    [
      "titles visible",
      stripText.includes("Game HUD/Scope Demo") && stripText.includes("Sophia III HUD"),
    ],
    [
      "creators visible",
      stripText.includes("by JcToon") && stripText.includes("by sloppyJ44"),
    ],
    ["licence in the accessible name, not visible copy", stripHtml.includes("CC BY")],
    ["full credits present for HUD/Scope", stripHtml.includes("Pedro Alpera")],
    [
      "no aria-label override on the links",
      !/community-strip__link[^>]*aria-label/.test(stripHtml),
    ],
    [
      "empty strip renders nothing",
      renderToString(<CommunityStrip items={[]} label="x" />) === "",
    ],
  ];

  it.each(stripChecks)("%s", (label, ok) => {
    expect(ok, label).toBe(true);
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("Campaigns: heroless lite modal, final content", () => {
  const camp = getUseCase("campaigns");
  if (!camp) throw new Error('expected a "campaigns" use case');

  const campHtml = renderToString(
    <ModalSheet eyebrow={camp.eyebrow} title={camp.claim} onClose={() => {}}>
      {camp.hero ? <ModalHero hero={camp.hero} /> : null}
      <ProofReel proof={camp.proof} quote={camp.quote} />
      <RuntimeChips runtimes={camp.runtimes} label={camp.slug} />
      <ModalCTA
        pageHref={camp.pageHref}
        label={camp.name}
        editorHref={EDITOR_URL}
      />
    </ModalSheet>,
  );
  const campText = text(campHtml);

  it("campaigns sheet renders", () => {
    expect(campHtml.length).toBeGreaterThan(0);
  });

  const heroAssistantHref = camp.proof[2].href;

  const campChecks: [string, boolean][] = [
    ["hero is omitted, not pending", camp.hero === undefined],
    ["no hero slot in the markup", !campHtml.includes("modal-hero")],
    ["no canvas", !campHtml.includes("<canvas")],
    ["no placeholder label", !campHtml.includes("__placeholder")],
    ["no reserved hero space (no rive-hero box)", !campHtml.includes("rive-hero")],
    [
      "claim exact",
      camp.claim === "Design ships the interaction. Code drives it with data.",
    ],
    ["3 proof lines", camp.proof.length === 3],
    [
      "Strava anchor + conversion stat",
      camp.proof[0].source === "Strava" &&
        camp.proof[0].stat === "30.2K new subscriptions",
    ],
    [
      "14 languages / millions of athletes in the claim",
      camp.proof[0].claim.includes("14 languages") &&
        camp.proof[0].claim.includes("millions of athletes"),
    ],
    ['second label is "In-house, in 3 months"', camp.proof[1].source === "In-house, in 3 months"],
    ["trial-starts stat", camp.proof[1].stat === "110K trial starts"],
    ["Hero Assistant supporting line", camp.proof[2].source === "Hero Assistant"],
    [
      "Hero Assistant links the rive.app blog post",
      Boolean(heroAssistantHref?.startsWith("https://rive.app/blog/year-wrapped")),
    ],
    [
      "that link renders as a real anchor",
      heroAssistantHref !== undefined && campHtml.includes(heroAssistantHref),
    ],
    [
      "pull quote text exact",
      camp.quote?.text === "Motion isn't just decoration here, it's core infrastructure.",
    ],
    [
      "quote attributed to Guido Rosso, Rive co-founder",
      camp.quote?.attribution === "Guido Rosso, Rive co-founder",
    ],
    ["quote is rendered", campHtml.includes("proof-reel__quote")],
    ["still tier lite", camp.tier === "lite"],
    ["no pageHref (ends at Get started)", camp.pageHref === undefined],
    ["Get started still offered", campText.includes("Get started")],
  ];

  it.each(campChecks)("%s", (label, ok) => {
    expect(ok, label).toBe(true);
  });

  /* Forbidden material: reserved stories and other people's IP. */
  it("no reserved/forbidden material in the rendered modal", () => {
    const forbidden = ["Spotify", "LinkedIn", "300M", "630M", "135M", "linkedin.com"];
    const leaked = forbidden.filter((f) => campText.includes(f));
    expect(leaked).toEqual([]);
  });

  /* No Strava artwork: the only link is the rive.app blog post. */
  it("all links are rive.app — no Strava imagery or offsite source", () => {
    const hrefs = [...campHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const badHrefs = hrefs.filter(
      (h) => !/^https:\/\/(rive\.app|editor\.rive\.app)/.test(h),
    );
    expect(badHrefs).toEqual([]);
  });

  /* No content entry may sit in the §8 fallback state. */
  it("zero pending heroes in content (union member stays as §8 fallback)", () => {
    const pendingContent = USE_CASES.filter((c) => c.hero?.type === "pending").map(
      (c) => c.slug,
    );
    expect(pendingContent).toEqual([]);
  });

  it("campaigns is the only heroless modal", () => {
    const heroless = USE_CASES.filter((c) => !c.hero).map((c) => c.slug);
    expect(heroless.join(",")).toBe("campaigns");
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   One place that asserts each shipped hero still has its own character, so a
   later hero cannot quietly homogenise the others.

   LOAD-BEARING — DO NOT EXTEND. This block is the single inventory of the five
   shipped heroes; other work is explicitly forbidden from adding rows or checks
   to it. A new hero belongs in its own section, and only graduates here when it
   ships.
   ───────────────────────────────────────────────────────────────────────── */
describe("regression guards: all five shipped heroes", () => {
  const shipped: {
    slug: string;
    name: string;
    artboard: string;
    ghost: boolean;
    rail: boolean;
    prov: "community" | "first-party";
    autoBind: boolean | undefined;
    cap: number | undefined;
  }[] = [
    { slug: "game-ui", name: "Health Bar", artboard: "healthBar", ghost: true, rail: false, prov: "community", autoBind: undefined, cap: undefined },
    { slug: "product-ui", name: "Nosey", artboard: "NotionAI 2", ghost: false, rail: true, prov: "first-party", autoBind: undefined, cap: 480 },
    { slug: "websites", name: "Uko", artboard: "Avatar", ghost: false, rail: false, prov: "first-party", autoBind: true, cap: 420 },
    { slug: "automotive", name: "Driving UI", artboard: "Artboard", ghost: false, rail: false, prov: "community", autoBind: true, cap: undefined },
    { slug: "film-tv-broadcast", name: "Reticle", artboard: "Recticle", ghost: false, rail: false, prov: "community", autoBind: true, cap: 420 },
  ];

  for (const s of shipped) {
    it(`${s.name}: artboard ${s.artboard}`, () => {
      expect(rivHeroOf(s.slug).artboard).toBe(s.artboard);
    });
    it(`${s.name}: ghost ${s.ghost ? "present" : "absent"}`, () => {
      expect(Boolean(rivHeroOf(s.slug).ghost)).toBe(s.ghost);
    });
    it(`${s.name}: rail ${s.rail ? "present" : "absent"}`, () => {
      expect(Boolean(rivHeroOf(s.slug).rail)).toBe(s.rail);
    });
    it(`${s.name}: ${s.prov} chip`, () => {
      expect(rivHeroOf(s.slug).credit.provenance).toBe(s.prov);
    });
    it(`${s.name}: autoBind ${String(s.autoBind)}`, () => {
      expect(rivHeroOf(s.slug).autoBind).toBe(s.autoBind);
    });
    it(`${s.name}: cap ${String(s.cap)}`, () => {
      expect(rivHeroOf(s.slug).maxWidth).toBe(s.cap);
    });
  }
});
