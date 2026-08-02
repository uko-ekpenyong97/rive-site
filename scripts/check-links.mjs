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


/* ─────────────────────────────────────────────────────────────────────────────
 * THE MODALS' "Runs on" CHIPS.
 *
 * A separate walk because these do not exist until a modal is open, so the
 * static page probe above cannot see them at all. Three things can only be
 * answered here:
 *   · the SCRIM and the ModalSheet must not intercept the click. The sheet is a
 *     stacked, animated, transformed surface above a fixed backdrop — exactly
 *     the arrangement where a chip can look perfect and be unclickable.
 *   · the focus ring has to be visible against --surface-raised INSIDE the
 *     sheet, not just against the page canvas.
 *   · the link-less chip must be inert: not an anchor, not tabbable, and still
 *     the element at its own centre.
 * ───────────────────────────────────────────────────────────────────────────── */

/** label → expected href, or null where the chip is deliberately not a link. */
const MODAL_CHIPS = {
  "product-ui": {
    "iOS": "https://rive.app/docs/runtimes/apple",
    "Android": "https://rive.app/docs/runtimes/android",
    "Flutter": "https://rive.app/docs/runtimes/flutter",
    "React Native": "https://rive.app/docs/runtimes/react-native",
    "Web": "https://rive.app/docs/runtimes/web",
    "Framer": "https://rive.app/docs/editor/embed-urls/framer-and-rive",
    "Webflow": "https://help.webflow.com/hc/en-us/articles/33961216978451-Embed-Rive-animations",
  },
  "game-ui": {
    "Unity": "https://rive.app/docs/game-runtimes/unity",
    "Unreal": "https://rive.app/docs/game-runtimes/unreal",
    "Defold": "https://rive.app/docs/game-runtimes/defold",
    "Custom engines": "https://github.com/rive-app/rive-cpp",
  },
  "websites": {
    "Web": "https://rive.app/docs/runtimes/web",
    "Framer": "https://rive.app/docs/editor/embed-urls/framer-and-rive",
    "Webflow": "https://help.webflow.com/hc/en-us/articles/33961216978451-Embed-Rive-animations",
  },
  "automotive": { "Embedded devices": null },
  "film-tv-broadcast": {
    "Web": "https://rive.app/docs/runtimes/web",
    "Embedded devices": null,
  },
  "campaigns": {
    "iOS": "https://rive.app/docs/runtimes/apple",
    "Android": "https://rive.app/docs/runtimes/android",
    "Web": "https://rive.app/docs/runtimes/web",
  },
};

/** Each modal's bento cell, identified by its visible eyebrow. */
const EYEBROW = {
  "product-ui": "PRODUCT UI",
  "game-ui": "GAME UI",
  "websites": "WEBSITES",
  "automotive": "AUTOMOTIVE",
  "film-tv-broadcast": "FILM, TV & BROADCAST",
  "campaigns": "CAMPAIGNS",
};

const MODAL_PROBE = `(() => {
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return { error: 'no .modal-overlay' };
  const items = [...overlay.querySelectorAll('.runtime-chips__chip')];
  if (!items.length) return { error: 'modal open but no .runtime-chips__chip in it' };
  const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const trap = [...overlay.querySelectorAll(FOCUSABLE)].filter(e => e.getClientRects().length > 0);
  return {
    chips: items.map((el) => {
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(Math.round(r.left + r.width/2), Math.round(r.top + r.height/2));
      const cs = getComputedStyle(el);
      return {
        label: (el.textContent || '').trim(),
        tag: el.tagName.toLowerCase(),
        href: el.getAttribute('href'),
        target: el.getAttribute('target'),
        rel: el.getAttribute('rel'),
        tabindex: el.getAttribute('tabindex'),
        cursor: cs.cursor,
        w: Math.round(r.width), h: Math.round(r.height),
        hitIsSelf: !!hit && (hit === el || el.contains(hit)),
        hitTag: hit ? hit.tagName.toLowerCase() : null,
        hitClass: hit ? String(hit.className || '') : null,
        inTrap: trap.includes(el),
      };
    }),
    /* The tab order the sheet actually offers, so a change in WHERE the chips
       sit is a visible diff and not a surprise. */
    trapOrder: trap.map((e) => {
      const t = (e.textContent || '').trim().replace(/[ \\t\\n\\r]+/g, ' ');
      return e.tagName.toLowerCase() + ':' + (t.slice(0, 22) || e.getAttribute('aria-label') || '?');
    }),
  };
})()`;

const MODAL_FOCUS = (label) => `(() => {
  const overlay = document.querySelector('.modal-overlay');
  const el = [...overlay.querySelectorAll('a.runtime-chips__chip')]
    .find((x) => (x.textContent || '').trim() === ${JSON.stringify(label)});
  if (!el) return { error: 'not found' };
  el.focus({ focusVisible: true });
  const cs = getComputedStyle(el);
  return {
    active: document.activeElement === el,
    matchesFocusVisible: el.matches(':focus-visible'),
    outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth,
    outlineColor: cs.outlineColor, outlineOffset: cs.outlineOffset,
    /* The surface the ring is drawn against, so "visible on surface-raised" is
       measured rather than assumed. */
    chipBg: cs.backgroundColor,
  };
})()`;

console.log("\n" + "─".repeat(64) + "\nmodal \u201cRuns on\u201d chips\n");

let modalChipCount = 0;
for (const [slug, expected] of Object.entries(MODAL_CHIPS)) {
  /* Matched on the VISIBLE eyebrow, not the slug: `pageHref` is "#" for the use
     cases with no page of their own (film-tv-broadcast, campaigns), so a
     href-contains-slug search silently skips exactly those. */
  const opened = await ev(`(() => {
    const want = ${JSON.stringify(EYEBROW[slug])};
    const cell = [...document.querySelectorAll('.bento-cell[data-expands]')]
      .find((c) => (c.querySelector('.bento-cell__eyebrow')?.textContent || '').trim() === want);
    if (!cell) return false;
    cell.scrollIntoView({ block: 'center' });
    cell.click();
    return true;
  })()`);
  if (!opened) {
    bad(`${slug}: could not find its bento cell to open the modal`);
    continue;
  }
  /* The sheet glides in over 800ms; measuring mid-entrance reads a transformed,
     part-way box and the hit test lands somewhere else entirely. */
  await sleep(1400);

  const r = await ev(MODAL_PROBE);
  if (!r || r.error) {
    bad(`${slug}: ${r?.error ?? "no result"}`);
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
    await sleep(600);
    continue;
  }

  const seen = r.chips.map((c) => c.label);
  const want = Object.keys(expected);
  if (seen.join("|") !== want.join("|"))
    bad(`${slug}: chips are [${seen.join(", ")}], expected [${want.join(", ")}]`);

  console.log(`  ${slug}`);
  for (const c of r.chips) {
    const wantHref = expected[c.label];
    const notes = [];
    if (wantHref === null) {
      /* The inert chip. Every one of these is a way it could accidentally
         dress like a link. */
      if (c.tag !== "span") notes.push(`is <${c.tag}>, must be a plain <span>`);
      if (c.href) notes.push(`has href ${c.href}, must have none`);
      if (c.tabindex !== null) notes.push(`has tabindex="${c.tabindex}", must not be tabbable`);
      if (c.inTrap) notes.push(`is in the modal focus trap, must not be`);
      if (c.cursor === "pointer") notes.push(`shows cursor:pointer, must not look clickable`);
    } else {
      if (c.tag !== "a") notes.push(`is <${c.tag}>, expected <a>`);
      if (c.href !== wantHref) notes.push(`href is ${c.href}, expected ${wantHref}`);
      if (c.target !== "_blank") notes.push(`target is ${c.target ?? "(none)"}`);
      if (c.rel !== "noopener noreferrer") notes.push(`rel is ${c.rel ?? "(none)"}`);
      if (!c.inTrap) notes.push(`is NOT in the modal focus trap — unreachable by keyboard`);
    }
    if (c.w < 8 || c.h < 8) notes.push(`hit area ${c.w}x${c.h}`);
    if (!c.hitIsSelf)
      notes.push(`centre covered by <${c.hitTag} class="${c.hitClass}"> — scrim or sheet is intercepting`);

    modalChipCount++;
    if (notes.length) failures += notes.length;
    console.log(
      `    ${notes.length ? "\u2717" : "\u2713"} ${c.label.padEnd(17)}` +
        `${(wantHref === null ? "static" : c.tag).padEnd(7)}${c.hitIsSelf ? "self" : "COVERED"}  ` +
        `${wantHref === null ? "(no link, by decision)" : c.href}`,
    );
    for (const n of notes) console.error(`        ${n}`);
  }

  /* Ring measured on a real chip inside this sheet. */
  const firstLinked = r.chips.find((c) => expected[c.label] !== null);
  if (firstLinked) {
    const f = await ev(MODAL_FOCUS(firstLinked.label));
    if (!f || f.error) bad(`${slug}: could not focus "${firstLinked.label}"`);
    else if (!f.matchesFocusVisible)
      bad(`${slug}: "${firstLinked.label}" focused but :focus-visible does not match`);
    else if (f.outlineStyle === "auto")
      bad(`${slug}: "${firstLinked.label}" shows the USER-AGENT ring inside the sheet`);
    else if (f.outlineColor !== ring)
      bad(`${slug}: ring is ${f.outlineColor}, expected --focus-ring ${ring}`);
    else
      console.log(
        `      ring ${f.outlineWidth} ${f.outlineStyle} ${f.outlineColor} offset ${f.outlineOffset} on ${f.chipBg}`,
      );
  }

  console.log(`      tab order: ${r.trapOrder.join(" → ")}`);

  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await sleep(700);
}

const wantChips = Object.values(MODAL_CHIPS).reduce((n, o) => n + Object.keys(o).length, 0);
if (modalChipCount !== wantChips)
  bad(`walked ${modalChipCount} modal chips, expected ${wantChips}`);
else console.log(`\n  ${modalChipCount} modal chips walked across ${Object.keys(MODAL_CHIPS).length} modals`);


/* ─────────────────────────────────────────────────────────────────────────────
 * WEBFLOW HOST REACHABILITY — and an honest account of what it cannot prove.
 *
 * help.webflow.com sits behind Cloudflare's bot challenge. curl and headless
 * Chrome both get 403 + a "Just a moment..." interstitial; a real visitor's
 * browser passes it and reads the article. So a 403 here is EXPECTED and is not
 * evidence of a broken link.
 *
 * WHAT THIS PROBE PROVES: the host resolves and is serving. It fails on DNS
 * failure, on connection refused, and on a 15s timeout — so "expected 403"
 * cannot quietly cover for a host that has gone away entirely.
 *
 * WHAT IT DOES NOT PROVE, MEASURED RATHER THAN ASSUMED: that the ARTICLE exists.
 * Cloudflare challenges before routing, so a deliberately fabricated article id
 * on this host returns 403 exactly like the real one — verified 2026-08-01 by
 * pointing this at `.../00000000000000-Deleted-Article`, which sailed through.
 * A 404 branch is kept below because it is the correct response if Webflow ever
 * stops challenging, but it must not be read as active coverage today.
 *
 * So the article's existence rests on TWO things that are not this probe:
 * HUMAN VERIFICATION 2026-08-01 (the page loads in a normal browser and
 * documents Webflow's native Rive support), and the exact-string pins in
 * outboundLinks.test.tsx and the modal walk above — which is what actually
 * caught the fabricated id during that test.
 *
 * This is the only network call the check makes, and deliberately so — it is not
 * a general liveness suite. The other destinations are on rive.app and github.com
 * and are pinned by string; adding eleven more requests would make a local gate
 * fail on someone else's outage.
 * ───────────────────────────────────────────────────────────────────────────── */

const WEBFLOW_URL =
  "https://help.webflow.com/hc/en-us/articles/33961216978451-Embed-Rive-animations";
const WEBFLOW_OK = [200, 403];

console.log("\n" + "\u2500".repeat(64) + "\nwebflow host reachability\n");
try {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(WEBFLOW_URL, {
    redirect: "follow",
    signal: controller.signal,
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  clearTimeout(timer);
  if (WEBFLOW_OK.includes(res.status)) {
    console.log(
      `  \u2713 ${res.status}${res.status === 403 ? " (Cloudflare challenge \u2014 expected; proves the host is up, NOT that the article exists)" : ""}` +
        `  ${WEBFLOW_URL}`,
    );
  } else {
    /* Only reachable if Cloudflare stops challenging; see the note above. */
    bad(
      `Webflow returned ${res.status} — expected 200, or 403 for the challenge. ` +
        `${res.status === 404 ? "The article has moved or been deleted." : ""} ${WEBFLOW_URL}`,
    );
  }
} catch (err) {
  bad(
    `could not reach help.webflow.com (${err.name === "AbortError" ? "timed out after 15s" : err.message}) — ` +
      `this fails rather than skips, so a dead host cannot hide behind the expected 403. ${WEBFLOW_URL}`,
  );
}

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
