#!/usr/bin/env node
/**
 * Downloads the self-hosted webfonts. Run when a face is added or a family
 * updated; the outputs are committed.
 *
 *   npm run fonts:fetch
 *
 * WHY SELF-HOSTED: the same reason the Rive wasm is. This site went to the
 * trouble of committing 4.8 MB of wasm so a CDN incident could not empty every
 * animated surface — and then loaded its display typeface from Google's CDN, so
 * the same incident would have left the page rendering in Times New Roman. The
 * guard had a hole shaped exactly like the thing it was built for. Measured on
 * the first deployment: FCP 1216 ms against DOM-interactive at 190 ms, i.e. text
 * paint was waiting on a third-party round trip.
 *
 * WHICH FACES, AND WHY THEY ARE NOT THE ONES GOOGLE WAS ASKED FOR. The shipped
 * <link> requested Tomorrow 400/500/700, Inter 400/500/700, JetBrains Mono
 * 400/500. Walking every text-bearing element on / and /showcase and reading the
 * COMPUTED (family, weight) showed that list was wrong in both directions:
 *
 *   · Inter 600 is used (CaseStudies.css:158) and was never requested, so the
 *     browser has been synthesising it by smearing Inter 500 since that section
 *     shipped. It is a real face here now.
 *   · JetBrains Mono 500 was downloaded on every visit and never drawn once.
 *
 * LICENSING: all three families are SIL Open Font License, confirmed against
 * OFL.txt in github.com/google/fonts rather than from memory. OFL permits
 * redistribution, which is what self-hosting is. The licence text and the
 * copyright line ship next to the binaries in public/fonts/.
 *
 * LATIN SUBSET ONLY. Google serves one @font-face per unicode-range; this takes
 * the block commented `latin` and ignores latin-ext/cyrillic/greek/vietnamese.
 * The site is English-only and the full set would multiply the payload for
 * glyphs nothing renders.
 *
 * The woff2 magic is checked on every download — a 200 that is actually an HTML
 * error page would otherwise be committed as a font and fail silently in the
 * browser, which is the AVIF trap in a different costume.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/fonts");
const CSS_OUT = join(ROOT, "src/fonts.css");

/* A modern Chrome UA, so Google serves woff2 rather than ttf. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** family → { google, slug, cssName, weights[] } */
const FAMILIES = [
  { google: "Tomorrow", slug: "tomorrow", cssName: "Tomorrow", ofl: "tomorrow", weights: [400, 500, 700] },
  { google: "Inter", slug: "inter", cssName: "Inter", ofl: "inter", weights: [400, 500, 600, 700] },
  { google: "JetBrains Mono", slug: "jetbrains-mono", cssName: "JetBrains Mono", ofl: "jetbrainsmono", weights: [400] },
];

mkdirSync(OUT, { recursive: true });

const get = async (url, asText = true) => {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return asText ? res.text() : Buffer.from(await res.arrayBuffer());
};

let total = 0;
const faces = [];

for (const fam of FAMILIES) {
  /* One request per weight keeps the parse unambiguous — a combined request
     interleaves families and makes "which block is this" a guess. */
  for (const weight of fam.weights) {
    const api =
      `https://fonts.googleapis.com/css2?family=` +
      `${encodeURIComponent(fam.google).replace(/%20/g, "+")}:wght@${weight}&display=swap`;
    const css = await get(api);

    /* Google emits `/* latin *\/` immediately before the block it labels. */
    const blocks = css.split("/*").map((b) => "/*" + b);
    const latin = blocks.find((b) => /^\/\*\s*latin\s*\*\//.test(b));
    if (!latin) throw new Error(`${fam.google} ${weight}: no latin block in the css2 response`);
    const url = latin.match(/src:\s*url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!url) throw new Error(`${fam.google} ${weight}: no woff2 url in the latin block`);
    const range = latin.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim();

    const buf = await get(url, false);
    /* wOF2 magic. A 200 carrying an error page would otherwise be committed as
       a font and fail only in the browser. */
    if (buf.subarray(0, 4).toString("ascii") !== "wOF2")
      throw new Error(`${fam.google} ${weight}: downloaded bytes are not woff2 (magic ${buf.subarray(0, 4).toString("ascii")})`);

    const file = `${fam.slug}-${weight}.woff2`;
    writeFileSync(join(OUT, file), buf);
    total += buf.length;
    faces.push({ family: fam.cssName, weight, file, range, bytes: buf.length });
    console.log(`  ${fam.cssName.padEnd(15)} ${weight}  ${String((buf.length / 1024).toFixed(1)).padStart(6)} kB  ${file}`);
  }

  /* The licence travels with the binary. */
  const ofl = await get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${fam.ofl}/OFL.txt`);
  writeFileSync(join(OUT, `OFL-${fam.slug}.txt`), ofl);
}

/* Generated stylesheet. Hand-editing this is how it drifts from the binaries. */
const css =
  `/* GENERATED by scripts/fetch-fonts.mjs — do not hand-edit.\n` +
  ` *   npm run fonts:fetch\n` +
  ` *\n` +
  ` * Self-hosted so no third party can empty the page's typography — the same\n` +
  ` * argument that put the Rive wasm in public/rive/runtime/. All three families\n` +
  ` * are SIL OFL (texts alongside the binaries in public/fonts/).\n` +
  ` *\n` +
  ` * font-display: swap on every face — text paints immediately in the fallback\n` +
  ` * and re-renders when the face lands, rather than holding the page blank.\n` +
  ` */\n\n` +
  faces
    .map(
      (f) =>
        `@font-face {\n` +
        `  font-family: "${f.family}";\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${f.weight};\n` +
        `  font-display: swap;\n` +
        `  src: url("/fonts/${f.file}") format("woff2");\n` +
        (f.range ? `  unicode-range: ${f.range};\n` : "") +
        `}\n`,
    )
    .join("\n");
writeFileSync(CSS_OUT, css);

console.log(
  `\n  ${faces.length} faces, ${(total / 1024).toFixed(1)} kB total → public/fonts/\n` +
    `  wrote src/fonts.css and 3 OFL texts`,
);
