/**
 * Answers one question about an encoded image: does it actually have pixels?
 *
 * WHY THIS IS A MODULE AND NOT AN ASSERTION: `sips` writes AVIF files that
 * report correct dimensions, read back fine under `sips -g`, and resolve
 * `img.decode()` without error — while painting fully transparent in Chrome.
 * A poster converted that way is invisible on the site and nothing in the build
 * can tell. Decoding successfully is not the same as having pixels, so the only
 * trustworthy check is to draw the thing and read the buffer back.
 *
 * Chrome does the decoding because macOS ships no ImageMagick, no ffmpeg and no
 * PIL — and because Chrome is the decoder that actually matters here.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {Array<{label: string, buffer: Buffer, mime: string}>} images
 * @returns {Promise<Array<{label, width, height, meanLuma, meanAlpha, blank}>>}
 */
export async function verifyPixels(images) {
  const html = `<!doctype html><meta charset=utf-8><body>${images
    .map(
      (i) =>
        `<img src="data:${i.mime};base64,${i.buffer.toString("base64")}">`,
    )
    .join("")}`;

  const server = createServer((_, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const profile = mkdtempSync(join(tmpdir(), "verify-px-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

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

    const target = await (
      await fetch(
        `http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`,
        { method: "PUT" },
      )
    ).json();

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok, no) => {
      ws.onopen = ok;
      ws.onerror = () => no(new Error("could not attach to Chrome"));
    });

    let id = 0;
    const pending = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
    };
    const evaluate = async (expression) => {
      const i = ++id;
      const r = await new Promise((resolve, reject) => {
        pending.set(i, { resolve, reject });
        ws.send(
          JSON.stringify({
            id: i,
            method: "Runtime.evaluate",
            params: { expression, awaitPromise: true, returnByValue: true },
          }),
        );
      });
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
      }
      return r.result.value;
    };

    /* Wait for the document to actually contain the images before measuring.
       Without this the check is a race: one small image happened to be parsed
       by the time the first evaluate landed, but a batch of 27 was not, so
       `document.images` came back empty and EVERY image was reported blank.
       Failing closed is the right direction for a bug like that, but a gate
       that blocks a correct harvest is still broken. */
    for (let i = 0; i < 80; i++) {
      const ready = await evaluate(
        `document.images.length === ${images.length} &&
         [...document.images].every((im) => im.complete)`,
      );
      if (ready) break;
      await sleep(100);
    }

    const stats = await evaluate(`(async () => {
      const out = [];
      for (const im of document.images) {
        try { await im.decode(); } catch { out.push(null); continue; }
        const c = document.createElement("canvas");
        c.width = 160; c.height = 90;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(im, 0, 0, 160, 90);
        const d = x.getImageData(0, 0, 160, 90).data;
        let lum = 0, alpha = 0;
        for (let i = 0; i < d.length; i += 4) {
          lum += (d[i] + d[i+1] + d[i+2]) / 3;
          alpha += d[i+3];
        }
        const n = d.length / 4;
        out.push({ w: im.naturalWidth, h: im.naturalHeight, lum: lum / n, alpha: alpha / n });
      }
      return out;
    })()`);

    return images.map((img, i) => {
      const s = stats[i];
      if (!s) {
        return { label: img.label, width: 0, height: 0, meanLuma: 0, meanAlpha: 0, blank: true };
      }
      return {
        label: img.label,
        width: s.w,
        height: s.h,
        meanLuma: Number(s.lum.toFixed(1)),
        meanAlpha: Number(s.alpha.toFixed(1)),
        /* Transparent OR uniformly black both mean "nothing will be visible".
           Real posters in this repo read 6.4–234 mean luma. */
        blank: s.alpha < 1 || s.lum < 1,
      };
    });
  } finally {
    chrome.kill();
    server.close();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* Chrome may still be writing to its profile; the OS will reap /tmp. */
    }
  }
}
