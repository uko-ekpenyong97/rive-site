#!/usr/bin/env node
/**
 * Are the outbound links actually REACHABLE — by pointer and by keyboard?
 *
 *   npm run dev            # in another shell
 *   npm run check:links
 *
 * WHY A BROWSER: the Vitest suite pins every href exactly, which proves the
 * markup is right and proves nothing about whether a visitor can hit it. Three
 * failure modes live entirely in layout and none is visible in a screenshot:
 *
 *  · SOMETHING ON TOP. `DotField` paints a full-bleed canvas over the page. It
 *    sets `pointer-events: none`, so it should be transparent to clicks — but
 *    "should" is a CSS declaration one refactor away from being wrong, and a
 *    canvas that swallows clicks looks completely normal. This asserts
 *    elementFromPoint at each chip's CENTRE resolves to the anchor itself.
 *  · NO FOCUS RING. The chips were <span>s and could not be focused at all.
 *    This focuses each one and requires a computed outline that is not `none`.
 *  · ZERO-SIZED HIT AREA. An anchor with no box passes every markup assertion.
 *
 * It also re-reads each href from the live DOM, so a build that mangles a URL is
 * caught against the rendered page rather than against the source it came from.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const urlArg = args.indexOf("--url");
const URL_ = urlArg >= 0 ? args[urlArg + 1] : "http://localhost:5173/";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The eleven destinations, as they must appear in the live DOM. */
const EXPECTED = {
  WEB: "https://rive.app/docs/runtimes/web",
  REACT: "https://rive.app/docs/runtimes/react",
  IOS: "https://rive.app/docs/runtimes/apple",
  ANDROID: "https://rive.app/docs/runtimes/android",
  FLUTTER: "https://rive.app/docs/runtimes/flutter",
  UNITY: "https://rive.app/docs/game-runtimes/unity",
  UNREAL: "https://rive.app/docs/game-runtimes/unreal",
  "C++": "https://github.com/rive-app/rive-cpp",
  "Start with artboards →":
    "https://rive.app/docs/editor/fundamentals/artboards",
  "See animation tools →":
    "https://rive.app/docs/editor/animate-mode/animate-mode-overview",
  "Read the docs →": "https://rive.app/docs/runtimes/getting-started",
};

let failures = 0;
const bad = (m) => {
  failures++;
  console.error(`  ✗ ${m}`);
};

const profile = mkdtempSync(join(tmpdir(), "check-links-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
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

/* Collect every candidate anchor with its geometry, and ask the document what
   is actually on top at each one's centre. */
const PROBE = `(() => {
  const out = [];
  const seen = new Set();
  const wanted = ${JSON.stringify(Object.keys(EXPECTED))};
  for (const a of document.querySelectorAll('a')) {
    const label = (a.textContent || '').trim();
    if (!wanted.includes(label) || seen.has(label)) continue;
    seen.add(label);
    a.scrollIntoView({ block: 'center' });
    const r = a.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    const cs = getComputedStyle(a);
    out.push({
      label,
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel'),
      w: Math.round(r.width), h: Math.round(r.height),
      /* Does the anchor own its own centre? A descendant is fine — the click
         still lands on the link. Anything else is an interceptor. */
      hitIsSelf: !!hit && (hit === a || a.contains(hit)),
      hitTag: hit ? hit.tagName.toLowerCase() : null,
      hitClass: hit ? (hit.className && hit.className.baseVal !== undefined
        ? hit.className.baseVal : String(hit.className || '')) : null,
      tag: a.tagName.toLowerCase(),
    });
  }
  return out;
})()`;

/**
 * A bare `a.focus()` does NOT make `:focus-visible` match in Chrome — the
 * heuristic wants keyboard-ish intent, so a script focus leaves the ring off and
 * every link reads as "focused but shows no outline". That is a measurement
 * artifact, not a missing ring, and it is worth naming because the wrong reading
 * is the confident-looking one: eleven identical failures look like a real CSS
 * bug. `focus({ focusVisible: true })` states the intent explicitly, and the
 * result is cross-checked against `:focus-visible` actually matching.
 */
const FOCUS = (label) => `(() => {
  const a = [...document.querySelectorAll('a')]
    .find((x) => (x.textContent || '').trim() === ${JSON.stringify(label)});
  if (!a) return { error: 'not found' };
  a.focus({ focusVisible: true });
  const active = document.activeElement === a;
  const cs = getComputedStyle(a);
  return {
    active,
    outlineStyle: cs.outlineStyle,
    outlineWidth: cs.outlineWidth,
    outlineColor: cs.outlineColor,
    outlineOffset: cs.outlineOffset,
    matchesFocusVisible: a.matches(':focus-visible'),
  };
})()`;

let ws;
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
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
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
  const ev = async (expression) => {
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
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: URL_ });
  await sleep(3500);
  await ev("document.fonts.ready");

  console.log(`outbound links → ${URL_}\n`);

  const found = await ev(PROBE);
  /* Fail closed: a page that rendered none of them must not read as a pass. */
  if (!Array.isArray(found) || found.length === 0)
    throw new Error("no expected anchors found in the document at all");

  const missing = Object.keys(EXPECTED).filter(
    (l) => !found.some((f) => f.label === l),
  );
  for (const l of missing) bad(`"${l}" — no anchor with this label in the page`);

  console.log("label            box      hit      href");
  for (const f of found) {
    const want = EXPECTED[f.label];
    const notes = [];
    if (f.tag !== "a") notes.push(`is <${f.tag}>, not <a>`);
    if (f.href !== want) notes.push(`href is ${f.href}, expected ${want}`);
    if (f.target !== "_blank") notes.push(`target is ${f.target ?? "(none)"}`);
    if (f.rel !== "noopener noreferrer") notes.push(`rel is ${f.rel ?? "(none)"}`);
    if (f.w < 8 || f.h < 8) notes.push(`hit area is ${f.w}x${f.h}`);
    if (!f.hitIsSelf)
      notes.push(
        `centre is covered by <${f.hitTag}${f.hitClass ? ` class="${f.hitClass}"` : ""}> ` +
          `— something is intercepting the click`,
      );

    const mark = notes.length ? "✗" : "✓";
    if (notes.length) failures += notes.length;
    console.log(
      `  ${mark} ${f.label.padEnd(24)} ${String(f.w + "x" + f.h).padEnd(8)} ` +
        `${(f.hitIsSelf ? "self" : "COVERED").padEnd(8)} ${f.href}`,
    );
    for (const n of notes) console.error(`      ${n}`);
  }

  /* PRIME KEYBOARD MODALITY. Chrome only lets `:focus-visible` match once the
     page has actually seen keyboard input — neither `.focus()` nor
     `.focus({focusVisible:true})` from script sets that flag, so without this
     every link reports "no ring" and the whole section reads as a real CSS
     failure. One genuine Tab through CDP flips the modality, after which script
     focus is treated as keyboard focus. */
  await send("Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
  });
  await sleep(150);

  /* Resolve --focus-ring to a real computed colour rather than comparing against
     a hardcoded amber: the token is the source of truth and `var(--x)` is not a
     value until the cascade has resolved it (the same rule DotField and
     AudienceGlyph follow). */
  const ring = await ev(`(() => {
    const p = document.createElement('span');
    p.style.cssText = 'position:absolute;width:0;height:0;opacity:0';
    p.style.color = 'var(--focus-ring)';
    document.body.appendChild(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  })()`);
  console.log(`\nkeyboard focus (house ring = 2px solid ${ring}):`);
  for (const label of Object.keys(EXPECTED)) {
    const r = await ev(FOCUS(label));
    if (!r || r.error) {
      bad(`"${label}" — could not focus: ${r?.error ?? "no result"}`);
      continue;
    }
    if (!r.active) {
      bad(`"${label}" — did not take focus (not reachable by keyboard)`);
      continue;
    }
    const ringed = r.outlineStyle !== "none" && parseFloat(r.outlineWidth) > 0;
    if (!r.matchesFocusVisible) {
      bad(`"${label}" — focused but :focus-visible does not match, so no ring rule applies`);
      continue;
    }
    if (!ringed) {
      bad(
        `"${label}" — :focus-visible matches but the computed outline is ` +
          `${r.outlineStyle} / ${r.outlineWidth}`,
      );
      continue;
    }
    /* `outline-style: auto` IS the user-agent default ring. It is a visible
       ring, so a bare "is there an outline" test passes on it — which is how
       the three rails sat on Chrome's blue while every other focusable element
       on the site used the amber token. Name it specifically. */
    if (r.outlineStyle === "auto") {
      bad(
        `"${label}" — showing the USER-AGENT ring (${r.outlineWidth} auto ` +
          `${r.outlineColor}), not the house ring. .text-link needs a ` +
          `:focus-visible rule.`,
      );
      continue;
    }
    if (r.outlineColor !== ring)
      bad(
        `"${label}" — ring colour is ${r.outlineColor}, expected --focus-ring (${ring})`,
      );
    else if (r.outlineStyle !== "solid" || parseFloat(r.outlineWidth) !== 2)
      bad(
        `"${label}" — ring is ${r.outlineWidth} ${r.outlineStyle}, expected 2px solid`,
      );
    else
      console.log(
        `  \u2713 ${label.padEnd(24)} ${r.outlineWidth} ${r.outlineStyle} ${r.outlineColor} offset ${r.outlineOffset}`,
      );
  }

  /* State the DotField situation explicitly rather than only implying it via
     the per-link hit test — this is the assertion the section is here for. */
  const dot = await ev(`(() => {
    const d = document.querySelector('.dot-field');
    if (!d) return null;
    const cs = getComputedStyle(d);
    return { pointerEvents: cs.pointerEvents, position: cs.position, zIndex: cs.zIndex };
  })()`);
  console.log(
    `\nDotField: ${dot ? `pointer-events: ${dot.pointerEvents} (position ${dot.position}, z-index ${dot.zIndex})` : "not present"}`,
  );
  if (dot && dot.pointerEvents !== "none")
    bad(`DotField has pointer-events: ${dot.pointerEvents} — it can swallow clicks`);

  if (failures) {
    console.error(`\n✗ outbound links: ${failures} problem(s)`);
    process.exitCode = 1;
  } else {
    console.log(
      `\n✓ all ${Object.keys(EXPECTED).length} links are anchors with the right href, ` +
        `open in a new tab with noopener noreferrer, own their own centre, and show a focus ring`,
    );
  }
} catch (err) {
  console.error(`\n✗ link check could not run: ${err.message}`);
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {
    /* best effort */
  }
  cleanup();
}
