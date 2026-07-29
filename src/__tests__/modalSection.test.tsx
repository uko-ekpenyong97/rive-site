/**
 * Use-case section render smoke — ported from `.context/modal-smoke.mjs`.
 *
 * Covers the escape valve, the content model's completeness invariant, the
 * closed-modal section render, the WCAG 2.5.3 accessible-name pins, and the
 * per-use-case sheet composition.
 */
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";

import { UseCaseBento } from "../components/UseCaseBento";
import { ModalCTA } from "../components/UseCaseModal/ModalCTA";
import { ModalHero } from "../components/UseCaseModal/ModalHero";
import { ModalSheet } from "../components/UseCaseModal/ModalSheet";
import { ProofReel } from "../components/UseCaseModal/ProofReel";
import { RuntimeChips } from "../components/UseCaseModal/RuntimeChips";
import {
  USE_CASES,
  getUseCase,
  EDITOR_URL,
  type UseCaseContent,
} from "../components/UseCaseModal/useCaseContent";
import { text, count } from "./helpers";

/**
 * `getUseCase` is intentionally `| undefined` (a bad slug is a bug, not a
 * state). Throwing here keeps the assertions below free of optional chaining
 * without reaching for `any` or `!`.
 */
function useCase(slug: string): UseCaseContent {
  const found = getUseCase(slug);
  if (!found) throw new Error(`no use case for slug "${slug}"`);
  return found;
}

const cases = USE_CASES;

describe("escape valve (optional pageHref)", () => {
  const gameUi = useCase("game-ui");
  const campaigns = useCase("campaigns");

  const withLink = renderToString(
    <ModalCTA
      pageHref={gameUi.pageHref}
      label={gameUi.name}
      editorHref={EDITOR_URL}
    />,
  );
  const noLink = renderToString(
    <ModalCTA
      pageHref={campaigns.pageHref}
      label={campaigns.name}
      editorHref={EDITOR_URL}
    />,
  );

  it("campaigns has no pageHref", () => {
    expect(campaigns.pageHref).toBe(undefined);
  });

  it("game-ui renders the escape valve", () => {
    expect(withLink.includes("Everything about")).toBe(true);
  });

  it("campaigns omits the escape valve", () => {
    expect(noLink.includes("Everything about")).toBe(false);
  });

  it("campaigns still offers Get started", () => {
    expect(noLink.includes("Get started")).toBe(true);
  });

  it("every pageHref is a real https://rive.app URL (no # placeholders)", () => {
    const httpsAll = USE_CASES.map((c) => c.pageHref)
      .filter((href): href is string => Boolean(href))
      .every((href) => href.startsWith("https://rive.app/"));
    expect(httpsAll).toBe(true);
  });
});

describe("content model", () => {
  it("every entry has slug/name/claim/eyebrow/proof (hero optional)", () => {
    const missing = cases.filter(
      (c) => !c.slug || !c.name || !c.claim || !c.eyebrow || !c.proof?.length,
    );
    expect(missing.map((m) => m.slug)).toEqual([]);
  });
});

/* Rendered once at module scope: both this describe and the accessible-name
   describe below read the same closed-section markup. */
const bento = renderToString(<UseCaseBento />);

describe("section render (modal closed)", () => {
  it("UseCaseBento", () => {
    expect(bento.length).toBeGreaterThan(0);
  });

  // The closed modal must render nothing into the tree.
  it("no overlay markup while closed", () => {
    expect(bento.includes("modal-overlay")).toBe(false);
  });

  it(`${cases.length} cells carry the + expand affordance`, () => {
    expect(count(bento, /bento-cell__expand/g)).toBe(cases.length);
  });

  it(`${cases.length} cells announce aria-haspopup="dialog"`, () => {
    expect(count(bento, /aria-haspopup="dialog"/g)).toBe(cases.length);
  });
});

describe("accessible name (WCAG 2.5.3 Label in Name)", () => {
  // aria-label would REPLACE the name computed from the cell's own text.
  it("no aria-label override on cells", () => {
    expect(bento.includes("aria-label")).toBe(false);
  });

  // Approximate the computed name by stripping tags from each cell's markup.
  // (React escapes text content, so `text()` decodes before comparing to the
  // source strings.)
  const cellHtml = bento.split('<a class="bento-cell"').slice(1);

  /* The visible title must be IN the accessible name — that is the whole
     point of 2.5.3. Pinned per cell so a retitle cannot drift silently. */
  const CELL_TITLES: Record<string, string> = {
    "product-ui": "Interfaces that respond in real time",
    "game-ui": "Menus and HUDs at engine speed",
    websites: "Sites that respond to every visitor",
    automotive: "Dashboards at 120fps",
    "film-tv-broadcast": "Live graphics that never miss",
    campaigns: "Wrapped moments, made personal",
  };

  for (const [i, expected] of cases.entries()) {
    it(`${expected.slug}: title + eyebrow + hint in the name`, () => {
      const name = text(cellHtml[i] ?? "");
      const okHint = name.includes(`Explore ${expected.name}`);
      const okEyebrow = name.includes(expected.eyebrow);
      const wantTitle = CELL_TITLES[expected.slug];
      const okTitle = wantTitle ? name.includes(wantTitle) : false;
      expect({ okHint, okEyebrow, okTitle }).toEqual({
        okHint: true,
        okEyebrow: true,
        okTitle: true,
      });
    });
  }
});

describe("sheet content render (per use case)", () => {
  for (const entry of cases) {
    describe(`sheet: ${entry.slug}`, () => {
      const html = renderToString(
        <ModalSheet eyebrow={entry.eyebrow} title={entry.claim} onClose={() => {}}>
          {/* Mirrors UseCaseModal: a heroless lite modal renders no slot. */}
          {entry.hero ? <ModalHero hero={entry.hero} /> : null}
          <ProofReel proof={entry.proof} quote={entry.quote} />
          <RuntimeChips runtimes={entry.runtimes} label={entry.slug} />
          <ModalCTA
            pageHref={entry.pageHref}
            label={entry.name}
            editorHref={EDITOR_URL}
          />
        </ModalSheet>,
      );

      it(`sheet: ${entry.slug}`, () => {
        expect(html.length).toBeGreaterThan(0);
      });

      it('role="dialog"', () => {
        expect(html.includes('role="dialog"')).toBe(true);
      });

      it("aria-modal", () => {
        expect(html.includes('aria-modal="true"')).toBe(true);
      });

      it("close button", () => {
        expect(html.includes("modal-sheet__close")).toBe(true);
      });

      /* Hero slot iff the entry has a hero — Campaigns is heroless by design. */
      it("hero slot iff data", () => {
        expect(html.includes("modal-hero")).toBe(!!entry.hero);
      });

      it("proof cards", () => {
        expect(html.includes("proof-reel__card")).toBe(true);
      });

      it("runtime chips", () => {
        expect(html.includes("runtime-chips__chip")).toBe(true);
      });

      it("CTA", () => {
        expect(html.includes("modal-cta")).toBe(true);
      });

      it("quote iff data", () => {
        expect(html.includes("proof-reel__quote")).toBe(!!entry.quote);
      });
    });
  }
});
