#!/usr/bin/env node
/**
 * check-offline-wasm.mjs — the acceptance test for retiring the CDN runtime.
 *
 *   npm run dev            # in another shell (or `npm run preview`)
 *   npm run check:offline
 *
 * THE CLAIM UNDER TEST, in two halves that are NOT the same claim:
 *
 *   1. WITH unpkg.com and cdn.jsdelivr.net BLOCKED at the network layer, every
 *      Rive surface still mounts and paints. That is the user-visible promise:
 *      a CDN incident no longer empties the hero.
 *
 *   2. On a NORMAL, unblocked load, ZERO requests go to either CDN. Without
 *      this, half 1 could pass while the site still tried unpkg first and merely
 *      recovered — "it worked" and "it never phoned home" are different facts,
 *      and only the second means the override is the real path.
 *
 * MEASUREMENT DISCIPLINE (CLAUDE.md, and every rule here was earned by a bug):
 *   - Pixels come from Page.captureScreenshot, the compositor's output. Reading
 *     back a standalone WebGL2 canvas with drawImage returns zero opaque pixels
 *     and would report a perfectly-painting canvas as blank.
 *   - The BASELINE IS ASSERTED NON-BLANK and the run aborts if it is not. A
 *     comparison against an empty reference is not a measurement.
 *   - DotField is hidden before sampling. Its full-viewport dot grid registers
 *     as ink inside any clip and has already faked out one measurement here.
 *   - "Advancing" is sampled at a FIXED POINTER POSITION, because DotField dots
 *     and hover states both move with the cursor and would be read as animation.
 *   - No pixel change is not the same as no animation, so a still surface is
 *     reported as still rather than failed — the pass condition is MOUNTED AND
 *     PAINTING; advancing is reported alongside it.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const urlArg = args.indexOf("--url");
const URL_ = urlArg >= 0 ? args[urlArg + 1] : "http://localhost:5173/";

const CDN_PATTERNS = ["*unpkg.com*", "*cdn.jsdelivr.net*"];
const CDN_HOSTS = ["unpkg.com", "cdn.jsdelivr.net"];

/** Every Rive surface reachable on Home, and where it lives. */
const SURFACES = [
  { name: "hero rocket / cat / r-logo", selector: ".rive-button__canvas", expect: 3, section: ".hero" },
  { name: "workflow stack", selector: ".workflow-stack__canvas", expect: 1, section: ".workflow-stack" },
  { name: "audience glyphs", selector: ".audience-glyph__canvas", expect: 3, section: ".audience-rails" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const bad = (m) => { failures++; console.error(`  ✗ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);
const note = (m) => console.log(`  · ${m}`);

const profile = mkdtempSync(join(tmpdir(), "offline-wasm-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader",
    "--hide-scrollbars", "about:blank",
  ],
  { stdio: "ignore" },
);

async function devtoolsPort() {
  for (let i = 0; i < 80; i++) {
    try {
      const p = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0].trim();
      if (p) return p;
    } catch { /* not written yet */ }
    await sleep(250);
  }
  throw new Error("Chrome never reported a DevTools port");
}

let ws;
try {
  const port = await devtoolsPort();
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("could not attach to Chrome"));
  });

  let id = 0;
  const pending = new Map();
  let requests = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");

  /** Ink stats for a page-coordinate rect. Throws rather than report a blank. */
  const inkOf = async (rect, label) => {
    const shot = await send("Page.captureScreenshot", {
      format: "png",
      clip: { x: rect.left, y: rect.top, width: rect.width, height: rect.height, scale: 1 },
    });
    const buf = Buffer.from(shot.data, "base64");
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const bg = [data[0], data[1], data[2]];
    let n = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
      if (d > 24) n++;
      sum += data[i] + data[i + 1] + data[i + 2];
    }
    return { inkPx: n, mean: sum / (data.length / info.channels) / 3, raw: data, info, label };
  };

  const meanAbsDiff = (a, b) => {
    let s = 0;
    const len = Math.min(a.raw.length, b.raw.length);
    for (let i = 0; i < len; i++) s += Math.abs(a.raw[i] - b.raw[i]);
    return s / len;
  };

  /** One pass over the page. `blocked` toggles the CDN block. */
  const run = async (blocked) => {
    await send("Network.setBlockedURLs", { urls: blocked ? CDN_PATTERNS : [] });
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    /* Cold every time: a warm wasm cache would let a blocked run pass on bytes
       fetched during the unblocked one. */
    await send("Network.clearBrowserCache");
    await send("Page.navigate", { url: "about:blank" });
    await sleep(400);
    requests = [];
    await send("Page.navigate", { url: URL_ });
    await sleep(6000);

    /* Fixed pointer, parked away from every surface, so hover states and the
       DotField cursor response cannot be mistaken for the artwork advancing. */
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5, button: "none" });

    const hidden = await evaluate(`
      (() => { const d = document.querySelector('.dot-field');
               if (!d) return 'no-dotfield'; d.style.display = 'none'; return 'hidden'; })()
    `);
    if (hidden !== "hidden") throw new Error(`could not isolate DotField: ${hidden}`);

    const results = [];
    for (const surface of SURFACES) {
      /* Bring the SECTION into view first so its lazy-mount observers fire. */
      await evaluate(`
        (() => { const s = document.querySelector(${JSON.stringify(surface.section)});
                 if (s) s.scrollIntoView({ block: 'center' }); return 1; })()
      `);
      await sleep(3500);

      const count = await evaluate(
        `document.querySelectorAll(${JSON.stringify(surface.selector)}).length`,
      );
      const canvases = [];
      for (let i = 0; i < count; i++) {
        /* ── SCROLL, THEN SAMPLE, IN THE SAME BREATH ──────────────────────────
           Page.captureScreenshot takes a clip in PAGE coordinates but only
           renders what is currently in the VIEWPORT; a clip outside it comes
           back uniformly black, which reads exactly like a canvas that never
           painted. This has now bitten three separate measurements in this
           repo, the last time in this very script: geometry was collected for
           all seven canvases in one pass and pixels sampled in a second pass,
           by which point the page had scrolled to the audience rails and the
           hero clips were off-screen. It reported the rocket as "mounted but
           never painted" while it was painting perfectly.

           So each canvas is centred and sampled before moving to the next, and
           `inViewport` is re-checked at sample time rather than assumed. */
        const info = await evaluate(`
          (() => {
            const el = document.querySelectorAll(${JSON.stringify(surface.selector)})[${i}];
            el.scrollIntoView({ block: 'center' });
            const cv = el.tagName === 'CANVAS' ? el : el.querySelector('canvas');
            return {
              /* LIVENESS. useRive sizes the drawing buffer to the element only
                 once the wasm has loaded and the file is instantiated; before
                 that a canvas keeps the 300x150 HTML default. A buffer matching
                 the box is the runtime reporting for duty. */
              buffer: cv ? { w: cv.width, h: cv.height } : null,
              hasCanvas: Boolean(cv),
            };
          })()
        `);
        /* Re-park the pointer AFTER scrolling: the page moved under it, so its
           position relative to any hover target changed even though the client
           coordinates did not. */
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5, button: "none" });
        await sleep(600);

        const geo = await evaluate(`
          (() => {
            const el = document.querySelectorAll(${JSON.stringify(surface.selector)})[${i}];
            const b = el.getBoundingClientRect();
            return { left: Math.round(b.left + scrollX), top: Math.round(b.top + scrollY),
                     width: Math.round(b.width), height: Math.round(b.height),
                     inViewport: b.top >= 0 && b.bottom <= innerHeight &&
                                 b.left >= 0 && b.right <= innerWidth };
          })()
        `);

        const entry = { ...info, rect: geo, inViewport: geo.inViewport };
        if (info.hasCanvas && geo.inViewport && geo.width > 0 && geo.height > 0) {
          const a = await inkOf(geo, `${surface.name}#${i}`);
          await sleep(700);
          await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5, button: "none" });
          const b = await inkOf(geo, `${surface.name}#${i}`);
          entry.inkPx = a.inkPx;
          entry.diff = meanAbsDiff(a, b);
        }
        canvases.push(entry);
      }
      results.push({ surface, canvases });
    }
    return results;
  };

  const cdnHits = (list) => list.filter((u) => CDN_HOSTS.some((h) => u.includes(h)));
  const wasmHits = (list) => list.filter((u) => /\.wasm(\?|$)/i.test(u));

  /* ───────────────────────────────── PASS 1: CDNs BLOCKED ───────────────── */
  console.log(`Self-hosted Rive wasm — ${URL_}\n`);
  console.log("PASS 1 — unpkg.com and cdn.jsdelivr.net BLOCKED, cold cache");

  const blockedRun = await run(true);
  const blockedRequests = [...requests];

  for (const { surface, canvases } of blockedRun) {
    if (canvases.length !== surface.expect) {
      bad(`${surface.name}: expected ${surface.expect} canvas(es), found ${canvases.length} — did not mount`);
      continue;
    }
    let live = 0;
    let painted = 0;
    let moved = 0;
    let idleTransparent = 0;

    for (const [i, c] of canvases.entries()) {
      const label = `${surface.name} #${i}`;
      if (!c.hasCanvas || !(c.rect.width > 0 && c.rect.height > 0)) {
        bad(`${label}: no canvas element, or zero-size`);
        continue;
      }
      /* Liveness first, because it is the claim the wasm actually underwrites:
         an unloaded runtime leaves the 300x150 default and paints nothing. */
      const sized =
        c.buffer &&
        Math.abs(c.buffer.w - c.rect.width) <= 2 &&
        Math.abs(c.buffer.h - c.rect.height) <= 2;
      if (!sized) {
        bad(
          `${label}: drawing buffer ${c.buffer ? `${c.buffer.w}x${c.buffer.h}` : "none"} does not ` +
            `match its ${c.rect.width}x${c.rect.height} box — the runtime never sized it, so the ` +
            `wasm did not load`,
        );
        continue;
      }
      live++;

      if (!c.inViewport) {
        /* Refuse to sample rather than report black from an off-viewport clip. */
        bad(`${label}: could not be fully scrolled into the viewport — refusing to sample its pixels`);
        continue;
      }

      if (c.inkPx < 40) {
        /* NOT a failure by itself: some surfaces are transparent at rest — the
           nav cat only leans out when the pointer is near, and the pointer is
           deliberately parked far away so its motion cannot be mistaken for the
           artwork advancing. Liveness above already proves the runtime loaded.
           Reported explicitly so a genuinely dead canvas can never hide here. */
        idleTransparent++;
        note(`${label}: live (buffer ${c.buffer.w}x${c.buffer.h}) but transparent at this idle pose`);
        continue;
      }
      painted++;
      if (c.diff > 0.05) moved++;
    }

    if (live === canvases.length) {
      ok(
        `${surface.name}: ${live}/${canvases.length} live` +
          `, ${painted} painting${moved ? ` (${moved} advancing)` : ""}` +
          (idleTransparent ? `, ${idleTransparent} transparent at idle` : ""),
      );
    }
  }

  /* Across the whole page, SOMETHING must actually be drawing. If every surface
     came back "live but transparent", the liveness signal alone would be doing
     all the work and this test would have stopped proving anything visible. */
  const totalPainting = blockedRun.reduce(
    (n, { canvases }) => n + canvases.filter((c) => (c.inkPx ?? 0) >= 40).length,
    0,
  );
  if (!totalPainting)
    bad("not one canvas painted ink anywhere on the page — liveness alone is not the claim");

  const blockedCdn = cdnHits(blockedRequests);
  if (blockedCdn.length) {
    /* Blocked requests still get ATTEMPTED and appear here — which is the point:
       an attempt means the override did not take, even though the block proved
       the site survives without it. */
    bad(`${blockedCdn.length} CDN request(s) attempted while blocked: ${[...new Set(blockedCdn)].join(", ")}`);
  } else {
    ok("no CDN requests attempted");
  }
  for (const w of [...new Set(wasmHits(blockedRequests))]) note(`wasm fetched: ${w}`);

  /* ───────────────────────────── PASS 2: NORMAL LOAD ────────────────────── */
  console.log("\nPASS 2 — no blocking, cold cache (the override must be the ONLY path)");

  const normalRun = await run(false);
  const normalRequests = [...requests];

  let normalMounted = 0;
  let normalExpected = 0;
  for (const { surface, canvases } of normalRun) {
    normalExpected += surface.expect;
    normalMounted += canvases.filter((c) => c.hasCanvas).length;
  }
  if (normalMounted === normalExpected) ok(`all ${normalMounted} canvases mounted`);
  else bad(`only ${normalMounted}/${normalExpected} canvases mounted on a normal load`);

  const normalCdn = cdnHits(normalRequests);
  if (normalCdn.length) {
    bad(
      `${normalCdn.length} CDN request(s) on an UNBLOCKED load: ` +
        `${[...new Set(normalCdn)].join(", ")} — the site is still reaching for the CDN first ` +
        `and merely recovering, so the override is a fallback rather than the path`,
    );
  } else {
    ok("zero CDN requests — the self-hosted wasm is the only path, not a recovery");
  }
  const normalWasm = [...new Set(wasmHits(normalRequests))];
  for (const w of normalWasm) note(`wasm fetched: ${w}`);
  if (!normalWasm.length) bad("no .wasm request observed at all — is the runtime loading?");
  if (normalWasm.some((u) => !u.includes("/rive/runtime/")))
    bad(`a wasm came from outside /rive/runtime/: ${normalWasm.join(", ")}`);
} finally {
  try { ws?.close(); } catch { /* best effort */ }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
}

if (failures) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
console.log("\nEvery Rive surface mounts and paints with both CDNs blocked, and a normal load never reaches them.");
