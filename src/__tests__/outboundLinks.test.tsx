// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import AudienceRails from "../components/AudienceRails";
import DeveloperZone from "../components/DeveloperZone";

/**
 * Outbound destinations — the exact URLs, pinned.
 *
 * WHY EXACT AND NOT A PATTERN: a docs reorg is the failure mode here, and it is
 * silent. `rive.app/docs/runtimes/ios` looks every bit as plausible as
 * `/apple`, and `/runtimes/unity` as plausible as `/game-runtimes/unity` — both
 * of those are wrong, and both would sail past any regex that only checked the
 * host. A visitor finds out; nothing in the build does. So the pin is the
 * literal string, and moving a page shows up as a test diff someone has to
 * read rather than a 404 nobody sees.
 *
 * Verified 200 (following redirects) on 2026-08-01. This suite cannot re-check
 * that — it makes no network calls, deliberately, because a test that hits the
 * live docs site would fail on their outage rather than on our defect.
 */

const RAIL_LINKS: Record<string, string> = {
  "Start with artboards →":
    "https://rive.app/docs/editor/fundamentals/artboards",
  "See animation tools →":
    "https://rive.app/docs/editor/animate-mode/animate-mode-overview",
  "Read the docs →": "https://rive.app/docs/runtimes/getting-started",
};

const RUNTIME_CHIPS: Record<string, string> = {
  WEB: "https://rive.app/docs/runtimes/web",
  REACT: "https://rive.app/docs/runtimes/react",
  /* Rive publishes the iOS runtime as "Apple". */
  IOS: "https://rive.app/docs/runtimes/apple",
  ANDROID: "https://rive.app/docs/runtimes/android",
  FLUTTER: "https://rive.app/docs/runtimes/flutter",
  /* Both game runtimes live under /game-runtimes/, not /runtimes/. */
  UNITY: "https://rive.app/docs/game-runtimes/unity",
  UNREAL: "https://rive.app/docs/game-runtimes/unreal",
  /* No docs subpage exists for C++; the repo is the reference. */
  "C++": "https://github.com/rive-app/rive-cpp",
};

const ZONE_LINKS: Record<string, string> = {
  "Read the docs →": "https://rive.app/docs",
  /* Deliberately NOT github.com/rive-app: an org page cannot be starred, so the
     org URL would not deliver what the label promises. */
  "Star on GitHub →": "https://github.com/rive-app/rive-runtime",
};

/** `<a ...>label</a>` → its href, for an exact label. */
function hrefFor(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`<a\\b[^>]*>\\s*${escaped}\\s*</a>`, "g");
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/href="([^"]*)"/)?.[1] ?? null;
}

const railsHtml = renderToString(<AudienceRails />);
const zoneHtml = renderToString(<DeveloperZone />);

describe("AudienceRails — the three craft links", () => {
  for (const [label, href] of Object.entries(RAIL_LINKS)) {
    it(`"${label}" → ${href}`, () => {
      expect(hrefFor(railsHtml, label)).toBe(href);
    });
  }

  /* The animator rail shipped as href="#" behind a live-looking label. A dead
     link is worse than a missing one: it looks answered. */
  it("no rail is left pointing at #", () => {
    expect(railsHtml).not.toMatch(/href="#"/);
  });

  it("does not still point the designer rail at the editor app", () => {
    /* The label moved with the destination — "Explore the editor" promised the
       app and would have delivered docs. If editor.rive.app comes back here,
       the label has to come back with it. */
    expect(railsHtml).not.toContain("editor.rive.app");
  });
});

describe("DeveloperZone — runtime chips", () => {
  it("renders one chip per runtime, in order", () => {
    const labels = [
      ...zoneHtml.matchAll(/class="developer-zone__pill"[^>]*>([^<]+)</g),
    ].map((m) => m[1].trim());
    expect(labels).toEqual(Object.keys(RUNTIME_CHIPS));
  });

  for (const [label, href] of Object.entries(RUNTIME_CHIPS)) {
    it(`${label} → ${href}`, () => {
      expect(hrefFor(zoneHtml, label)).toBe(href);
    });
  }

  /* They were presentational <span>s. If they regress to spans they render
     identically and stop being reachable at all — invisible in a screenshot,
     total for a keyboard. */
  it("chips are anchors, not spans", () => {
    expect(zoneHtml).not.toMatch(/<span[^>]*class="developer-zone__pill"/);
    const anchors = zoneHtml.match(/<a[^>]*class="developer-zone__pill"/g);
    expect(anchors).toHaveLength(8);
  });

  for (const [label, href] of Object.entries(ZONE_LINKS)) {
    it(`"${label}" → ${href}`, () => {
      expect(hrefFor(zoneHtml, label)).toBe(href);
    });
  }
});

describe("every external link carries the full rel", () => {
  /* One convention in the tree, the stricter one. The repo carried both
     `noopener` and `noopener noreferrer` until 2026-08-01. */
  it("all 11 new destinations open in a new tab with noopener noreferrer", () => {
    const all = [...Object.values(RAIL_LINKS), ...Object.values(RUNTIME_CHIPS)];
    expect(all).toHaveLength(11);

    for (const html of [railsHtml, zoneHtml]) {
      const anchors = html.match(/<a\b[^>]*>/g) ?? [];
      const external = anchors.filter((a) => /href="https?:\/\//.test(a));
      expect(external.length).toBeGreaterThan(0);
      for (const a of external) {
        expect(a).toContain('target="_blank"');
        expect(a).toContain('rel="noopener noreferrer"');
      }
    }
  });

  it("no bare rel=\"noopener\" survives anywhere in these sections", () => {
    for (const html of [railsHtml, zoneHtml]) {
      expect(html).not.toMatch(/rel="noopener"/);
    }
  });
});
