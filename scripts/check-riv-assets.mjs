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
const SITE = "src/components/riveSiteAssets.ts";
const SITE_DIR = "public/rive/site";

/** Expected config counts. A mismatch means the parser broke, not that the repo shrank. */
const EXPECT = { heroes: 5, glyphs: 3, site: 3 };

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

/**
 * Rive's own site animations (public/rive/site/). These are NOT imports — they
 * are literal public/ paths, so `rivImports` cannot see them and neither could
 * this checker until they were wired. Each config also declares the state
 * machine INPUTS it drives, and those are checked too: a renamed or misspelled
 * input is exactly the failure this script exists to catch, and it is invisible
 * to tsc, to vite and to a mocked test.
 */
function siteConfigs() {
  const text = readFileSync(resolve(ROOT, SITE), "utf8");
  const out = [];
  for (const raw of text.split(/^export const /m).slice(1)) {
    /* STRIP COMMENTS FIRST. The maps here carry long explanatory blocks that
       quote config verbatim — one of them contains the line
       `pointer: "listeners"  idle 577 → hover 584` as evidence in an A/B table.
       Matching against the raw text read that comment as the configuration and
       cheerfully reported the wrong pointer model as verified: a checker
       agreeing with prose instead of code, which is precisely what this script
       exists to stop. */
    const block = raw
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    const src = block.match(/src:\s*"([^"]+\.riv)"/);
    const artboard = block.match(/artboard:\s*"([^"]+)"/);
    const stateMachine = block.match(/stateMachine:\s*"([^"]+)"/);
    if (!src || !artboard || !stateMachine) continue;
    /* Bracket-matched, NOT a non-greedy regex: each entry contains its own
       `zone: [0, 0.2]`, so `\[([\s\S]*?)\]` stops at the first inner bracket and
       silently reports one input out of five. A checker that verifies a subset
       while printing success is the precise failure mode this script exists to
       prevent — see the header. */
    const inputs = [];
    const open = block.indexOf("declaredInputs:");
    if (open !== -1) {
      const from = block.indexOf("[", open);
      let depth = 0;
      let end = -1;
      for (let i = from; i < block.length; i++) {
        if (block[i] === "[") depth++;
        else if (block[i] === "]" && --depth === 0) {
          end = i;
          break;
        }
      }
      if (end === -1) {
        fail(`${SITE}: unterminated declaredInputs array — cannot verify inputs`);
        continue;
      }
      for (const m of block.slice(from, end).matchAll(/name:\s*"([^"]+)"/g)) {
        inputs.push(m[1]);
      }
    }
    const pointer = block.match(/pointer:\s*"(listeners|manual|none)"/);
    if (!pointer) {
      fail(`${SITE}: an asset declares no pointer model — cannot verify wiring`);
      continue;
    }
    const inert = /listenersInert:\s*true/.test(block);
    out.push({
      where: SITE,
      /* "/rive/site/x.riv" is a URL path, rooted at public/. */
      file: resolve(ROOT, "public", src[1].replace(/^\//, "")),
      artboard: artboard[1],
      stateMachine: stateMachine[1],
      inputs,
      pointer: pointer[1],
      listenersInert: inert,
    });
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

const configs = [...heroConfigs(), ...glyphConfigs(), ...siteConfigs()];
const heroCount = configs.filter((c) => c.where === CONTENT).length;
const glyphCount = configs.filter((c) => c.where === RAILS).length;
const siteCount = configs.filter((c) => c.where === SITE).length;

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

if (siteCount !== EXPECT.site) {
  fail(
    `parser found ${siteCount} site configs in ${SITE}, expected ${EXPECT.site} — ` +
      `the parser is broken or the asset set changed. Refusing to check a partial set.`,
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

  /* Input parity. `cfg.inputs` is only present for the site assets; the modal
     heroes deliberately declare none because we never write their inputs. */
  let inputNote = "";
  if (cfg.inputs) {
    const found = hit.inputs?.[cfg.stateMachine];
    if (found === null || found === undefined) {
      fail(
        `${rel}: could not read inputs for "${cfg.stateMachine}" — cannot verify ` +
          `[${cfg.inputs.join(", ")}]\n      configured in ${cfg.where}`,
      );
      continue;
    }
    const names = found.map((i) => i.name);
    const missing = cfg.inputs.filter((n) => !names.includes(n));
    if (missing.length) {
      fail(
        `${rel}: config drives input(s) [${missing.join(", ")}] that "${cfg.stateMachine}" ` +
          `does not have — file has [${names.join(", ") || "none"}]\n` +
          `      configured in ${cfg.where}`,
      );
      continue;
    }
    inputNote = cfg.inputs.length
      ? `  inputs ${cfg.inputs.length}/${names.length}`
      : `  no inputs (autonomous)`;
  }

  /* POINTER-MODEL PARITY. The single most consequential fact about one of these
     files is whether it carries its own pointer listeners, and it is not
     guessable: get-started-cat.riv has shapes called Hitbox_* and NO listeners,
     get-started-rocket.riv has listeners and no such shape. Wiring the wrong
     model gives a button that looks right and reacts wrongly (or not at all),
     which nothing else in the build can see. */
  if (cfg.pointer) {
    const listens = hit.listeners?.[cfg.stateMachine];
    if (listens === null || listens === undefined) {
      fail(
        `${rel}: could not read listeners for "${cfg.stateMachine}" — cannot ` +
          `verify pointer model "${cfg.pointer}"\n      configured in ${cfg.where}`,
      );
      continue;
    }
    /* `hasListeners` is necessary but not sufficient: get-started-rocket.riv
       reports listeners that measurably never fire (see riveSiteAssets.ts for
       the A/B). So a "manual" model on a file WITH listeners is allowed, but
       only when the config says so out loud via `listenersInert`. The dangerous
       direction — claiming "listeners" on a file that has none, which wires up
       nothing at all — is always a failure. */
    const want = listens ? "listeners" : cfg.inputs.length ? "manual" : "none";
    const allowed =
      cfg.pointer === want ||
      (listens && cfg.pointer === "manual" && cfg.listenersInert);
    if (!allowed) {
      fail(
        `${rel}: config says pointer: "${cfg.pointer}" but the file ` +
          `${listens ? "HAS" : "has NO"} listeners and declares ` +
          `${cfg.inputs.length} input(s) — expected "${want}"` +
          (listens && cfg.pointer === "manual"
            ? ` (set listenersInert: true if the listeners are measurably inert)`
            : "") +
          `\n      configured in ${cfg.where}`,
      );
      continue;
    }
    inputNote += `  pointer:${cfg.pointer}${cfg.listenersInert ? " (listeners inert)" : ""}`;
  }

  const sm = cfg.stateMachine ? `  sm ${cfg.stateMachine}` : "";
  console.log(`  ok  ${basename(cfg.file)}  →  ${cfg.artboard}${sm}${inputNote}`);
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

/* Same dead-asset rule for the site animations: a committed .riv that no config
   references is one nobody notices is wrong. */
const siteReferenced = new Set(
  configs.filter((c) => c.where === SITE).map((c) => c.file),
);
for (const entry of readdirSync(resolve(ROOT, SITE_DIR))) {
  if (!entry.endsWith(".riv")) continue;
  if (!siteReferenced.has(resolve(ROOT, SITE_DIR, entry))) {
    fail(`${SITE_DIR}/${entry}: committed but referenced by no config — dead asset`);
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`\n✓ all ${configs.length} config pairs match the committed bytes`);
