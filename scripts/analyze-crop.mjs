#!/usr/bin/env node
/**
 * Finds the `object-position` that keeps the most of an image's subject inside a
 * crop that is much wider than the source.
 *
 * WHY: the CaseStudies poster slot is 1248 x 380 (~3.3:1) and the sources are
 * 16:9, so `object-fit: cover` throws away nearly half of every poster's height.
 * Centre is a guess. This reads the actual pixels, finds where the subject sits,
 * and does the row arithmetic — the method used to anchor the Brilliant poster
 * low, made repeatable because a third poster will need it too.
 *
 * Pixels are read through headless Chrome because macOS ships no ImageMagick,
 * no ffmpeg and no PIL, and Chrome decodes every format the browser will
 * actually render — including the AVIF we ship.
 *
 * Usage:
 *   node scripts/analyze-crop.mjs <image> [--slot 1248x380] [--bands 20]
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";

const args = process.argv.slice(2);
/** `indexOf` returns -1 when a flag is absent, and args[-1 + 1] is args[0] — the
    image path — so read the value only when the flag is genuinely present. */
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const imagePath = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const slotArg = flag("--slot", "1248x380");
const bands = Number(flag("--bands", "20"));
const [SLOT_W, SLOT_H] = slotArg.split("x").map(Number);

if (!imagePath) {
  console.error("usage: node scripts/analyze-crop.mjs <image> [--slot WxH]");
  process.exit(2);
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".avif": "image/avif", ".webp": "image/webp" };
const bytes = readFileSync(imagePath);

const server = createServer((req, res) => {
  if (req.url === "/img") {
    res.writeHead(200, { "content-type": MIME[extname(imagePath).toLowerCase()] ?? "application/octet-stream" });
    res.end(bytes);
  } else {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><meta charset=utf-8><title>crop</title>");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(join(tmpdir(), "crop-"));
const chrome = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
   "--no-first-run", "--no-default-browser-check", "about:blank"],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanup = () => {
  chrome.kill();
  server.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
};

try {
  let port;
  for (let i = 0; i < 60 && !port; i++) {
    try { port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0].trim(); }
    catch { await sleep(250); }
  }
  if (!port) throw new Error("Chrome never reported a DevTools port");

  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error("attach failed")); });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  const evaluate = async (expression) => {
    const i = ++id;
    const r = await new Promise((resolve, reject) => {
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    return r.result.value;
  };

  /* Per-row DETAIL, measured as local contrast (total variation), not as
     departure from a background colour.

     The naive "how far is this pixel from the dominant colour" metric is wrong
     for posters: on the Spotify poster it scored the flat green backdrop as pure
     subject and recommended a crop full of empty background. Edge energy scores
     what a viewer actually reads as content — type, faces, album art, UI chrome —
     and scores flat fields near zero regardless of their colour. */
  const data = await evaluate(`(async () => {
    const img = new Image();
    img.src = "${origin}/img";
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data: px, width: W, height: H } = ctx.getImageData(0, 0, c.width, c.height);

    const luma = (i) => 0.2126 * px[i] + 0.7152 * px[i+1] + 0.0722 * px[i+2];
    const rows = new Float64Array(H);
    for (let y = 0; y < H - 1; y++) {
      let sum = 0;
      for (let x = 0; x < W - 1; x++) {
        const i = (y * W + x) * 4;
        const l = luma(i);
        sum += Math.abs(l - luma(i + 4)) + Math.abs(l - luma(i + W * 4));
      }
      rows[y] = sum;
    }
    rows[H - 1] = rows[H - 2] ?? 0;
    return { W, H, rows: Array.from(rows) };
  })()`);

  const { W, H, rows } = data;
  const total = rows.reduce((a, b) => a + b, 0);

  /* cover: the image scales so its width fills the slot; we see a horizontal
     band of it. How many SOURCE rows survive: */
  const scale = SLOT_W / W;
  const visibleSrcRows = Math.min(H, Math.round(SLOT_H / scale));
  const travel = H - visibleSrcRows; // source rows of vertical freedom

  console.log(`${imagePath}`);
  console.log(`  source        ${W} x ${H}`);
  console.log(`  slot          ${SLOT_W} x ${SLOT_H}  (${(SLOT_W / SLOT_H).toFixed(2)}:1)`);
  console.log(`  visible band  ${visibleSrcRows} of ${H} source rows (${((visibleSrcRows / H) * 100).toFixed(1)}%)`);
  if (travel <= 0) {
    console.log("  no vertical freedom — nothing to choose.");
  } else {
    console.log(`  crop travel   ${travel} source rows\n`);

    console.log(`  subject mass by band (${bands} bands, top to bottom):`);
    const per = H / bands;
    for (let b = 0; b < bands; b++) {
      const from = Math.floor(b * per), to = Math.floor((b + 1) * per);
      const mass = rows.slice(from, to).reduce((a, x) => a + x, 0) / total;
      const bar = "█".repeat(Math.round(mass * bands * 30));
      console.log(`    rows ${String(from).padStart(4)}–${String(to).padStart(4)}  ${(mass * 100).toFixed(1).padStart(5)}%  ${bar}`);
    }

    // Best anchor: maximise captured subject mass over the visible window.
    let bestPct = 0, bestCaptured = -1;
    const captured = (pct) => {
      const top = Math.round(travel * (pct / 100));
      return rows.slice(top, top + visibleSrcRows).reduce((a, x) => a + x, 0) / total;
    };
    for (let pct = 0; pct <= 100; pct++) {
      const c = captured(pct);
      if (c > bestCaptured) { bestCaptured = c; bestPct = pct; }
    }

    /* The mass optimum is often within a point or two of centre, because posters
       are usually composed to fill the frame. When that is true the number does
       not decide anything — look at the candidates and judge the composition.
       `--at` reports a specific anchor so a chosen crop can still be recorded. */
    const at = flag("--at", null);
    if (at !== null) {
      const pct = Number(at);
      const top = Math.round((travel * pct) / 100);
      console.log(`\n  AT     (${String(pct).padStart(2)}%)  captures ${(captured(pct) * 100).toFixed(1)}%  → rows ${top}–${top + visibleSrcRows}`);
    }
    console.log(`\n  centre (50%)  captures ${(captured(50) * 100).toFixed(1)}%  → rows ${Math.round(travel * 0.5)}–${Math.round(travel * 0.5) + visibleSrcRows}`);
    console.log(`  BEST   (${String(bestPct).padStart(2)}%)  captures ${(bestCaptured * 100).toFixed(1)}%  → rows ${Math.round(travel * bestPct / 100)}–${Math.round(travel * bestPct / 100) + visibleSrcRows}`);
    console.log(`\n  objectPosition: "center ${bestPct}%"`);
  }
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
} finally {
  cleanup();
}
