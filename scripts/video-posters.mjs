#!/usr/bin/env node
/**
 * Grabs one frame out of each bento tile video and encodes it as the tile's
 * poster: the still a `prefers-reduced-motion` visitor sees instead of the loop,
 * and what the `<video>` paints before its first frame arrives.
 *
 * WHY CHROME AND NOT ffmpeg: macOS ships no ffmpeg, no ImageMagick and no PIL —
 * the same finding scripts/lib/verify-pixels.mjs already records. Chrome is the
 * decoder that is actually installed, and it is also the decoder that matters,
 * since it is the one that will paint these posters on the site. sharp does the
 * encoding for the same reason convert-poster.mjs uses it: `sips` writes AVIF
 * that reports correct dimensions, decodes without error, and paints fully
 * transparent. Decoding successfully is not the same as having pixels, so every
 * poster here is drawn in a real browser and read back before it is written.
 *
 * TWO MEASURED BROWSER BEHAVIOURS THIS SCRIPT IS BUILT AROUND:
 *
 * 1. Seeking a PAUSED video does not update what drawImage sees in headless
 *    Chrome. Sampling four timestamps that way returned four identical frames
 *    (identical meanLuma to one decimal, per clip). The clip must be PLAYED and
 *    sampled on a timer. requestVideoFrameCallback after a seek does not fix it
 *    either — it fires, and still hands back frame 0.
 * 2. Frame 0 is not automatically a good poster. product-ui opens on a
 *    switched-OFF smart display: a t=0 grab is a black rectangle, which is a
 *    dead tile for exactly the visitors the poster exists for. Timestamps are
 *    therefore chosen per clip by looking at candidates — the same discipline
 *    analyze-crop.mjs documents for the case-study posters.
 *
 * Usage:  npm run posters:video
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { verifyPixels } from "./lib/verify-pixels.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DIR = new URL("../public/video/use-cases/", import.meta.url).pathname;
const OUT = new URL("../public/video/use-cases/posters/", import.meta.url)
  .pathname;

/**
 * Per-clip grab point, in seconds. Chosen by looking at rendered candidates,
 * not by a rule — see the header note about product-ui.
 *
 * campaigns.mp4 is deliberately absent: its tile is not wired (the Spotify
 * Wrapped clip would reverse the Strava re-anchor recorded in the spec's
 * Decision log), so generating a poster for it would imply otherwise. The .mp4
 * stays downloaded so the decision is reversible without a re-fetch.
 */
const GRABS = [
  { file: "product-ui.mp4", at: 1.9 }, // device lit; t=0 is the screen OFF
  { file: "game-ui.mp4", at: 0.1 },
  { file: "websites.mp4", at: 0.1 },
  { file: "automotive.mp4", at: 2.6 }, // cluster fully booted
  { file: "film-tv.mp4", at: 0.1 },
];

/* Tile posters sit in a few-hundred-px slot, so they get a tighter class than
   the 135 kB case-study posters. Quality steps down to stay inside it. */
const MAX_BYTES = 60_000;
const START_QUALITY = 55;
const MIN_QUALITY = 30;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 1. decode the frames in Chrome ─────────────────────────────────────── */

async function grabFrames() {
  const present = new Set(readdirSync(DIR));
  const missing = GRABS.filter((g) => !present.has(g.file)).map((g) => g.file);
  if (missing.length) {
    console.error(`missing source videos: ${missing.join(", ")}`);
    process.exit(1);
  }

  const server = createServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><meta charset=utf-8><body></body>");
      return;
    }
    try {
      const buf = readFileSync(join(DIR, decodeURIComponent(req.url.slice(1))));
      res.writeHead(200, { "content-type": "video/mp4" });
      res.end(buf);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const profile = mkdtempSync(join(tmpdir(), "tile-posters-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      /* The clips must actually play to be sampled — see header note 1. */
      "--autoplay-policy=no-user-gesture-required",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const cleanup = () => {
    chrome.kill();
    server.close();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  };

  try {
    let port;
    for (let i = 0; i < 80 && !port; i++) {
      try {
        port = readFileSync(join(profile, "DevToolsActivePort"), "utf8")
          .split("\n")[0]
          .trim();
      } catch {
        await sleep(250);
      }
    }
    if (!port) throw new Error("Chrome never reported a DevTools port");

    const targets = await (
      await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    const page = targets.find((t) => t.type === "page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));

    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    };
    const send = (method, params) =>
      new Promise((resolve) => {
        const mid = ++id;
        pending.set(mid, resolve);
        ws.send(JSON.stringify({ id: mid, method, params }));
      });

    await send("Page.navigate", { url: `${origin}/` });
    await sleep(500);

    const expression = `
      (async () => {
        const grabs = ${JSON.stringify(GRABS)};
        const out = [];
        for (const g of grabs) {
          const v = document.createElement("video");
          v.src = "/" + g.file;
          v.muted = true;
          v.playsInline = true;
          v.preload = "auto";
          document.body.appendChild(v);
          await new Promise((res, rej) => {
            v.onloadedmetadata = res;
            v.onerror = () => rej(new Error("load failed: " + g.file));
            setTimeout(res, 10000);
          });
          /* Play and sample on a timer. Seeking while paused hands back frame 0
             every time in headless Chrome — see the header note. */
          v.currentTime = 0;
          await v.play();
          const target = Math.min(g.at, Math.max(0, v.duration - 0.1));
          const until = Date.now() + Math.max(0, (target - v.currentTime) * 1000);
          while (Date.now() < until) await new Promise((r) => setTimeout(r, 25));
          const c = document.createElement("canvas");
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          c.getContext("2d").drawImage(v, 0, 0);
          out.push({
            file: g.file,
            at: v.currentTime,
            width: c.width,
            height: c.height,
            png: c.toDataURL("image/png"),
          });
          v.pause();
          v.remove();
        }
        return JSON.stringify(out);
      })()
    `;

    const res = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.result?.exceptionDetails) {
      throw new Error(
        res.result.exceptionDetails.exception?.description ?? "frame grab threw",
      );
    }
    return JSON.parse(res.result.result.value).map((f) => ({
      ...f,
      buffer: Buffer.from(f.png.split(",")[1], "base64"),
    }));
  } finally {
    cleanup();
  }
}

/* ── 2. encode, verify, write ───────────────────────────────────────────── */

const frames = await grabFrames();
mkdirSync(OUT, { recursive: true });

let failures = 0;

for (const frame of frames) {
  const name = frame.file.replace(/\.mp4$/, ".avif");

  let quality = START_QUALITY;
  let encoded = await sharp(frame.buffer).avif({ quality }).toBuffer();
  while (encoded.byteLength > MAX_BYTES && quality > MIN_QUALITY) {
    quality -= 5;
    console.log(
      `  ${name}: ${(encoded.byteLength / 1024).toFixed(1)} kB over class, retrying at q${quality}`,
    );
    encoded = await sharp(frame.buffer).avif({ quality }).toBuffer();
  }

  /* The point of the script, not a formality: draw the ENCODED bytes in a real
     browser and read the pixels back. An invisible poster fails here instead of
     landing in git. */
  const [pixels] = await verifyPixels([
    { label: name, buffer: encoded, mime: "image/avif" },
  ]);

  if (pixels.blank) {
    console.error(
      `✗ ${name}: encoded to a BLANK image (meanLuma ${pixels.meanLuma}, meanAlpha ${pixels.meanAlpha}) — not written`,
    );
    failures++;
    continue;
  }

  writeFileSync(join(OUT, name), encoded);
  console.log(
    `✓ ${name}  @${frame.at.toFixed(2)}s  ${frame.width}×${frame.height}  q${quality}  ` +
      `${(encoded.byteLength / 1024).toFixed(1)} kB  meanLuma ${pixels.meanLuma}`,
  );
}

if (failures) {
  console.error(`\n${failures} poster(s) failed verification.`);
  process.exit(1);
}
console.log(`\n${frames.length} posters written to public/video/use-cases/posters/`);
