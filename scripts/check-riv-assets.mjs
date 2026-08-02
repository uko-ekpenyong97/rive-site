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

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { probe, loadWasmLocally } from "./probe-riv.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = "src/components/UseCaseModal/useCaseContent.ts";
const RAILS = "src/components/AudienceRails.tsx";
const ASSET_DIR = "src/assets/rive";
const SITE = "src/components/riveSiteAssets.ts";
const SITE_DIR = "public/rive/site";
const LOOP = "src/components/LoopCanvas.tsx";

/** Expected config counts. A mismatch means the parser broke, not that the repo shrank. */
const EXPECT = { heroes: 5, glyphs: 3, site: 3, loop: 1 };

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
    /** Bracket-matched slice of `key: [ ... ]`, or null when the key is absent. */
    const arrayAfter = (key) => {
      const open = block.indexOf(`${key}:`);
      if (open === -1) return null;
      const from = block.indexOf("[", open);
      if (from === -1) return null;
      let depth = 0;
      for (let i = from; i < block.length; i++) {
        if (block[i] === "[") depth++;
        else if (block[i] === "]" && --depth === 0) return block.slice(from, i);
      }
      return undefined; // unterminated
    };

    const declared = arrayAfter("declaredInputs");
    if (declared === undefined) {
      fail(`${SITE}: unterminated declaredInputs array — cannot verify inputs`);
      continue;
    }
    const inputs = declared
      ? [...declared.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1])
      : [];

    /* Verified to EXIST in the bytes, deliberately never written. The check is
       the whole point of the field: "we looked and chose not to" has to be
       distinguishable from "we never knew", and only the artifact can settle
       whether the input is still there to be chosen against. */
    const undriven = arrayAfter("undrivenInputs");
    if (undriven === undefined) {
      fail(`${SITE}: unterminated undrivenInputs array — cannot verify inputs`);
      continue;
    }
    const undrivenInputs = undriven
      ? [...undriven.matchAll(/"([^"]+)"/g)].map((m) => m[1])
      : [];

    /* Falling-edge escalation targets. Same rule as everything else here: an
       input we set has to exist in the committed bytes, or the paw search
       silently does nothing and only a browser would ever notice. */
    const esc = arrayAfter("escalation");
    if (esc === undefined) {
      fail(`${SITE}: unterminated escalation array — cannot verify inputs`);
      continue;
    }
    const escalation = esc
      ? [...esc.matchAll(/from:\s*"([^"]+)"\s*,\s*to:\s*"([^"]+)"/g)].map((m) => ({
          from: m[1],
          to: m[2],
        }))
      : [];

    const pointer = block.match(/pointer:\s*"(manual|none)"/);
    if (!pointer) {
      fail(`${SITE}: an asset declares no pointer model — cannot verify wiring`);
      continue;
    }
    out.push({
      where: SITE,
      /* "/rive/site/x.riv" is a URL path, rooted at public/. */
      file: resolve(ROOT, "public", src[1].replace(/^\//, "")),
      artboard: artboard[1],
      stateMachine: stateMachine[1],
      inputs,
      undrivenInputs,
      escalation,
      pointer: pointer[1],
    });
  }
  return out;
}

/**
 * The Loop character (WorkflowStack). Its config is neither a content-table
 * entry nor a public/ path — it is a set of exported constants in the component,
 * so it needed its own parser and went unchecked until 2026-08-01.
 *
 * THE GAP THIS CLOSES: loop.riv was re-exported that day and the swap could have
 * renamed `BeatMachine`, reordered the artboards, or dropped a `Beat` value with
 * CI staying entirely green — the same failure class as the AudienceRails glyphs
 * incident, on the file most likely to be re-exported again.
 *
 * ENUM VALUES ARE THE POINT. Everything else here fails loudly at runtime; a
 * `viewModelInstance.enum("beat").value = "wire"` against a file that no longer
 * defines `wire` is a SILENT no-op. The character just stops changing beat.
 */
function loopConfig() {
  const { text, map } = rivImports(LOOP);
  const file = map.get("loopRivUrl");
  if (!file) {
    fail(`${LOOP}: no \`loop.riv?url\` import found — cannot locate the asset`);
    return [];
  }
  const str = (name) => text.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`))?.[1];
  const arr = (name) => {
    const m = text.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`));
    return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
  };

  const artboard = str("LOOP_ARTBOARD");
  const stateMachine = str("LOOP_STATE_MACHINE");
  const viewModel = str("LOOP_VIEW_MODEL");
  const enumName = str("LOOP_BEAT_ENUM");
  const beats = arr("BEATS");
  const vmProps = arr("LOOP_VM_PROPERTIES");

  /* Refuse to check a partial contract — a parser that silently finds three of
     six constants would print success while verifying almost nothing. */
  const missing = Object.entries({
    LOOP_ARTBOARD: artboard,
    LOOP_STATE_MACHINE: stateMachine,
    LOOP_VIEW_MODEL: viewModel,
    LOOP_BEAT_ENUM: enumName,
    BEATS: beats,
    LOOP_VM_PROPERTIES: vmProps,
  })
    .filter(([, v]) => !v || (Array.isArray(v) && v.length === 0))
    .map(([k]) => k);
  if (missing.length) {
    fail(
      `${LOOP}: could not parse [${missing.join(", ")}] — the Loop contract cannot be ` +
        `checked. Refusing to verify a partial contract.`,
    );
    return [];
  }

  return [
    {
      where: LOOP,
      file,
      artboard,
      stateMachine,
      viewModel,
      viewModelProperties: vmProps,
      enumName,
      enumValues: beats,
    },
  ];
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

const configs = [...heroConfigs(), ...glyphConfigs(), ...siteConfigs(), ...loopConfig()];
const heroCount = configs.filter((c) => c.where === CONTENT).length;
const glyphCount = configs.filter((c) => c.where === RAILS).length;
const siteCount = configs.filter((c) => c.where === SITE).length;
const loopCount = configs.filter((c) => c.where === LOOP).length;

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

if (loopCount !== EXPECT.loop) {
  fail(
    `parser found ${loopCount} Loop config in ${LOOP}, expected ${EXPECT.loop} — ` +
      `the parser is broken or the contract moved. Refusing to check a partial set.`,
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
    /* The undriven list is checked just as hard as the driven one. If one of
       these disappears from the file, the annotation "present in the file, never
       driven by Rive's own site" has quietly become false, and the decision it
       records is no longer about anything. */
    const goneUndriven = cfg.undrivenInputs.filter((n) => !names.includes(n));
    if (goneUndriven.length) {
      fail(
        `${rel}: config lists undriven input(s) [${goneUndriven.join(", ")}] that ` +
          `"${cfg.stateMachine}" does not have — file has [${names.join(", ") || "none"}]\n` +
          `      configured in ${cfg.where}`,
      );
      continue;
    }
    /* Escalation targets are DRIVEN — on the falling edge rather than on hover,
       but driven all the same. Both ends of each pair must exist. */
    const escNames = cfg.escalation.flatMap((e) => [e.from, e.to]);
    const goneEsc = escNames.filter((n) => !names.includes(n));
    if (goneEsc.length) {
      fail(
        `${rel}: escalation names input(s) [${goneEsc.join(", ")}] that ` +
          `"${cfg.stateMachine}" does not have — file has [${names.join(", ") || "none"}]\n` +
          `      configured in ${cfg.where}`,
      );
      continue;
    }
    /* An escalation target listed as undriven is a contradiction: the whole
       point of `undrivenInputs` is that nothing writes it. */
    const escUndriven = cfg.escalation
      .map((e) => e.to)
      .filter((n) => cfg.undrivenInputs.includes(n));
    if (escUndriven.length) {
      fail(
        `${rel}: input(s) [${escUndriven.join(", ")}] are escalation targets but ` +
          `also listed as undriven\n      configured in ${cfg.where}`,
      );
      continue;
    }
    /* Each escalation must start from an input we actually drive on hover. */
    const escOrphan = cfg.escalation
      .map((e) => e.from)
      .filter((n) => !cfg.inputs.includes(n));
    if (escOrphan.length) {
      fail(
        `${rel}: escalation starts from [${escOrphan.join(", ")}], which is not a ` +
          `driven hover input — it could never fire\n      configured in ${cfg.where}`,
      );
      continue;
    }

    /* Driving something also listed as undriven is contradictory on its face. */
    const both = cfg.inputs.filter((n) => cfg.undrivenInputs.includes(n));
    if (both.length) {
      fail(
        `${rel}: input(s) [${both.join(", ")}] are both driven and listed as undriven\n` +
          `      configured in ${cfg.where}`,
      );
      continue;
    }
    inputNote = cfg.inputs.length
      ? `  inputs ${cfg.inputs.length} driven` +
        (cfg.escalation.length ? ` + ${cfg.escalation.length} escalation` : "") +
        (cfg.undrivenInputs.length
          ? ` + ${cfg.undrivenInputs.length} present-not-driven`
          : "") +
        ` / ${names.length} in file`
      : `  no inputs (autonomous)`;
  }

  /* POINTER-MODEL PARITY. The canvas is display-only for every file — there is
     no canvas-driven mode any more, because that is not how rive.app works — so
     the only question left is whether a file has inputs to drive at all. A file
     with inputs must be "manual"; a file with none must be "none". Getting this
     wrong gives a button that looks right and reacts wrongly (or not at all),
     which nothing else in the build can see.

     Listener presence is still REPORTED, because it is real and hard-won
     information (get-started-rocket.riv carries listeners that measurably never
     fire — see the A/B in riveSiteAssets.ts), but it no longer selects a model. */
  if (cfg.pointer) {
    const listens = hit.listeners?.[cfg.stateMachine];
    const want = cfg.inputs.length ? "manual" : "none";
    if (cfg.pointer !== want) {
      fail(
        `${rel}: config says pointer: "${cfg.pointer}" but the file declares ` +
          `${cfg.inputs.length} driven input(s) — expected "${want}"` +
          `\n      configured in ${cfg.where}`,
      );
      continue;
    }
    inputNote += `  pointer:${cfg.pointer}${listens ? " (file has listeners; canvas is display-only)" : ""}`;
  }

  /* VIEW-MODEL PARITY (Loop only for now). autoBind binds the file's default
     view model, and every property below is written by name at runtime — an
     unknown name is a no-op, never an error. */
  if (cfg.viewModel) {
    const vm = result.viewModels.find((v) => v.name === cfg.viewModel);
    if (!vm) {
      fail(
        `${rel}: config binds view model "${cfg.viewModel}" — file contains ` +
          `[${result.viewModels.map((v) => v.name).join(", ") || "none"}]\n` +
          `      configured in ${cfg.where}`,
      );
      continue;
    }
    const propNames = vm.properties.map((p) => p.name);
    const goneProps = cfg.viewModelProperties.filter((n) => !propNames.includes(n));
    if (goneProps.length) {
      fail(
        `${rel}: config writes "${cfg.viewModel}" propert(ies) [${goneProps.join(", ")}] ` +
          `that the file does not define — file has [${propNames.join(", ") || "none"}]\n` +
          `      configured in ${cfg.where}`,
      );
      continue;
    }

    /* ENUM VALUES. The silent one: writing a value the file no longer defines
       does not throw, so this is the only place it can be caught. */
    const en = result.enums.find((e) => e.name === cfg.enumName);
    if (!en) {
      fail(
        `${rel}: config names enum "${cfg.enumName}" — file contains ` +
          `[${result.enums.map((e) => e.name).join(", ") || "none"}]\n` +
          `      configured in ${cfg.where}`,
      );
      continue;
    }
    const goneValues = cfg.enumValues.filter((v) => !en.values.includes(v));
    if (goneValues.length) {
      fail(
        `${rel}: enum "${cfg.enumName}" is missing value(s) [${goneValues.join(", ")}] ` +
          `that the config writes — file defines [${en.values.join(", ")}]. ` +
          `Writing a value the file does not define is a SILENT no-op.\n` +
          `      configured in ${cfg.where}`,
      );
      continue;
    }
    /* Extra values in the file are reported, not failed: the file may legitimately
       carry a beat the site has not wired yet. Unwired is a choice; missing is a bug. */
    const extra = en.values.filter((v) => !cfg.enumValues.includes(v));
    inputNote +=
      `  vm ${cfg.viewModel} (${cfg.viewModelProperties.length}/${propNames.length} props)` +
      `  enum ${cfg.enumName} ${cfg.enumValues.length}/${en.values.length}` +
      (extra.length ? ` (file also has: ${extra.join(", ")})` : "");
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

/* ──────────────────────────────────────────────────────────────────────────
 * THE SELF-HOSTED RUNTIME WASM.
 *
 * The site no longer fetches its ~2.4 MB runtime from unpkg; it serves its own
 * copies out of public/rive/runtime/. That turns a CDN dependency into an
 * artifact, and artifacts drift — so this is the same config-vs-artifact guard
 * the .riv files get above, applied to the wasm.
 *
 * THE DRIFT THIS CATCHES: `npm i @rive-app/react-webgl2@latest` upgrades the JS
 * runtime and leaves the committed wasm untouched. The wasm and the JS that
 * consumes it are ONE unit — a new runtime against old bytes is undefined
 * behaviour, and nothing else in the build can see it. `tsc` does not read a
 * .wasm, `vite build` only copies it, and the Vitest suite mocks the runtime
 * entirely, so a mock agrees with whatever version the source claims.
 *
 * Three assertions, because each catches a different half of the same mistake:
 *   1. committed bytes === node_modules bytes, for BOTH binaries
 *   2. the version in each filename === the installed package version
 *   3. src/riveRuntime.ts points at exactly those two committed files
 * ────────────────────────────────────────────────────────────────────────── */

const RUNTIME_SRC = "src/riveRuntime.ts";
const RUNTIME_DIR = "public/rive/runtime";
const PKG = "@rive-app/webgl2";

const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/**
 * Source with comments removed, for checks that must read CODE and not PROSE.
 *
 * riveRuntime.ts documents the exact unpkg URL the site used to fetch, because
 * a measured before-state is worth keeping. A naive `includes("unpkg.com")`
 * scan cannot tell that apart from a live CDN path and fails on the comment —
 * it did, first run. Stripping is a small state machine rather than a regex
 * because the strings being protected are themselves full of slashes.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  let quote = null; // ' " or `
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      if (c === "\\") { out += c + (next ?? ""); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      out += " ";
      continue;
    }
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      i = end === -1 ? src.length : end;
      out += " ";
      continue;
    }
    out += c; i++;
  }
  return out;
}

{
  const installed = JSON.parse(
    readFileSync(resolve(ROOT, "node_modules", PKG, "package.json"), "utf8"),
  ).version;

  const src = readFileSync(resolve(ROOT, RUNTIME_SRC), "utf8");
  const declared = src.match(/RIVE_WASM_VERSION\s*=\s*"([^"]+)"/)?.[1];

  if (!declared) {
    fail(`${RUNTIME_SRC}: could not parse RIVE_WASM_VERSION — the pin cannot be checked`);
  } else if (declared !== installed) {
    fail(
      `${RUNTIME_SRC}: declares ${PKG}@${declared} but node_modules has ${installed} — ` +
        `re-copy both wasm files under the new version's names and update the constants`,
    );
  }

  /* Both binaries, and the distinction matters: rive_fallback.wasm is compiled
     for older architectures, NOT a mirror of the primary. Pinning only the
     primary would let the fallback rot into a version mismatch that surfaces
     only on the machines least able to report it. */
  const pairs = [
    { label: "primary", node: "rive.wasm", committed: `rive-${installed}.wasm` },
    {
      label: "older-architecture fallback",
      node: "rive_fallback.wasm",
      committed: `rive_fallback-${installed}.wasm`,
    },
  ];

  for (const { label, node, committed } of pairs) {
    const nodePath = resolve(ROOT, "node_modules", PKG, node);
    const outPath = resolve(ROOT, RUNTIME_DIR, committed);

    if (!existsSync(nodePath)) {
      fail(`node_modules/${PKG}/${node} is missing — cannot verify the ${label} wasm`);
      continue;
    }
    if (!existsSync(outPath)) {
      fail(
        `${RUNTIME_DIR}/${committed} is missing — the ${label} wasm was never exported ` +
          `for ${PKG}@${installed} (copy it from node_modules/${PKG}/${node})`,
      );
      continue;
    }

    const want = sha256(nodePath);
    const got = sha256(outPath);
    if (want !== got) {
      fail(
        `${RUNTIME_DIR}/${committed}: sha256 ${got.slice(0, 16)}… does not match ` +
          `node_modules/${PKG}/${node} (${want.slice(0, 16)}…) — the committed ${label} ` +
          `wasm is not the one this runtime version ships`,
      );
      continue;
    }

    /* The source must actually reference the file we just verified. Bytes that
       match but are never requested are not a fix. */
    if (!src.includes(committed.replace(`-${installed}.wasm`, ""))) {
      fail(`${RUNTIME_SRC}: does not reference ${committed} — the ${label} wasm is orphaned`);
      continue;
    }

    console.log(
      `  ok  ${committed}  →  ${label}  sha256 ${got.slice(0, 12)}…  ` +
        `${readFileSync(outPath).length.toLocaleString()} bytes`,
    );
  }

  /* No stale exports: an old version's wasm left behind would still be served,
     and "which one is live" would be a question rather than a fact. */
  const expected = new Set(pairs.map((p) => p.committed));
  for (const entry of readdirSync(resolve(ROOT, RUNTIME_DIR))) {
    if (!entry.endsWith(".wasm")) continue;
    if (!expected.has(entry)) {
      fail(
        `${RUNTIME_DIR}/${entry}: not the export for ${PKG}@${installed} — ` +
          `a stale runtime wasm, delete it`,
      );
    }
  }

  /* The whole point of the change: no CDN literal may survive in the CODE that
     configures the runtime. Comments are stripped first — the file deliberately
     documents the unpkg URL the site used to fetch, and that record should not
     be what trips the guard. */
  const code = stripComments(src);
  for (const host of ["unpkg.com", "cdn.jsdelivr.net"]) {
    if (code.includes(host)) {
      fail(`${RUNTIME_SRC}: still contains a live ${host} URL — the CDN path is not retired`);
    }
  }

  /* The fallback must point at OUR older-architecture build. `null` disables it
     outright, which silently drops support for the CPUs it exists to serve —
     and would look like a tidy simplification in review. */
  if (/setWasmFallbackUrl\s*\(\s*null\s*\)/.test(code)) {
    fail(
      `${RUNTIME_SRC}: calls setWasmFallbackUrl(null), disabling the older-architecture ` +
        `wasm entirely — point it at the committed fallback instead`,
    );
  }
  for (const setter of ["setWasmUrl", "setWasmFallbackUrl"]) {
    if (!code.includes(setter)) {
      fail(`${RUNTIME_SRC}: never calls ${setter} — the runtime would fall back to the CDN`);
    }
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `\n✓ all ${configs.length} config pairs match the committed bytes` +
    `\n✓ runtime wasm pinned to ${PKG}@${JSON.parse(readFileSync(resolve(ROOT, "node_modules", PKG, "package.json"), "utf8")).version} (primary + older-architecture fallback)`,
);
