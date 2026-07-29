#!/usr/bin/env node
/**
 * Asserts every .riv config in the repo against the COMMITTED BYTES.
 *
 * THE BUG THIS EXISTS FOR: on 2026-07-28 the AudienceRails section shipped with
 * two of its three glyphs missing. The Rive MCP had mapped the *open editor
 * session* — three artboards, correctly — while the exported file on disk held
 * one. Two canvases requested artboards that were not in the file, failed to
 * load, and the "render nothing on failure" rule hid both. Neither `tsc -b` nor
 * `vite build` nor 361 tests could see it: the first two never read a .riv, and
 * the tests mock the Rive runtime, so the mock agreed with whatever the config
 * claimed.
 *
 * The generalisation is what matters. That gap is not specific to the glyphs —
 * a re-export of nosey.riv that lost its artboard would fail exactly as
 * silently today. So this checks EVERY pair: the five modal heroes against
 * useCaseContent.ts, and the three glyphs against AudienceRails.tsx.
 *
 * SELF-GUARDING: configs are parsed out of source, never duplicated here, so
 * this cannot drift from what ships. If the parse does not find the expected
 * number of configs it fails loudly rather than silently checking fewer — a
 * checker that quietly verifies nothing is worse than no checker.
 *
 * Usage: node scripts/check-riv-assets.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { probe, loadWasmLocally } from "./probe-riv.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = "src/components/UseCaseModal/useCaseContent.ts";
const RAILS = "src/components/AudienceRails.tsx";
const ASSET_DIR = "src/assets/rive";

/** Expected config counts. A mismatch means the parser broke, not that the repo shrank. */
const EXPECT = { heroes: 5, glyphs: 3 };

const problems = [];
const fail = (m) => problems.push(m);

/** ident -> absolute .riv path, from `import x from "….riv?url"` in one file. */
function rivImports(sourcePath) {
  const text = readFileSync(resolve(ROOT, sourcePath), "utf8");
  const dir = dirname(resolve(ROOT, sourcePath));
  const map = new Map();
  for (const m of text.matchAll(
    /import\s+(\w+)\s+from\s+"([^"]+\.riv)\?url"/g,
  )) {
    map.set(m[1], resolve(dir, m[2]));
  }
  return { text, map };
}

/** The five modal heroes: src ident + artboard + stateMachine. */
function heroConfigs() {
  const { text, map } = rivImports(CONTENT);
  const out = [];
  for (const m of text.matchAll(
    /src:\s*(\w+),[\s\S]{0,400}?artboard:\s*"([^"]+)",\s*\n\s*stateMachine:\s*"([^"]+)"/g,
  )) {
    const file = map.get(m[1]);
    if (!file) {
      fail(`${CONTENT}: hero src \`${m[1]}\` has no matching .riv?url import`);
      continue;
    }
    out.push({ where: CONTENT, file, artboard: m[2], stateMachine: m[3] });
  }
  return out;
}

/** The three glyph rails: src ident + artboard (no stateMachine in the config). */
function glyphConfigs() {
  const { text, map } = rivImports(RAILS);
  const out = [];
  for (const m of text.matchAll(
    /src:\s*(\w+),\s*\n\s*artboard:\s*"([^"]+)"/g,
  )) {
    const file = map.get(m[1]);
    if (!file) {
      fail(`${RAILS}: rail src \`${m[1]}\` has no matching .riv?url import`);
      continue;
    }
    out.push({ where: RAILS, file, artboard: m[2], stateMachine: null });
  }
  return out;
}

/** Every .riv under src/ that any source file imports. Catches dead assets. */
function importedAnywhere() {
  const seen = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const text = readFileSync(p, "utf8");
        for (const m of text.matchAll(/"([^"]+\.riv)\?url"/g)) {
          seen.add(resolve(dirname(p), m[1]));
        }
      }
    }
  };
  walk(resolve(ROOT, "src"));
  return seen;
}

const configs = [...heroConfigs(), ...glyphConfigs()];
const heroCount = configs.filter((c) => c.where === CONTENT).length;
const glyphCount = configs.filter((c) => c.where === RAILS).length;

if (heroCount !== EXPECT.heroes) {
  fail(
    `parser found ${heroCount} hero configs in ${CONTENT}, expected ${EXPECT.heroes} — ` +
      `the parser is broken or the content model changed. Refusing to check a partial set.`,
  );
}
if (glyphCount !== EXPECT.glyphs) {
  fail(
    `parser found ${glyphCount} glyph configs in ${RAILS}, expected ${EXPECT.glyphs} — ` +
      `the parser is broken or the rails changed. Refusing to check a partial set.`,
  );
}

loadWasmLocally();

console.log(`Probing ${configs.length} .riv config pairs against committed bytes\n`);

for (const cfg of configs) {
  const rel = relative(ROOT, cfg.file);
  const result = await probe(cfg.file);

  if (result.error) {
    fail(`${rel}: ${result.error}`);
    continue;
  }

  const names = result.artboards.map((a) => a.name);
  const hit = result.artboards.find((a) => a.name === cfg.artboard);

  if (!hit) {
    fail(
      `${rel}: config wants artboard "${cfg.artboard}" — file contains [${names.join(", ") || "none"}]\n` +
        `      configured in ${cfg.where}`,
    );
    continue;
  }

  if (cfg.stateMachine && !hit.stateMachines.includes(cfg.stateMachine)) {
    fail(
      `${rel}: artboard "${cfg.artboard}" has no state machine "${cfg.stateMachine}" ` +
        `— found [${hit.stateMachines.join(", ") || "none"}]\n` +
        `      configured in ${cfg.where}`,
    );
    continue;
  }

  const sm = cfg.stateMachine ? `  sm ${cfg.stateMachine}` : "";
  console.log(`  ok  ${basename(cfg.file)}  →  ${cfg.artboard}${sm}`);
}

/* Dead assets invite exactly the drift that caused the original bug: a file
   nobody imports is a file nobody notices is wrong. */
const imported = importedAnywhere();
for (const entry of readdirSync(resolve(ROOT, ASSET_DIR))) {
  if (!entry.endsWith(".riv")) continue;
  const p = resolve(ROOT, ASSET_DIR, entry);
  if (!imported.has(p)) {
    fail(`${ASSET_DIR}/${entry}: committed but imported nowhere — dead asset`);
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`\n✓ all ${configs.length} config pairs match the committed bytes`);
