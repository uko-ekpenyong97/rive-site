// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import AudienceRails from "../components/AudienceRails";
import DeveloperZone from "../components/DeveloperZone";
import RuntimeChips from "../components/UseCaseModal/RuntimeChips";
import { USE_CASES } from "../components/UseCaseModal/useCaseContent";
import { PLATFORM_DOCS, platformHref } from "../components/platformDocs";

/** DeveloperZone's own spelling for each shared platform id. */
const DEV_ZONE_LABEL: Record<string, string> = {
  web: "WEB",
  apple: "IOS",
  android: "ANDROID",
  flutter: "FLUTTER",
  unity: "UNITY",
  unreal: "UNREAL",
};

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

/**
 * The modals' "Runs on" chips. Pinned per modal AND per label, because the same
 * label appears in several modals and a per-label-only pin could not tell a
 * chip that moved from one that vanished.
 */
const MODAL_CHIPS: Record<string, Array<[string, string | null]>> = {
  "product-ui": [
    ["iOS", "https://rive.app/docs/runtimes/apple"],
    ["Android", "https://rive.app/docs/runtimes/android"],
    ["Flutter", "https://rive.app/docs/runtimes/flutter"],
    ["React Native", "https://rive.app/docs/runtimes/react-native"],
    ["Web", "https://rive.app/docs/runtimes/web"],
    ["Framer", "https://rive.app/docs/editor/embed-urls/framer-and-rive"],
    [
      "Webflow",
      "https://help.webflow.com/hc/en-us/articles/33961216978451-Embed-Rive-animations",
    ],
  ],
  "game-ui": [
    ["Unity", "https://rive.app/docs/game-runtimes/unity"],
    ["Unreal", "https://rive.app/docs/game-runtimes/unreal"],
    ["Defold", "https://rive.app/docs/game-runtimes/defold"],
    /* The category's practical answer is the C++ runtime — same map entry as
       DeveloperZone's C++ chip, not a second URL. */
    ["Custom engines", "https://github.com/rive-app/rive-cpp"],
  ],
  websites: [
    ["Web", "https://rive.app/docs/runtimes/web"],
    ["Framer", "https://rive.app/docs/editor/embed-urls/framer-and-rive"],
    [
      "Webflow",
      "https://help.webflow.com/hc/en-us/articles/33961216978451-Embed-Rive-animations",
    ],
  ],
  /* null = deliberately link-less. No canonical destination exists for the
     category, and an arbitrary pick would half-keep the label's promise. */
  automotive: [["Embedded devices", null]],
  "film-tv-broadcast": [
    ["Web", "https://rive.app/docs/runtimes/web"],
    ["Embedded devices", null],
  ],
  campaigns: [
    ["iOS", "https://rive.app/docs/runtimes/apple"],
    ["Android", "https://rive.app/docs/runtimes/android"],
    ["Web", "https://rive.app/docs/runtimes/web"],
  ],
};

describe("UseCaseModal — Runs on chips", () => {
  it("covers every modal, with no modal left unpinned", () => {
    expect(USE_CASES.map((c) => c.slug).sort()).toEqual(
      Object.keys(MODAL_CHIPS).sort(),
    );
  });

  it("pins 20 chips — 18 linked, 2 deliberately link-less", () => {
    const all = Object.values(MODAL_CHIPS).flat();
    expect(all).toHaveLength(20);
    expect(all.filter(([, href]) => href !== null)).toHaveLength(18);
    expect(all.filter(([, href]) => href === null)).toHaveLength(2);
  });

  for (const [slug, chips] of Object.entries(MODAL_CHIPS)) {
    const entry = USE_CASES.find((c) => c.slug === slug);

    it(`${slug}: chip labels and order`, () => {
      expect(entry).toBeDefined();
      expect(entry!.runtimes.map((r) => r.label)).toEqual(chips.map(([l]) => l));
    });

    for (const [label, href] of chips) {
      it(`${slug} · ${label} → ${href ?? "(no link, by decision)"}`, () => {
        const ref = entry!.runtimes.find((r) => r.label === label);
        expect(ref).toBeDefined();
        expect(platformHref(ref!)).toBe(href);
      });
    }

    it(`${slug}: renders each chip, anchors only where a destination exists`, () => {
      const html = renderToString(
        <RuntimeChips runtimes={entry!.runtimes} label={slug} />,
      );
      for (const [label, href] of chips) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const anchor = new RegExp(`<a\\b[^>]*>\\s*${escaped}\\s*</a>`).test(html);
        expect(anchor).toBe(href !== null);
        if (href) {
          expect(hrefFor(html, label)).toBe(href);
        } else {
          /* Not an anchor, and carrying no tabindex — a chip that cannot be
             followed must not be focusable, or the ring announces an
             interaction that does not exist. */
          const tag = html.match(
            new RegExp(`<(\\w+)[^>]*class="runtime-chips__chip"[^>]*>\\s*${escaped}`),
          )?.[1];
          expect(tag).toBe("span");
          expect(html).toMatch(
            new RegExp(`<span[^>]*data-static="true"[^>]*>\\s*${escaped}`),
          );
          expect(html).not.toMatch(/tabindex/i);
        }
      }
    });
  }

  it("every linked chip resolves through the shared map, not a literal", () => {
    /* If a URL is ever inlined in useCaseContent again, this fails: every
       linked ref must name a PLATFORM_DOCS key. */
    const ids = new Set(Object.keys(PLATFORM_DOCS));
    for (const c of USE_CASES) {
      for (const r of c.runtimes) {
        if (r.platform !== null) expect(ids.has(r.platform)).toBe(true);
      }
    }
  });

  it("shares its map with DeveloperZone rather than duplicating it", () => {
    /* The six platforms on both surfaces must resolve to one string each. */
    const shared = ["web", "apple", "android", "flutter", "unity", "unreal"] as const;
    for (const id of shared) {
      expect(PLATFORM_DOCS[id]).toBe(hrefFor(zoneHtml, DEV_ZONE_LABEL[id])!);
    }
  });
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
