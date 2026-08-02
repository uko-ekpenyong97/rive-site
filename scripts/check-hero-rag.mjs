#!/usr/bin/env node
/**
 * Pins the hero headline's RAG — the actual rendered line breaks.
 *
 *   npm run dev            # in another shell
 *   npm run check:rag
 *
 * WHY THIS CANNOT BE A UNIT TEST: the Vitest suite runs in jsdom, which has no
 * font and no shaper, so it has no concept of a line box. `.hero__title` returns
 * one unbroken string there no matter what `max-width` says. The rag is only
 * knowable in a browser with Tomorrow actually loaded, which is exactly the
 * class of thing check:rails and check:render already exist for.
 *
 * HOW IT READS LINES: a Range over each word, grouped by the top edge of its
 * client rect. That is the shaper's own answer — not a re-implementation of line
 * breaking, and not a pixel diff that would also fire on an unrelated colour
 * change. `text-transform: uppercase` is a rendering transform, so the DOM text
 * stays sentence-case and the comparison is case-insensitive.
 *
 * The target rag is owner-approved (2026-08-01): four near-equal lines, no wide
 * second line. Both halves of the mechanism are pinned here — the line count and
 * each line's first word — because either one alone would pass on a rag that is
 * four lines of the wrong shape.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const urlArg = args.indexOf("--url");
const URL_ = urlArg >= 0 ? args[urlArg + 1] : "http://localhost:5173/";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTHS = [1280, 1440, 1680];

/** The approved rag. Compared as first-word-per-line plus the line count. */
const TARGET = [
  "INTERACTIVE",
  "GRAPHICS THAT",
  "SHIP STRAIGHT",
  "TO PRODUCTION",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "hero-rag-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    /* The hero mounts Rive CTAs; headless has no GPU. Without SwiftShader the
       page can throw before layout settles and the rag would be measured on a
       half-built hero. */
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const cleanup = () => {
  chrome.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
};

let failures = 0;
const bad = (m) => {
  failures++;
  console.error(`  ✗ ${m}`);
};

const READ_RAG = `(() => {
  const h1 = document.querySelector('.hero__title');
  if (!h1) return { error: 'no .hero__title in the document' };
  const node = h1.firstChild;
  if (!node || node.nodeType !== 3) return { error: 'the h1 has no text node' };
  const text = node.textContent;
  const words = [];
  for (const m of text.matchAll(/\\S+/g))
    words.push({ w: m[0], s: m.index, e: m.index + m[0].length });
  if (!words.length) return { error: 'the h1 text node is empty' };

  const lines = [];
  for (const w of words) {
    const r = document.createRange();
    r.setStart(node, w.s);
    r.setEnd(node, w.e);
    const b = r.getBoundingClientRect();
    if (!b.width && !b.height) return { error: 'word "' + w.w + '" has no client rect' };
    const line = lines.find((l) => Math.abs(l.top - b.top) < 4);
    if (line) {
      line.words.push(w.w);
      line.left = Math.min(line.left, b.left);
      line.right = Math.max(line.right, b.right);
    } else lines.push({ top: b.top, left: b.left, right: b.right, words: [w.w] });
  }
  lines.sort((a, b) => a.top - b.top);
  const cs = getComputedStyle(h1);
  const box = h1.getBoundingClientRect();
  return {
    fontSize: cs.fontSize,
    maxWidth: cs.maxWidth,
    textWrap: cs.textWrapStyle || cs.textWrap || '',
    blockH: +box.height.toFixed(1),
    lines: lines.map((l) => ({
      text: l.words.join(' ').toUpperCase(),
      w: +(l.right - l.left).toFixed(1),
    })),
  };
})()`;

async function devtoolsPort() {
  for (let i = 0; i < 80; i++) {
    try {
      const p = readFileSync(join(profile, "DevToolsActivePort"), "utf8")
        .split("\n")[0]
        .trim();
      if (p) return p;
    } catch {
      /* not written yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome never reported a DevTools port");
}

let ws;
try {
  const port = await devtoolsPort();
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
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
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    return r.result.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");

  console.log(`hero rag → ${URL_}\ntarget: ${TARGET.join(" / ")}\n`);

  for (const width of WIDTHS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", { url: URL_ });
    await sleep(2200);
    /* The face decides the rag, so measuring before it loads measures the
       fallback font's line breaking — a different question with a plausible
       answer. */
    await evaluate("document.fonts.ready");
    await sleep(400);

    const r = await evaluate(READ_RAG);
    console.log(`${width}px  (font ${r.fontSize ?? "?"}, max-width ${r.maxWidth ?? "?"})`);

    /* Fail closed. A hero that did not render at all must not read as a pass —
       the same rule the pixel probes follow about blank baselines. */
    if (!r || r.error) {
      bad(`${width}px — could not measure the headline: ${r?.error ?? "no result"}`);
      continue;
    }
    if (r.lines.length !== TARGET.length) {
      bad(
        `${width}px — ${r.lines.length} lines, expected ${TARGET.length}: ` +
          r.lines.map((l) => l.text).join(" / "),
      );
      continue;
    }

    let ok = true;
    for (let i = 0; i < TARGET.length; i++) {
      const want = TARGET[i].split(" ")[0];
      const got = r.lines[i].text.split(" ")[0];
      if (want !== got) {
        bad(`${width}px — line ${i + 1} starts "${got}", expected "${want}"`);
        ok = false;
      }
    }
    if (ok) {
      const widths = r.lines.map((l) => l.w);
      const spread = Math.max(...widths) - Math.min(...widths);
      for (const l of r.lines) console.log(`  ✓ ${l.text.padEnd(15)} ${l.w}px`);
      console.log(
        `    4 lines · block ${r.blockH}px · widest−narrowest ${spread.toFixed(1)}px\n`,
      );
    } else console.log("");
  }

  if (failures) {
    console.error(`\n✗ hero rag: ${failures} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log("✓ hero rag matches the approved four-line break at all three widths");
  }
} catch (err) {
  console.error(`\n✗ hero rag check could not run: ${err.message}`);
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {
    /* best effort */
  }
  cleanup();
}
