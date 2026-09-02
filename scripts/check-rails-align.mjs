#!/usr/bin/env node
/**
 * check-rails-align.mjs — pins the AudienceRails glyphs centred over their copy.
 *
 *   npm run dev                # in another shell
 *   npm run check:rails
 *
 * WHY THIS IS NOT A VITEST TEST: jsdom does not lay anything out, so
 * getBoundingClientRect() there returns zeros and an assertion about horizontal
 * centres would pass against a component that renders every glyph in the wrong
 * place. The unit suite pins the CSS CONTRACT (that the glyph carries
 * `align-self`, so the rail's flex-start cannot pin it left again); only a real
 * engine can pin the RESULT. Same split, and the same reason, as
 * scripts/render-check.mjs.
 *
 * Not wired into CI: it needs a real Chrome and a running dev server. It is the
 * local gate before shipping a change to the rails' layout.
 *
 * THE MEASUREMENT: for each rail, |centre(glyph) − centre(copy block)| ≤ 1px, at
 * 1280, 1440 and 1680. The copy block is the union of the marker, headline, body
 * and link — the text the drawing is meant to sit over.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { previewAuthHeaders } from "./lib/preview-auth.mjs";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const urlArg = args.indexOf("--url");
const URL_ = urlArg >= 0 ? args[urlArg + 1] : "http://localhost:5173/";
const WIDTHS = [1280, 1440, 1680];
const TOLERANCE = 1; // px
const EXPECTED_RAILS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const bad = (m) => {
  failures++;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const profile = mkdtempSync(join(tmpdir(), "rails-align-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    // The glyphs are Rive/WebGL2; headless has no GPU, so run on SwiftShader.
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);

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
  ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("could not attach to Chrome"));
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
      throw new Error(
        r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails),
      );
    return r.result.value;
  };

  await send("Page.enable");
  /* A protected Vercel preview answers a headless browser with a login page, so
     every assertion after this would measure Vercel's auth screen. Empty against
     localhost and against unprotected production. */
  const __auth = previewAuthHeaders();
  if (Object.keys(__auth).length) {
    await send("Network.enable");
    await send("Network.setExtraHTTPHeaders", { headers: __auth });
  }
  await send("Runtime.enable");

  console.log(`AudienceRails glyph centring — ${URL_}\n`);

  for (const width of WIDTHS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", { url: URL_ });
    await sleep(3000);
    const scrolled = await evaluate(`
      (() => {
        const s = document.querySelector('.audience-rails');
        if (!s) return 'missing';
        s.scrollIntoView({ block: 'center' });
        return 'ok';
      })()
    `);
    if (scrolled !== "ok") {
      bad(`${width}px — no .audience-rails section on the page`);
      continue;
    }
    await sleep(1200);

    const rails = await evaluate(`
      (() => {
        const rails = [...document.querySelectorAll('.audience-rails__rail')];
        return rails.map((rail, i) => {
          const glyph = rail.querySelector('.audience-glyph');
          const copy = [...rail.querySelectorAll(
            '.audience-rails__marker,.audience-rails__headline,.audience-rails__body,.text-link'
          )];
          if (!glyph || !copy.length) return { index: i, missing: true };
          const g = glyph.getBoundingClientRect();
          const left = Math.min(...copy.map((el) => el.getBoundingClientRect().left));
          const right = Math.max(...copy.map((el) => el.getBoundingClientRect().right));
          return {
            index: i,
            glyphCentre: (g.left + g.right) / 2,
            glyphWidth: g.width,
            copyCentre: (left + right) / 2,
            copyWidth: right - left,
          };
        });
      })()
    `);

    console.log(`${width}px`);
    if (!Array.isArray(rails) || rails.length !== EXPECTED_RAILS) {
      bad(`${width}px — expected ${EXPECTED_RAILS} rails, found ${rails?.length ?? 0}`);
      continue;
    }

    for (const r of rails) {
      if (r.missing) {
        bad(`rail ${r.index} — no glyph or no copy block to measure`);
        continue;
      }
      /* A zero-width glyph would centre "perfectly" while being invisible, and a
         zero-width copy block would make the target meaningless. Refuse both
         rather than reporting a pass against nothing. */
      if (!(r.glyphWidth > 0) || !(r.copyWidth > 0)) {
        bad(
          `rail ${r.index} — degenerate geometry (glyph ${r.glyphWidth}px, copy ` +
            `${r.copyWidth}px); a centring result here would be meaningless`,
        );
        continue;
      }
      const delta = r.glyphCentre - r.copyCentre;
      const line =
        `rail ${r.index} — glyph centre ${r.glyphCentre.toFixed(2)}, copy centre ` +
        `${r.copyCentre.toFixed(2)}, Δ ${delta.toFixed(2)}px`;
      Math.abs(delta) <= TOLERANCE ? ok(line) : bad(`${line} — exceeds ±${TOLERANCE}px`);
    }
    console.log("");
  }
} finally {
  try {
    ws?.close();
  } catch {
    /* best effort */
  }
  chrome.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

if (failures) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
console.log("All rails centred within ±1px at 1280/1440/1680.");
