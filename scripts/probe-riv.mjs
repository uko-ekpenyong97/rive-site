#!/usr/bin/env node
/**
 * Structural probe for .riv files — reports what a file ACTUALLY contains.
 *
 * WHY THIS EXISTS: the Rive MCP reads the *live editor session*, not the file on
 * disk. Those are different things, and on 2026-07-28 they diverged: the MCP
 * correctly reported three artboards in the open editor file while the exported
 * .riv contained one. The map was right about the editor and wrong about the
 * asset, three canvases were wired against it, two failed to load, and the
 * render-nothing fallback swallowed both. Nothing in the build, the typecheck or
 * the 361 tests could see it, because every one of them trusted the map.
 *
 * This probe reads the committed bytes. It is the only check in the repo that
 * can tell you the asset and the config disagree.
 *
 * It ran untracked in the bogota worktree's .context/ before this — the same
 * defect the smoke suite had, and the reason that divergence went unnoticed.
 *
 * Pure Node: the low-level runtime enumerates a file's contents without a
 * renderer, so there is no browser, no canvas and no WebGL here. That is what
 * makes it cheap enough to run in CI.
 *
 * Usage:
 *   node scripts/probe-riv.mjs <file.riv> [more.riv ...]
 *   node scripts/probe-riv.mjs --json <file.riv>     # machine-readable
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const rive = require("@rive-app/webgl2");

/** Feed the runtime the local wasm so the probe never reaches the network. */
export function loadWasmLocally() {
  const wasmPath = require.resolve("@rive-app/webgl2/rive.wasm");
  const buf = readFileSync(wasmPath);
  // Copy out of Node's pooled Buffer — the runtime wants a standalone ArrayBuffer.
  rive.RuntimeLoader.setWasmBinary(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
}

/** Best-effort: property shape differs across runtime versions. */
function describeProperties(viewModel) {
  try {
    return viewModel.getProperties().map((p) => ({
      name: p.name ?? String(p),
      type: p.type ?? undefined,
    }));
  } catch {
    return [];
  }
}

export async function probe(path) {
  const bytes = readFileSync(path);
  const result = {
    file: basename(path),
    path,
    bytes: bytes.byteLength,
    magic: bytes.subarray(0, 4).toString("ascii"),
    artboards: [],
    viewModels: [],
  };

  if (result.magic !== "RIVE") {
    result.error = `not a Rive file (magic ${JSON.stringify(result.magic)})`;
    return result;
  }

  const runtime = await rive.RuntimeLoader.awaitInstance();

  /* Claim every embedded asset and decode none of it. Some files (the health-bar
     hero, for one) carry images, and the runtime would reach for `new Image()` —
     a DOM API that does not exist in Node. Returning true from loadContents says
     "handled", so the runtime skips decoding entirely. We only want the
     structure, so an undecoded image costs nothing; `enableRiveAssetCDN: false`
     likewise keeps a probe of local bytes from quietly hitting the network. */
  const assetLoader = new runtime.CustomFileAssetLoader({
    loadContents: () => true,
  });

  const file = await runtime.load(new Uint8Array(bytes), assetLoader, false);
  if (!file) {
    result.error = "runtime refused the file";
    return result;
  }

  for (let i = 0; i < file.artboardCount(); i++) {
    const ab = file.artboardByIndex(i);
    /* `artboardWidth`/`artboardHeight` are instance-level and read undefined on a
       file-level artboard; `bounds` is the AABB and is populated here. */
    const b = ab.bounds ?? {};
    const artboard = {
      name: ab.name,
      width: b.maxX != null && b.minX != null ? b.maxX - b.minX : null,
      height: b.maxY != null && b.minY != null ? b.maxY - b.minY : null,
      animations: [],
      stateMachines: [],
    };
    for (let a = 0; a < ab.animationCount(); a++) {
      const anim = ab.animationByIndex(a);
      artboard.animations.push({
        name: anim.name,
        // The runtime stores duration in frames; seconds is what specs talk in.
        frames: anim.duration,
        fps: anim.fps,
        seconds: anim.fps ? Number((anim.duration / anim.fps).toFixed(4)) : null,
      });
    }
    for (let s = 0; s < ab.stateMachineCount(); s++) {
      artboard.stateMachines.push(ab.stateMachineByIndex(s).name);
    }
    result.artboards.push(artboard);
  }

  for (let v = 0; v < file.viewModelCount(); v++) {
    const vm = file.viewModelByIndex(v);
    result.viewModels.push({
      name: vm.name,
      properties: describeProperties(vm),
      instances: (() => {
        try {
          return vm.getInstanceNames();
        } catch {
          return [];
        }
      })(),
    });
  }

  return result;
}

function report(r) {
  const line = [];
  line.push(`${r.file}  ${r.bytes.toLocaleString()} B  magic ${r.magic}`);
  if (r.error) {
    line.push(`  ERROR: ${r.error}`);
    return line.join("\n");
  }
  line.push(`  artboards (${r.artboards.length}):`);
  for (const ab of r.artboards) {
    line.push(`    ${ab.name}  ${ab.width} x ${ab.height}`);
    if (ab.stateMachines.length) {
      line.push(`      state machines: ${ab.stateMachines.join(", ")}`);
    }
    for (const an of ab.animations) {
      line.push(
        `      timeline ${an.name}  ${an.seconds}s  (${an.frames} frames @ ${an.fps}fps)`,
      );
    }
  }
  for (const vm of r.viewModels) {
    const props = vm.properties
      .map((p) => (p.type ? `${p.name}:${p.type}` : p.name))
      .join(", ");
    line.push(`  view model ${vm.name}  [${props}]`);
    if (vm.instances.length) {
      line.push(`      instances: ${vm.instances.join(", ")}`);
    }
  }
  return line.join("\n");
}

/* CLI only when run directly — check-riv-assets.mjs imports probe() instead. */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const paths = args.filter((a) => !a.startsWith("--"));

  if (!paths.length) {
    console.error(
      "usage: node scripts/probe-riv.mjs [--json] <file.riv> [more.riv ...]",
    );
    process.exit(2);
  }

  loadWasmLocally();

  const results = [];
  for (const p of paths) results.push(await probe(p));

  console.log(
    asJson
      ? JSON.stringify(results, null, 2)
      : results.map(report).join("\n\n"),
  );

  process.exit(results.some((r) => r.error) ? 1 : 0);
}
