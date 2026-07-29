#!/usr/bin/env node
/**
 * Headless render check for the AudienceRails glyphs.
 *
 * WHY: the probe proves each .riv contains the artboard its config asks for, and
 * the Vitest suite proves the config is internally consistent — but both run
 * against a mocked or static world. Neither can answer "did three canvases
 * actually come up on the page". When this section shipped broken, that question
 * was never asked: rendering nothing looks exactly like rendering nothing on
 * purpose, so the absence went unobserved rather than unnoticed.
 *
 * This asks it. Run against the DEV server, not preview — the component's
 * load-failure warning is stripped from production builds, and catching that
 * warning is half the value here.
 *
 *   npm run dev            # in another shell
 *   node scripts/render-check.mjs --url http://localhost:5173
 *
 * Not wired into CI: it needs a real Chrome and a running server. It is the
 * local gate before shipping a change to any Rive surface.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const urlArg = args.indexOf("--url");
const URL_ = urlArg >= 0 ? args[urlArg + 1] : "http://localhost:5173";

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const profile = mkdtempSync(join(tmpdir(), "rive-render-check-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    // Rive needs WebGL2; headless has no GPU, so run it on SwiftShader.
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanup = () => {
  chrome.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
};

async function devtoolsPort() {
  for (let i = 0; i < 60; i++) {
    try {
      const raw = readFileSync(join(profile, "DevToolsActivePort"), "utf8");
      const port = raw.split("\n")[0].trim();
      if (port) return port;
    } catch {
      /* not written yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome never reported a DevTools port");
}

let failures = 0;
const bad = (m) => {
  failures++;
  console.error(`  ✗ ${m}`);
};
const good = (m) => console.log(`  ✓ ${m}`);

try {
  const port = await devtoolsPort();
  const target = await (
    await fetch(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent(URL_)}`,
      { method: "PUT" },
    )
  ).json();

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.onopen = ok;
    ws.onerror = () => no(new Error("could not attach to the page"));
  });

  let id = 0;
  const pending = new Map();
  const consoleWarnings = [];

  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      return;
    }
    if (m.method === "Runtime.consoleAPICalled") {
      const txt = (m.params.args ?? [])
        .map((a) => a.value ?? a.description ?? "")
        .join(" ");
      if (["warning", "error"].includes(m.params.type)) consoleWarnings.push(txt);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    }
    return r.result.value;
  };

  await send("Runtime.enable");

  // The section is below the fold and the glyphs are gated on approach, so
  // scroll it into view and give the observer + fetch + first frame time to land.
  console.log(`Loading ${URL_}\n`);
  for (let i = 0; i < 60; i++) {
    if (await evaluate("!!document.querySelector('.audience-rails')")) break;
    await sleep(500);
  }
  await evaluate(
    "document.querySelector('.audience-rails')?.scrollIntoView({block:'center'})",
  );
  await sleep(3000);

  const seen = await evaluate(`(() => {
    const hosts = [...document.querySelectorAll('.audience-glyph')];
    return {
      rails: document.querySelectorAll('.audience-rails__rail').length,
      hosts: hosts.length,
      canvases: hosts.map(h => {
        const c = h.querySelector('canvas');
        return c ? { w: c.width, h: c.height, hidden: h.getAttribute('aria-hidden') } : null;
      }),
    };
  })()`);

  seen.rails === 3
    ? good(`3 rails on the page`)
    : bad(`expected 3 rails, found ${seen.rails}`);

  /* The failure path removes the host entirely, so a missing host IS the bug
     that shipped — three hosts is the assertion that it did not recur. */
  seen.hosts === 3
    ? good(`3 glyph hosts present (none removed by the failure path)`)
    : bad(`expected 3 glyph hosts, found ${seen.hosts} — a glyph failed to load`);

  seen.canvases.forEach((c, i) => {
    if (!c) return bad(`glyph ${i + 1}: no canvas element`);
    if (c.w > 0 && c.h > 0) good(`glyph ${i + 1}: backing store ${c.w}x${c.h}`);
    else bad(`glyph ${i + 1}: empty backing store (${c.w}x${c.h})`);
    if (c.hidden !== "true") bad(`glyph ${i + 1}: host is not aria-hidden`);
  });

  const loadFailures = consoleWarnings.filter((w) =>
    w.includes("[AudienceGlyph]"),
  );
  loadFailures.length === 0
    ? good("no glyph load failures reported")
    : loadFailures.forEach((w) => bad(w));

  /* ── StatsBand digit roll ───────────────────────────────────────────────
     The digit animations run on the Web Animations API, so their in-flight
     values never touch the style attribute and a unit test cannot see them.
     What a unit test also cannot see is whether they SETTLED — a spring that
     overshoots and never returns, or a fill that leaves a digit at opacity 0,
     would look exactly like a passing test suite. Only a real browser can say.

     This deliberately asserts the settled state and nothing mid-flight. */
  console.log("");
  await evaluate(
    "document.querySelector('.stats-band')?.scrollIntoView({block:'center'})",
  );
  /* The count runs ~1200ms for the two big stats, then the last roll needs its
     150ms. Waiting well past that is the point: this asserts the SETTLED state,
     and a spring that never returns or a fill that strands a digit at opacity 0
     would look exactly like a passing unit suite. */
  await sleep(2500);

  const stats = await evaluate(`(() => {
    const chars = [...document.querySelectorAll('.stats-band__char')];
    return {
      slots: document.querySelectorAll('.stats-band__slot').length,
      chars: chars.length,
      // Only the visible layer of each slot — leaving layers are aria-hidden.
      values: [...document.querySelectorAll('.stats-band__digits')]
        .map((d) => [...d.querySelectorAll('.stats-band__slot')]
          .map((s) => {
            const layers = s.querySelectorAll('.stats-band__char');
            return layers[layers.length - 1]?.textContent ?? '';
          }).join('')),
      suffixes: [...document.querySelectorAll('.stats-band__slot--suffix')]
        .map((s) => {
          const layers = s.querySelectorAll('.stats-band__char');
          return layers[layers.length - 1]?.textContent ?? '';
        }),
      unsettled: chars
        .map((c, i) => {
          const s = getComputedStyle(c);
          const opacity = Number(s.opacity);
          const blurred = s.filter !== 'none' && !/blur\\(0px\\)/.test(s.filter);
          return { i, text: c.textContent, opacity, filter: s.filter, blurred };
        })
        .filter((c) => c.opacity < 0.99 || c.blurred),
      // Sizers are aria-hidden and intentionally invisible; exclude them.
      clipped: [...document.querySelectorAll('.stats-band__slot')]
        .filter((s) => getComputedStyle(s).overflow !== 'visible').length,
      value: document.querySelector('.stats-band__value')?.textContent ?? '',
    };
  })()`);

  stats.chars > 0
    ? good(`StatsBand: ${stats.chars} character slots rendered`)
    : bad("StatsBand: no character slots found");

  /* Off-by-one in a tick schedule is the classic failure here: the count runs,
     it looks right, and it stops on 119. Assert the exact landings. */
  const WANT = ["4", "90", "2", "120"];
  const WANT_SUFFIX = ["×", "%", "×", "fps"];
  JSON.stringify(stats.values) === JSON.stringify(WANT)
    ? good(`StatsBand: counts landed exactly on ${WANT.join(", ")}`)
    : bad(
        `StatsBand: counts landed on [${stats.values.join(", ")}], wanted [${WANT.join(", ")}]`,
      );
  JSON.stringify(stats.suffixes) === JSON.stringify(WANT_SUFFIX)
    ? good("StatsBand: suffixes intact")
    : bad(`StatsBand: suffixes are [${stats.suffixes.join(", ")}]`);

  stats.unsettled.length === 0
    ? good("StatsBand: every digit settled (opacity 1, no blur)")
    : stats.unsettled.forEach((c) =>
        bad(
          `StatsBand: digit ${c.i} ("${c.text}") unsettled — opacity ${c.opacity}, filter ${c.filter}`,
        ),
      );

  /* The blur has to breathe past the cell; a clipped slot turns the roll into
     a hard-edged wipe. */
  stats.clipped === 0
    ? good("StatsBand: no slot clips its blur")
    : bad(`StatsBand: ${stats.clipped} slot(s) have overflow != visible`);
} catch (err) {
  bad(err.message);
} finally {
  cleanup();
}

console.log(
  failures === 0
    ? "\n✓ glyphs rendered and stat digits settled"
    : `\n✗ ${failures} problem(s)`,
);
process.exit(failures === 0 ? 0 : 1);
