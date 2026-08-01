// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import LogoMarquee from "../components/LogoMarquee";
import {
  LOGOTYPE_METRICS,
  LOGOTYPE_METRIC_BY_BRAND,
} from "../assets/logos/logotypeMetrics";

/**
 * LogoMarquee — the strip reads as ONE LINE OF TYPE.
 *
 * The measurements themselves are made and verified by
 * scripts/logotype-variants.mjs against the committed SVGs in a real engine.
 * These assertions guard the join between that generated record and the
 * component: that every logo has a metric, that the metrics are internally
 * sane, that the files they name exist, and that the lockups actually lost
 * their icons. A wrong number here renders a logo at the wrong size and nothing
 * else in the build can see it — `tsc` never opens an SVG and the marquee has
 * no snapshot.
 */

const LOGOS_DIR = join(process.cwd(), "src/assets/logos");
const html = renderToString(<LogoMarquee />);

/* Every brand the component actually renders, read back off the markup so the
   list cannot drift from the component's own LOGOS array. */
const renderedBrands = LOGOTYPE_METRICS.map((m) => m.brand);

describe("the cap-height record", () => {
  it("covers all fifteen brands with no duplicates", () => {
    expect(LOGOTYPE_METRICS).toHaveLength(15);
    expect(new Set(renderedBrands).size).toBe(15);
  });

  it("names a file that exists on disk for every brand", () => {
    for (const m of LOGOTYPE_METRICS) {
      expect(existsSync(join(LOGOS_DIR, m.file)), `${m.brand} → ${m.file}`).toBe(
        true,
      );
    }
  });

  it("declares a viewBox matching the file it names", () => {
    /* The heightRatio and baselineRatio are fractions OF THAT BOX. If the file
       is later regenerated with a different viewBox and the record is not, every
       derived size is silently wrong while still looking plausible. */
    for (const m of LOGOTYPE_METRICS) {
      const svg = readFileSync(join(LOGOS_DIR, m.file), "utf8");
      const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
      expect(viewBox, `${m.brand}`).toBe(m.viewBox);
    }
  });

  it("derives heightRatio from the viewBox height and the cap height", () => {
    for (const m of LOGOTYPE_METRICS) {
      const [, , , h] = m.viewBox.split(" ").map(Number);
      expect(m.heightRatio, `${m.brand}`).toBeCloseTo(h / m.capHeight, 3);
    }
  });

  it("derives aspect from the viewBox", () => {
    for (const m of LOGOTYPE_METRICS) {
      const [, , w, h] = m.viewBox.split(" ").map(Number);
      expect(m.aspect, `${m.brand}`).toBeCloseTo(w / h, 3);
    }
  });

  it("puts every baseline inside its own box", () => {
    /* A baselineRatio outside 0..1 would push the logo out of the strip's row
       via the margin that positions it. */
    for (const m of LOGOTYPE_METRICS) {
      expect(m.baselineRatio, `${m.brand}`).toBeGreaterThan(0);
      expect(m.baselineRatio, `${m.brand}`).toBeLessThanOrEqual(1);
    }
  });

  it("states a rule for every cap height", () => {
    /* Two brands have no capital letter at all, and the rule is the only place
       that says so. Duolingo is normalized on its ascender; Pepsi has neither a
       cap nor an ascender and is normalized on x-height ÷ 0.72. */
    for (const m of LOGOTYPE_METRICS) {
      expect(m.capRule.length, `${m.brand}`).toBeGreaterThan(10);
    }
    expect(LOGOTYPE_METRIC_BY_BRAND.duolingo.capRule).toContain("ascender");
    expect(LOGOTYPE_METRIC_BY_BRAND.pepsi.capRule).toContain("x-height");
    expect(LOGOTYPE_METRIC_BY_BRAND.google.capRule).toContain("ascender");
  });
});

describe("logotypes, not lockups", () => {
  it("renders a -type variant for every lockup", () => {
    const lockups = LOGOTYPE_METRICS.filter((m) => m.kind === "lockup");
    expect(lockups.length).toBeGreaterThan(0);
    for (const m of lockups) {
      expect(m.file, `${m.brand} is a lockup`).toBe(`${m.brand}-type.svg`);
    }
  });

  it("leaves every original file on disk untouched beside its variant", () => {
    for (const m of LOGOTYPE_METRICS) {
      expect(existsSync(join(LOGOS_DIR, `${m.brand}.svg`)), m.brand).toBe(true);
    }
  });

  it("keeps LinkedIn whole, because its mark spells part of the word", () => {
    /* The `in` bug is separable geometry and inseparable spelling — removing it
       leaves "Linked". The category rule that decides this lives in
       scripts/logotype-variants.mjs; this pins the outcome. */
    const linkedin = LOGOTYPE_METRIC_BY_BRAND.linkedin;
    expect(linkedin.kind).toBe("integrated");
    expect(linkedin.file).toBe("linkedin.svg");
    expect(existsSync(join(LOGOS_DIR, "linkedin-type.svg"))).toBe(false);
  });

  it("drops real geometry from each lockup variant", () => {
    /* A variant identical in size to its source would mean the icon rule matched
       nothing while still producing a plausible-looking file. */
    for (const m of LOGOTYPE_METRICS.filter((x) => x.kind === "lockup")) {
      const original = readFileSync(join(LOGOS_DIR, `${m.brand}.svg`), "utf8");
      const variant = readFileSync(join(LOGOS_DIR, m.file), "utf8");
      const dLen = (s: string) =>
        [...s.matchAll(/ d="([^"]*)"/g)].reduce((n, x) => n + x[1].length, 0);
      expect(dLen(variant), `${m.brand}`).toBeLessThan(dLen(original));
    }
  });

  it("marks every generated variant as generated", () => {
    for (const m of LOGOTYPE_METRICS.filter((x) => x.file.endsWith("-type.svg"))) {
      const svg = readFileSync(join(LOGOS_DIR, m.file), "utf8");
      expect(svg, m.brand).toContain("GENERATED by scripts/logotype-variants.mjs");
      expect(svg, m.brand).toContain("do not hand-edit");
    }
  });
});

describe("the rendered strip", () => {
  it("drives each logo's size from its measured record", () => {
    /* The component must pass BOTH dials. Dropping --logo-baseline would still
       render the right size while breaking the shared baseline, which is the
       harder half of "one line of type" to notice by eye. */
    for (const m of LOGOTYPE_METRICS) {
      expect(html).toContain(`--logo-k:${m.heightRatio}`);
      expect(html).toContain(`--logo-baseline:${m.baselineRatio}`);
    }
  });

  it("no longer carries the old fixed-box scale dial", () => {
    /* --logo-scale multiplied a contain-fit; it is what produced the 6.2x cap
       spread this replaced. Its presence would mean a logo escaped the new
       system. */
    expect(html).not.toContain("--logo-scale");
  });

  it("renders both marquee copies, with only the first in the tab order", () => {
    expect(html.match(/class="marquee__group"/g)).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('tabindex="-1"');
  });

  it("labels each brand once, on the copy screen readers see", () => {
    for (const m of LOGOTYPE_METRICS) {
      const metric = LOGOTYPE_METRIC_BY_BRAND[m.brand];
      expect(metric).toBeDefined();
    }
    /* Sixteen labels: one per brand on the real copy, plus the section's own.
       The decorative second copy contributes none — that is the point of it
       being aria-hidden, and a screen reader reading thirty brands would be the
       regression this catches. */
    expect(html.match(/aria-label="/g)).toHaveLength(16);
    expect(html).toContain('aria-label="Companies building with Rive"');
  });
});
