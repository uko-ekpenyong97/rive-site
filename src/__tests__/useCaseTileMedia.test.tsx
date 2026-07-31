/**
 * Tile media on the CLOSED bento cell.
 *
 * Extends the committed render suite rather than `.context/modal-smoke.mjs`:
 * that script no longer exists — it was the untracked hand-run smoke, ported to
 * Vitest on 2026-07-28 precisely so these checks run in CI (see ./helpers.ts for
 * the history). Adding new guards back into a gitignored file would recreate the
 * problem that port fixed.
 *
 * The three behaviours the build asked for are here — asset present renders the
 * video, asset absent falls back to the labelled placeholder, reduced motion
 * shows the poster and never autoplays — plus the guards that keep the two
 * expensive mistakes in this area impossible: video bytes reaching the JS
 * bundle, and a src/poster path that no committed file answers.
 */

import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { describe, it, expect } from "vitest";

import { BentoCell } from "../components/BentoCell";
import { TileVideo } from "../components/TileVideo";
import { UseCaseBento } from "../components/UseCaseBento";
import {
  USE_CASES,
  getUseCase,
  type TileMedia,
} from "../components/UseCaseModal/useCaseContent";
import { count } from "./helpers";

const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));

function tileMediaOf(slug: string): TileMedia {
  const media = getUseCase(slug)?.tileMedia;
  if (!media) throw new Error(`expected tileMedia for "${slug}"`);
  return media;
}

/* Wired deliberately, and campaigns deliberately is not — pinned as an exact
   set so neither a new tile nor a quietly-enabled campaigns slips through. */
const WIRED = ["product-ui", "game-ui", "websites", "automotive", "film-tv-broadcast"];

const bento = renderToString(<UseCaseBento />);

/* ───────────────────────────────────────────────────────────────────────── */
describe("which cells carry tile media", () => {
  it("exactly the five wired use cases", () => {
    const wired = USE_CASES.filter((c) => c.tileMedia).map((c) => c.slug);
    expect(wired).toEqual(WIRED);
  });

  /* Not an oversight. The clip is Spotify Wrapped, which would reverse the
     2026-07-26 Strava re-anchor that exists to keep Spotify material inside
     CaseStudies. Asserted so re-enabling it has to be a deliberate edit here. */
  it("campaigns deliberately has none", () => {
    expect(getUseCase("campaigns")?.tileMedia).toBe(undefined);
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("asset present → tile video renders", () => {
  it("five tiles render a video element", () => {
    expect(count(bento, /<video/g)).toBe(WIRED.length);
  });

  it("each wired cell renders its own src", () => {
    /* Paired with the cell it sits in, so a clip cannot land on the wrong
       use case — the CaseStudies poster-mapping guard, applied here. */
    const posters = [...bento.matchAll(/<video[^>]*poster="([^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(posters).toEqual(
      WIRED.map(
        (slug) =>
          `/video/use-cases/posters/${slug === "film-tv-broadcast" ? "film-tv" : slug}.avif`,
      ),
    );
  });

  it("autoplay, muted, loop, playsInline, preload=metadata", () => {
    const tags = [...bento.matchAll(/<video[^>]*>/g)].map((m) => m[0]);
    expect(tags).toHaveLength(WIRED.length);
    for (const tag of tags) {
      expect({
        autoplay: tag.includes("autoplay"),
        muted: tag.includes("muted"),
        loop: tag.includes("loop"),
        playsInline: tag.includes('playsinline=""') || tag.includes("playsInline"),
        preload: tag.includes('preload="metadata"'),
      }).toEqual({
        autoplay: true,
        muted: true,
        loop: true,
        playsInline: true,
        preload: true,
      });
    }
  });

  /* THE LAZY GUARANTEE, asserted on markup rather than trusted: `src` is set
     imperatively once the IntersectionObserver fires, so a server-rendered (or
     pre-hydration) video has a poster and has requested nothing. */
  it("no src attribute before the observer fires", () => {
    const tags = [...bento.matchAll(/<video[^>]*>/g)].map((m) => m[0]);
    expect(tags.filter((t) => /\ssrc=/.test(t))).toEqual([]);
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("asset absent → labelled MEDIA placeholder", () => {
  const withoutMedia = renderToString(
    <BentoCell eyebrow="CAMPAIGNS" title="No tile media" href="#" />,
  );

  it("renders the placeholder", () => {
    expect(withoutMedia.includes("bento-cell__placeholder")).toBe(true);
    expect(withoutMedia.includes("MEDIA")).toBe(true);
  });

  it("renders no video", () => {
    expect(withoutMedia.includes("<video")).toBe(false);
  });

  it("campaigns' cell in the real section still shows it", () => {
    /* Six cells, five videos — so exactly one placeholder survives. */
    expect(count(bento, /bento-cell__placeholder/g)).toBe(
      USE_CASES.length - WIRED.length,
    );
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("reduced motion → poster, never autoplay", () => {
  const still = renderToString(
    <TileVideo media={tileMediaOf("product-ui")} reducedMotion />,
  );

  it("no video element at all", () => {
    /* Not a paused <video>: an <img> means the .mp4 is never even a candidate
       for fetching, which `preload` alone could not guarantee. */
    expect(still.includes("<video")).toBe(false);
    expect(still.includes("autoplay")).toBe(false);
  });

  it("renders the poster as an image", () => {
    expect(still).toContain('src="/video/use-cases/posters/product-ui.avif"');
  });

  it("marks the still without promising playback", () => {
    /* A ▸ would offer an interaction the cell cannot deliver — clicking opens
       the modal and never plays the tile. */
    expect(still).toContain("MOTION PAUSED");
    expect(still.includes("▶")).toBe(false);
    expect(still.includes("▸")).toBe(false);
  });

  it('flags the state as data-motion="reduced"', () => {
    expect(still).toContain('data-motion="reduced"');
  });

  it("full motion is the other branch", () => {
    const moving = renderToString(
      <TileVideo media={tileMediaOf("product-ui")} reducedMotion={false} />,
    );
    expect(moving).toContain('data-motion="full"');
    expect(moving).toContain("<video");
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("committed bytes answer every path", () => {
  /* The check nothing else in the build performs: tsc never opens an .mp4, vite
     copies public/ verbatim without validating it, and a render test is happy
     with any string. Same reasoning as check:assets for .riv files. */
  for (const slug of WIRED) {
    const media = tileMediaOf(slug);
    for (const [kind, path] of [
      ["src", media.src],
      ["poster", media.poster],
    ] as const) {
      it(`${slug} ${kind}: ${path} exists and is non-empty`, () => {
        const onDisk = `${PUBLIC}${path}`;
        expect(existsSync(onDisk)).toBe(true);
        expect(statSync(onDisk).size).toBeGreaterThan(1024);
      });
    }
  }
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("weight stays out of the JS bundle", () => {
  /* A literal public/ path is copied verbatim and fetched by the browser. An
     import would route the bytes through Vite's asset pipeline and put a hashed
     URL in the chunk — which is how 3.3 MB of video would end up shipped as
     part of the app. Vite rewrites imported assets to /assets/<name>-<hash>,
     so an absent hash is the proof these were never imported. */
  for (const slug of WIRED) {
    const media = tileMediaOf(slug);
    it(`${slug} references public/ paths, not bundled assets`, () => {
      for (const path of [media.src, media.poster]) {
        expect(path.startsWith("/video/use-cases/")).toBe(true);
        expect(/-[A-Za-z0-9_-]{8}\.(mp4|avif)$/.test(path)).toBe(false);
      }
    });
  }
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("crop + anchor pinned as an exact set", () => {
  /* Every slot has a different aspect ratio from its source, so these two
     values decide what survives the cover crop. Pinned the way the case-study
     poster anchors are: chosen by looking at candidates, then frozen. */
  it("anchors", () => {
    const anchors = Object.fromEntries(
      WIRED.map((slug) => [slug, tileMediaOf(slug).objectPosition ?? null]),
    );
    expect(anchors).toEqual({
      "product-ui": null,
      "game-ui": null,
      /* Biased down so the crop comes off Figma's nav, not the canvas demo. */
      websites: "50% 60%",
      automotive: null,
      "film-tv-broadcast": null,
    });
  });

  it("only film-tv is cropped, and by the measured amount", () => {
    const cropped = Object.fromEntries(
      WIRED.map((slug) => [slug, tileMediaOf(slug).crop ?? null]),
    );
    expect(cropped).toEqual({
      "product-ui": null,
      "game-ui": null,
      websites: null,
      automotive: null,
      /* The source is a browser-window capture: YouTube chrome occupies ~7.2%
         of the top and ~6.0% of the bottom. These add a safety margin. */
      "film-tv-broadcast": { top: 0.075, bottom: 0.065 },
    });
  });

  it("the crop closes over the trim rather than leaving a gap", () => {
    const crop = tileMediaOf("film-tv-broadcast").crop;
    if (!crop) throw new Error("film-tv should be cropped");
    const zoom = 1 / (1 - crop.top - crop.bottom);
    /* Zoom must at least cover what the trim removes, or the chrome comes back
       at the edges instead of leaving the box. */
    expect(zoom).toBeGreaterThan(1);
    expect(zoom).toBeCloseTo(1.1628, 3);

    const html = renderToString(
      <TileVideo media={tileMediaOf("film-tv-broadcast")} reducedMotion={false} />,
    );
    expect(html).toContain("--tile-zoom:1.1628");
    /* Shifted UP, because more is trimmed off the top than the bottom. */
    expect(html).toContain("--tile-shift:-0.581%");
  });

  it("an uncropped clip carries no transform variables", () => {
    const html = renderToString(
      <TileVideo media={tileMediaOf("game-ui")} reducedMotion={false} />,
    );
    expect(html.includes("--tile-zoom")).toBe(false);
    expect(html.includes("--tile-shift")).toBe(false);
  });
});

/* ───────────────────────────────────────────────────────────────────────── */
describe("accessibility: the tile is illustration, not a label", () => {
  /* Load-bearing: an aria-label anywhere in the cell would REPLACE the name
     computed from its own eyebrow/title/description text (WCAG 2.5.3 Label in
     Name). modalSection.test.tsx asserts the whole section carries none; this
     pins the reason it stays true once media is in the markup. */
  it("no aria-label introduced by tile media", () => {
    expect(bento.includes("aria-label")).toBe(false);
  });

  it("tile media is aria-hidden", () => {
    expect(count(bento, /class="tile-video"[^>]*aria-hidden="true"/g)).toBe(
      WIRED.length,
    );
  });

  it("the reduced-motion poster has an empty alt", () => {
    const still = renderToString(
      <TileVideo media={tileMediaOf("websites")} reducedMotion />,
    );
    expect(still).toContain('alt=""');
  });
});
