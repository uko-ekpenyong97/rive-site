import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { ExpertsStrip } from "../components/ExpertsStrip";
import { text, count } from "./helpers";

/**
 * ExpertsStrip — the hire-the-network band.
 *
 * Every name, tagline and URL here is a real person's public listing, so these
 * guards are mostly about not misrepresenting anyone: the right link on the
 * right card, no invented specialties, and no photographs we hold no rights to.
 */

const html = renderToString(<ExpertsStrip />).replace(/<!--\s*-->/g, "");
const body = text(html);

/** The listing, in the order the section renders it. */
const EXPECTED: Array<[name: string, tagline: string, handle: string]> = [
  ["Javier Oliver", "Branding/UX-UI designer building creative experiences", "javier_oliver"],
  ["Katy Sander", "2D Animator", "katysanderitsme"],
  ["George Weatherhead", "I animate interactive, gamified worlds", "georgeweatherhead"],
  ["Leo Mazzei", "Motion & Interactivity | Rive Ambassador", "leomazzei"],
  ["Matthew Haar", "3D Animator", "matthew_haar_503t9n8f"],
  ["Radityo Nugroho", "Interaction Designer", "radityo_nugroho_u4aqwcg3"],
  ["Bartek Radziejewski", "Not boring: Apps, Web, Rive animations, Framer.", "bart_radz"],
  ["Ashley Best", "Interactive / Animation / Web Development / Sound Design", "ashleybest"],
  ["Emanuele Colombo", "Motion Designer", "emanuele_colombo_z1y8crrl"],
];

/* ── the roster ───────────────────────────────────────────────────────────── */

describe("the nine cards", () => {
  it("renders exactly nine", () => {
    expect(count(html, /experts-strip__card/g)).toBe(9);
    expect(count(html, /experts-strip__monogram/g)).toBe(9);
  });

  /* Pinned per person: a reorder that silently moved a tagline onto the wrong
     card would mislabel someone's profession on a live marketing page. */
  it.each(EXPECTED)("%s links to %s via contra.com/%s", (name, tagline, handle) => {
    const card = html
      .split('class="experts-strip__card"')
      .find((chunk) => chunk.includes(name));
    expect(card, `no card for ${name}`).toBeTruthy();
    expect(card).toContain(`https://contra.com/${handle}`);
    /* Decoded before comparing: React escapes the `&` in Leo's line to `&amp;`,
       so a raw-HTML substring check would miss a correct render. */
    expect(text(card!)).toContain(tagline);
  });

  it("points every card at a distinct contra.com profile", () => {
    const hrefs = [...html.matchAll(/href="(https:\/\/contra\.com\/[^"]+)"/g)].map(
      (m) => m[1],
    );
    /* Nine cards plus the network CTA. */
    expect(hrefs).toHaveLength(10);
    expect(new Set(hrefs).size).toBe(10);
    for (const href of hrefs) {
      expect(href).toMatch(/^https:\/\/contra\.com\/[\w.-]+$/);
    }
  });

  it("sends every link off-site safely", () => {
    expect(count(html, /target="_blank"/g)).toBe(10);
    /* `noopener noreferrer`, not bare `noopener` — the repo carried both
       spellings until 2026-08-01 and now carries only the stricter one.
       src/__tests__/outboundLinks.test.tsx enforces that site-wide. */
    expect(count(html, /rel="noopener noreferrer"/g)).toBe(10);
  });
});

/* ── the decisions ────────────────────────────────────────────────────────── */

describe("decisions that must not drift", () => {
  /* We hold no rights to nine people's likenesses, and a scraped avatar cannot
     be kept current. The monogram is the rights call, not a style preference. */
  it("uses no photographs at all", () => {
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/background-image/);
  });

  it("derives each monogram from the name", () => {
    const monograms = [
      ...html.matchAll(/experts-strip__monogram"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    expect(monograms).toEqual([
      "JO", "KS", "GW", "LM", "MH", "RN", "BR", "AB", "EC",
    ]);
  });

  /* THE AUTHOR-CARD ASSERTIONS WERE REMOVED ON PURPOSE (2026-07-29).
     This file used to pin the site author last and assert that card carried no
     modifier class, badge or ordering hint. The author card left the strip by
     owner decision — all nine are now other people — so there is no author
     position left to guard. Recorded rather than silently dropped, so nobody
     later reads the absence as an oversight and "restores" a pin for a card
     that no longer exists. The no-ranking property it protected still holds and
     is still covered: every card renders from the same template, and the
     monogram and href pins below would fail if any card were special-cased. */

  /* Contra shows an account MODE where a specialty would go — a profile reading
     "Hiring as an Individual" is describing its billing setup, not a discipline.
     That string reached this list once (Val Guerra, since replaced) and was
     caught then; this keeps it out generally rather than per person. */
  it("never prints a Contra account mode as a specialty", () => {
    for (const mode of ["Hiring as an Individual", "Top Independent", "Available"]) {
      expect(body).not.toContain(mode);
    }
  });

  /* A tagline that may truncate should spend its last characters on words. */
  it("strips emoji from every tagline", () => {
    const taglines = [
      ...html.matchAll(/experts-strip__tagline"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    expect(taglines).toHaveLength(9);
    for (const t of taglines) {
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    expect(taglines).toContain("I animate interactive, gamified worlds");
  });

  /* Javier's own profile says "creatives experiences." — repeating his typo
     verbatim would read as ours. */
  it("carries Javier's line corrected, not verbatim", () => {
    expect(body).toContain("building creative experiences");
    expect(body).not.toContain("creatives experiences");
  });

  it("keeps the full tagline reachable when it truncates", () => {
    const titled = count(html, /experts-strip__tagline"[^>]*title="/g);
    expect(titled).toBe(9);
  });
});

/* ── the section's job ────────────────────────────────────────────────────── */

describe("the band is procurement, not celebration", () => {
  it("asks the question the rest of the page does not", () => {
    expect(body).toContain("NEED IT BUILT?");
    expect(body).toContain("Hire someone who already knows Rive");
  });

  it("ends on the network, not on a single person", () => {
    expect(body).toContain("Browse all Rive Experts");
    expect(html).toContain('href="https://contra.com/rive"');
  });

  /* This is the one section where leaving the site IS the conversion. Anything
     that intercepts the click — a modal, a mailto capture, an internal detour —
     would be working against the only job it has. */
  it("intercepts nothing on the way out", () => {
    expect(html).not.toContain("mailto:");
    expect(html).not.toMatch(/modal|dialog/i);
    const internal = [...html.matchAll(/href="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((h) => !h.startsWith("https://contra.com/"));
    expect(internal).toEqual([]);
  });

  /* Names and taglines are real people's public listings, so the accessible
     name has to be the visible text — never an aria-label standing in for it. */
  it("names each card by its own visible text", () => {
    expect(html).not.toMatch(/class="experts-strip__card"[^>]*aria-label/);
    /* The monogram is decorative: the name is right beside it in the same link. */
    expect(count(html, /experts-strip__monogram" aria-hidden="true"/g)).toBe(9);
  });
});
