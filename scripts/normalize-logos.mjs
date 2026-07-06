#!/usr/bin/env node
/**
 * normalize-logos.mjs — zero-dependency SVG normalizer for the logo marquee.
 *
 * Reads every SVG in src/assets/logos/raw/, normalizes it so its color is fully
 * CSS-driven (currentColor), and writes the result into src/assets/logos/.
 * Then regenerates manifest.json from every normalized SVG in that directory.
 *
 * Per-file transforms:
 *   - url(#gradient) fills/strokes  -> currentColor
 *   - <defs> and <style> blocks     -> stripped (no external refs survive)
 *   - clip-path="url(#…)"           -> removed (its def is gone; brand clips are
 *                                      just bounding boxes here)
 *   - class="…"                     -> removed (dead once <style> is gone)
 *   - any color fill/stroke         -> currentColor  (white handled below)
 *   - fill="none"/stroke="none"     -> kept
 *   - root width/height             -> stripped (viewBox kept; synthesized from
 *                                      width/height when absent)
 *   - root                          -> fill="currentColor"
 *
 * White-fill rule (logged per file):
 *   - file has BOTH white and non-white color fills -> white is a KNOCKOUT ->
 *     white maps to var(--surface-canvas, #000)
 *   - file's color fills are ENTIRELY white (a dark-mode variant) -> white IS
 *     the mark -> white maps to currentColor
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOGOS_DIR = join(HERE, "..", "src", "assets", "logos");
const RAW_DIR = join(LOGOS_DIR, "raw");
const KNOCKOUT = "var(--surface-canvas, #000)";

const isWhite = (raw) => {
  const v = raw.trim().toLowerCase().replace(/\s+/g, "");
  return (
    v === "#fff" ||
    v === "#ffffff" ||
    v === "#ffff" ||
    v === "#ffffffff" ||
    v === "white" ||
    v === "rgb(255,255,255)" ||
    v === "rgba(255,255,255,1)"
  );
};

// Is this fill/stroke value an actual paint color (vs none/currentColor/url)?
const isColor = (raw) => {
  const v = raw.trim().toLowerCase();
  if (!v || v === "none" || v === "currentcolor" || v === "transparent") return false;
  if (v.startsWith("url(")) return false;
  return true;
};

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? m[1] : null;
};
const num = (s) => (s == null ? null : parseFloat(String(s).replace(/[a-z%]+$/i, "")));

function normalize(svg, brand) {
  // 1. Decide the white rule from the ORIGINAL fills/strokes.
  let hasWhite = false;
  let hasNonWhite = false;
  for (const m of svg.matchAll(/(?:fill|stroke)\s*=\s*"([^"]*)"/gi)) {
    const v = m[1];
    if (!isColor(v)) continue;
    if (isWhite(v)) hasWhite = true;
    else hasNonWhite = true;
  }
  const knockout = hasWhite && hasNonWhite;
  const whiteTarget = knockout ? KNOCKOUT : "currentColor";
  const rule = knockout
    ? "KNOCKOUT (white -> var(--surface-canvas))"
    : hasWhite
      ? "WHITE-IS-MARK (white -> currentColor)"
      : "NO-WHITE (colors -> currentColor)";

  // 2. Capture root geometry before we rewrite the tag.
  const open = svg.match(/<svg[^>]*>/i)[0];
  let viewBox = attr(open, "viewBox");
  const w = num(attr(open, "width"));
  const h = num(attr(open, "height"));
  let synthesized = false;
  if (!viewBox) {
    if (w == null || h == null)
      throw new Error(`${brand}: no viewBox and no width/height to synthesize from`);
    viewBox = `0 0 ${w} ${h}`;
    synthesized = true;
  }

  let out = svg;
  // 3. Strip <defs> and <style> blocks entirely.
  out = out.replace(/<defs[\s\S]*?<\/defs>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  // 4. Remove now-dangling references and dead classes.
  out = out.replace(/\s*clip-path\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\s*class\s*=\s*"[^"]*"/gi, "");
  // 5. Map every fill/stroke value.
  out = out.replace(/(fill|stroke)\s*=\s*"([^"]*)"/gi, (m, a, v) => {
    const t = v.trim().toLowerCase();
    if (t === "none") return `${a}="none"`;
    if (t === "currentcolor") return `${a}="currentColor"`;
    if (t === "transparent" || t === "") return m;
    if (t.startsWith("url(")) return `${a}="currentColor"`;
    if (isWhite(v)) return `${a}="${whiteTarget}"`;
    return `${a}="currentColor"`;
  });
  // 6. Rebuild the root <svg> tag: drop width/height/viewBox/fill, re-add clean.
  let rootAttrs = open.replace(/<svg/i, "").replace(/>$/, "");
  for (const name of ["width", "height", "viewBox", "fill", "class", "style"]) {
    rootAttrs = rootAttrs.replace(new RegExp(`\\s*${name}\\s*=\\s*"[^"]*"`, "i"), "");
  }
  rootAttrs = rootAttrs.trim();
  const newOpen = `<svg ${rootAttrs} viewBox="${viewBox}" fill="currentColor">`;
  out = out.replace(/<svg[^>]*>/i, newOpen);
  // Tidy: collapse leftover blank lines from stripped blocks.
  out = out.replace(/\n{2,}/g, "\n").trim() + "\n";

  const [, , vbw, vbh] = viewBox.split(/\s+/).map(Number);
  const aspect = Math.round((vbw / vbh) * 1000) / 1000;
  return { out, viewBox, aspect, rule, synthesized };
}

function run() {
  if (!existsSync(RAW_DIR)) {
    console.log(`No raw/ directory at ${RAW_DIR} — nothing to normalize.`);
  } else {
    const raws = readdirSync(RAW_DIR).filter((f) => f.toLowerCase().endsWith(".svg"));
    console.log(`Normalizing ${raws.length} file(s) from raw/:\n`);
    for (const file of raws) {
      const brand = file.replace(/\.svg$/i, "");
      const svg = readFileSync(join(RAW_DIR, file), "utf8");
      const { out, viewBox, aspect, rule, synthesized } = normalize(svg, brand);
      writeFileSync(join(LOGOS_DIR, file), out);
      console.log(
        `  ${brand.padEnd(14)} ${rule.padEnd(42)} viewBox="${viewBox}"` +
          `${synthesized ? " (synthesized)" : ""} aspect=${aspect}`
      );
    }
  }

  // Regenerate manifest.json from every normalized SVG in the logos dir.
  const files = readdirSync(LOGOS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".svg"))
    .sort();
  const manifest = files.map((file) => {
    const svg = readFileSync(join(LOGOS_DIR, file), "utf8");
    const viewBox = attr(svg.match(/<svg[^>]*>/i)[0], "viewBox") || "0 0 0 0";
    const [, , vbw, vbh] = viewBox.split(/\s+/).map(Number);
    return {
      brand: file.replace(/\.svg$/i, ""),
      file,
      viewBox,
      aspect: Math.round((vbw / vbh) * 1000) / 1000,
    };
  });
  writeFileSync(join(LOGOS_DIR, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
  console.log(`\nRegenerated manifest.json (${manifest.length} logos).`);
}

run();
