// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { text } from "./helpers";
import {
  RIVE_MARK_PATH,
  RIVE_MARK_VIEWBOX,
  RIVE_WORDMARK_R_PATH,
} from "../components/riveWordmark";

/**
 * The nav home link — Rive's R mark, replacing the bold "RIVE" text.
 *
 * The Rive runtime is mocked because the nav's CTA mounts a canvas; none of
 * these assertions are about it.
 */

vi.mock("@rive-app/react-webgl2", () => ({
  useRive: () => ({ rive: null, RiveComponent: () => null }),
  useStateMachineInput: () => null,
  Layout: class {},
  Fit: {},
  Alignment: {},
}));

const { Nav } = await import("../components/Nav");
const html = renderToString(<Nav />);

describe("the nav mark", () => {
  it("renders the R mark's geometry, not the word", () => {
    expect(html).toContain(RIVE_MARK_VIEWBOX);
    expect(html).toContain(RIVE_MARK_PATH.slice(0, 60));
    /* The literal that used to sit in the home link. Checked on the stripped
       text rather than the markup, so a future `<span>RIVE</span>` cannot slip
       past a substring test on the raw HTML. */
    expect(text(html).includes("RIVE")).toBe(false);
  });

  it("is a distinct drawing from the R inside the logotype", () => {
    /* riveWordmark.ts holds both, and they are not interchangeable: the
       wordmark's R is proportioned to sit beside I, V and E in a 275×50 box,
       while the mark is the heavier standalone glyph in 53×56. Rendering the
       wrong one would still look like an R, which is exactly why this is
       pinned. */
    expect(RIVE_MARK_PATH).not.toBe(RIVE_WORDMARK_R_PATH);
    expect(html).not.toContain(RIVE_WORDMARK_R_PATH);
  });

  it("names the link and hides the drawing from the accessibility tree", () => {
    /* The mark carries no text, so without a label the home link would announce
       as its href. The <svg> itself is decorative — the link's own name is the
       information — so announcing it too would say the brand twice. */
    expect(html).toContain('aria-label="Rive — home"');
    const mark = html.match(/<svg class="nav__mark"[^>]*>/)?.[0] ?? "";
    expect(mark).toContain('aria-hidden="true"');
  });

  it("takes its colour from the token rather than the path", () => {
    /* `fill="currentColor"` is what lets Nav.css paint it --text-primary. A
       hardcoded fill would survive a theme change unnoticed. */
    const mark = html.match(/<svg class="nav__mark"[^>]*>/)?.[0] ?? "";
    expect(mark).toContain('fill="currentColor"');
  });

  it("keeps the even-odd rule the mark is drawn against", () => {
    /* The counter between the R's bowl and stem is a hole only under evenodd.
       Without it the glyph fills solid and reads as a blob at 26px. */
    expect(html).toContain('fill-rule="evenodd"');
    expect(html).toContain('clip-rule="evenodd"');
  });

  it("still points at the home route", () => {
    expect(html).toMatch(/<a class="nav__wordmark" href="\/"/);
  });
});
