#!/usr/bin/env node
/**
 * Converts a source image into a case-study poster: AVIF, at the house weight
 * class, pixel-verified before anything is written to disk.
 *
 * WHY NOT `sips`: it writes AVIF files that report correct dimensions, read back
 * cleanly under `sips -g`, and resolve `img.decode()` — while painting fully
 * transparent in Chrome. That combination is invisible to every check the build
 * has, and it very nearly shipped a blank Spotify poster. `sharp` encodes AVIF
 * Chrome will actually paint, so it is a real devDependency rather than a
 * one-off `--no-save` install.
 *
 * The verification is the point of this script, not a formality: it encodes to a
 * BUFFER, draws that buffer in a real browser, reads the pixels back, and only
 * writes the file if it is non-blank. A conversion that produces an invisible
 * image fails loudly instead of landing in git.
 *
 * Usage:
 *   node scripts/convert-poster.mjs <input> <output.avif> [--quality 60]
 *
 *   npm run convert:poster -- ~/Downloads/thing.jpg \
 *     src/assets/case-studies/thing-poster.avif
 *
 * Then choose the crop anchor with `npm run analyze:crop`, and pin it in
 * src/__tests__/caseStudies.test.tsx.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import sharp from "sharp";
import { verifyPixels } from "./lib/verify-pixels.mjs";

/* The four shipped posters run 14–135 kB. The ceiling is the widest of them
   (linkedin); anything heavier is out of class for a decorative panel image. */
const MAX_BYTES = 135_000;
/* The slot renders up to 1248 CSS px, so 2x covers every display we target. */
const MAX_WIDTH = 2496;
const DEFAULT_QUALITY = 60;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const positional = args.filter(
  (a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"),
);
const [input, output] = positional;
const quality = Number(flag("--quality", String(DEFAULT_QUALITY)));

if (!input || !output) {
  console.error(
    "usage: node scripts/convert-poster.mjs <input> <output.avif> [--quality 60]",
  );
  process.exit(2);
}
if (!output.endsWith(".avif")) {
  console.error("output must end in .avif");
  process.exit(2);
}

const src = sharp(readFileSync(input));
const meta = await src.metadata();
console.log(`${basename(input)}  ${meta.width}x${meta.height}  ${meta.format}`);

const needsResize = meta.width > MAX_WIDTH;
if (needsResize) {
  console.log(`  resizing ${meta.width} → ${MAX_WIDTH} (2x the 1248px slot)`);
}

async function encode(q) {
  let pipe = sharp(readFileSync(input));
  if (needsResize) pipe = pipe.resize({ width: MAX_WIDTH });
  return pipe.avif({ quality: q }).toBuffer();
}

/* Start at the requested quality and step down only if the file is out of
   class. Stepping is reported, never silent — a poster that quietly lost
   quality to hit a budget is something the next person should see in the log. */
let q = quality;
let buffer = await encode(q);
while (buffer.byteLength > MAX_BYTES && q > 25) {
  console.log(
    `  ${buffer.byteLength.toLocaleString()} B over the ${MAX_BYTES.toLocaleString()} B ceiling at q=${q}, retrying at q=${q - 10}`,
  );
  q -= 10;
  buffer = await encode(q);
}

if (buffer.byteLength > MAX_BYTES) {
  console.error(
    `\n✗ cannot reach ${MAX_BYTES.toLocaleString()} B without dropping below q=25. Crop or downscale the source first.`,
  );
  process.exit(1);
}

/* The check that exists because sips fooled every other one. */
const [result] = await verifyPixels([
  { label: basename(output), buffer, mime: "image/avif" },
]);

console.log(
  `  encoded q=${q}  ${buffer.byteLength.toLocaleString()} B  ${result.width}x${result.height}` +
    `  meanLuma=${result.meanLuma}  meanAlpha=${result.meanAlpha}`,
);

if (result.blank) {
  console.error(
    `\n✗ REFUSING TO WRITE: the encoded image draws blank in Chrome (meanLuma ${result.meanLuma}, meanAlpha ${result.meanAlpha}).\n` +
      `  It would be invisible on the site while passing every dimension and decode check.`,
  );
  process.exit(1);
}

writeFileSync(output, buffer);
console.log(`\n✓ wrote ${output}`);
console.log(`  next: npm run analyze:crop ${output}  — then pin the anchor in`);
console.log(`        src/__tests__/caseStudies.test.tsx`);
