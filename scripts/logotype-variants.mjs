#!/usr/bin/env node
/**
 * logotype-variants.mjs — the marquee's logotype pipeline: MEASURE, GENERATE,
 * VERIFY, in one committed tool.
 *
 *   npm run logos:logotype
 *
 * WHY THIS IS ONE TOOL AND NOT A TABLE OF NUMBERS
 * -----------------------------------------------
 * The marquee normalizes every brand to a common CAP HEIGHT, which means each
 * logo needs two measured constants: where its baseline sits and how tall its
 * capital is. Those numbers could have been measured once and pasted into the
 * component — and then they would be folklore. Re-running this a year from now
 * re-derives them from the committed SVGs instead of trusting the session that
 * first wrote them down. The recorded input is a DECISION (which subpaths are
 * the icon, which letter is the reference); every NUMBER is derived.
 *
 * Chrome does the geometry because getBBox() is the only honest answer for a
 * path bounding box, and Chrome is the renderer that actually matters here.
 *
 * WHAT A "LOGOTYPE VARIANT" IS
 * ----------------------------
 * Normalizing lockups and pure logotypes to one height makes lockup wordmarks
 * smaller, because the icon eats the height budget. Measured on this set before
 * the change, cap heights ran from 3.5px (SoundCloud) to 21.9px (Brilliant) —
 * a 6.2x spread across what is supposed to read as one line of type. So the
 * marquee renders LOGOTYPES ONLY, and this script emits a `-type.svg` for every
 * brand whose shipped file is not already exactly its logotype.
 *
 * THE CATEGORY RULE — lockup vs integrated
 * ----------------------------------------
 * An ICON ACCOMPANIES A COMPLETE WORDMARK: remove it and the brand's name is
 * still there, fully spelled. Adobe's ⟁, Notion's boxed N, Spotify's circle,
 * Dropbox's box, Pepsi's globe, Atlassian's A-arch, SoundCloud's waveform —
 * every one of those sits beside a word that reads without it. Those are
 * LOCKUPS and the icon comes off.
 *
 * An INTEGRATED MARK PARTICIPATES IN THE WORD ITSELF: remove it and the name
 * is no longer spelled. LinkedIn's `in` bug is geometrically separable — a
 * clean rounded square at x >= 384 — but it carries the last two letters, and
 * stripping it leaves "Linked", which is not a logo and which LinkedIn does not
 * publish. INTEGRATED MARKS ARE LOGOTYPES FOR OUR PURPOSES: they are kept whole
 * and cap-height normalized like any other word (LinkedIn on its `L`).
 *
 * The distinction is spelling, not geometry. "Is it a separate shape?" would
 * have thrown away two of LinkedIn's letters; "does the word survive?" does not.
 *
 * PADDING TRIM IS ALSO A VARIANT. Figma's file draws a 600-unit word inside a
 * 1024x640 box and Sonos draws SONOS 4.67 units tall inside 24x24. Neither has
 * an icon, but neither viewBox is the logotype's own box, and the marquee sets
 * gaps from element widths — so that dead padding would show up as inconsistent
 * spacing in the line. A variant is emitted whenever the file's viewBox differs
 * from the retained ink box by more than TRIM_TOLERANCE, whatever the cause.
 *
 * ORIGINALS ARE NEVER TOUCHED. Variants are written alongside with a source-map
 * comment. Nothing here writes to raw/.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPixels } from "./lib/verify-pixels.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOGOS_DIR = join(HERE, "..", "src", "assets", "logos");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* A variant is emitted when the shipped viewBox differs from the logotype's own
   ink box by more than this fraction of the viewBox, in any dimension. Below it
   the file already IS its logotype and the original ships unchanged. */
const TRIM_TOLERANCE = 0.02;

/* Cap height for an all-lowercase mark with no ascenders at all. Pepsi is the
   only one: p-e-p-s-i has a descender and an i-dot but nothing rising to a cap
   or ascender line, so its x-height is divided up to a cap-equivalent. 0.72 is
   the ordinary x-height:cap ratio for a geometric sans of this kind. Named here
   rather than folded into a number so the assumption stays arguable. */
const X_HEIGHT_TO_CAP = 0.72;

/* ─────────────────────────────────────────────────────────────────────────────
 * THE RECORDED DECISIONS. Everything else in this file is derived.
 *
 *   kind      lockup   — icon accompanies a complete wordmark; icon removed
 *             logotype — the file is already the word (may still need a trim)
 *             integrated — a mark participates in the word; kept whole
 *   icon      how to drop it: retain subpaths on one side of a threshold on one
 *             axis. The script ASSERTS no subpath straddles that threshold, so
 *             "cleanly separable" is enforced at generation time, not asserted
 *             in prose.
 *   letters   the expected letter groups, in reading order, space separated.
 *             Multi-letter tokens ("fy", "in") are glyphs the file draws as one
 *             shape. The script asserts the grouping produces exactly these, so
 *             a silent regrouping fails loudly instead of moving the reference.
 *   ref       index into `letters` of the glyph the cap height is measured from,
 *             and the rule that names why that glyph.
 *   baseline  index of the glyph whose bbox bottom IS the baseline. Defaults to
 *             `ref`. Split out for round capitals, which overshoot the baseline
 *             and would inflate the measure.
 *   part      "lower" picks, within a letter group, the subpath whose bottom sits
 *             lowest — the stem of a dotted `i`, not its dot.
 * ───────────────────────────────────────────────────────────────────────────── */
const RECORD = [
  {
    brand: "adobe", kind: "lockup",
    icon: { axis: "x", retain: "above", at: 175 },
    letters: "A d o b e",
    ref: { glyph: 0, rule: "cap height — flat capital A" },
  },
  {
    brand: "atlassian", kind: "lockup",
    icon: { axis: "x", retain: "above", at: 79 },
    letters: "A T L A S S I A N",
    ref: { glyph: 1, rule: "cap height — flat capital T (S and O overshoot)" },
  },
  {
    brand: "brilliant", kind: "logotype",
    letters: "B r i l l i a n t",
    ref: { glyph: 0, rule: "cap height — flat capital B" },
  },
  {
    brand: "dropbox", kind: "lockup",
    icon: { axis: "x", retain: "above", at: 133 },
    letters: "D r o p b o x",
    ref: { glyph: 0, rule: "cap height — flat capital D" },
  },
  {
    brand: "duolingo", kind: "logotype",
    letters: "d u o l i n g o",
    ref: { glyph: 3, rule: "ascender height — flat l (the mark has no capitals)" },
  },
  {
    brand: "figma", kind: "logotype",
    letters: "F i g m a",
    ref: { glyph: 0, rule: "cap height — flat capital F" },
  },
  {
    brand: "google", kind: "logotype",
    letters: "G o o g l e",
    ref: {
      glyph: 4,
      rule: "ascender height — flat l (the only capital, G, is round and overshoots both lines)",
    },
  },
  {
    /* INTEGRATED — see the category rule at the top of this file. The `in` bug
       is separable geometry but inseparable spelling, so no icon rule is given
       and no variant drops it. */
    brand: "linkedin", kind: "integrated",
    letters: "L i n k e d in",
    ref: { glyph: 0, rule: "cap height — flat capital L" },
  },
  {
    brand: "notion", kind: "lockup",
    icon: { axis: "x", retain: "above", at: 201 },
    letters: "N o t i o n",
    ref: { glyph: 0, rule: "cap height — flat capital N" },
  },
  {
    brand: "pepsi", kind: "lockup",
    icon: { axis: "x", retain: "above", at: 660 },
    letters: "p e p s i",
    ref: {
      glyph: 4, part: "lower",
      rule: `x-height of the i stem / ${X_HEIGHT_TO_CAP} — no capitals and no ascenders`,
      xHeight: true,
    },
  },
  {
    brand: "philips", kind: "logotype",
    letters: "P H I L I P S",
    ref: { glyph: 1, rule: "cap height — flat capital H (P/S round off the baseline)" },
  },
  {
    brand: "samsung", kind: "logotype",
    letters: "S A M S U N G",
    ref: { glyph: 1, rule: "cap height — flat capital A (S/U/G overshoot)" },
  },
  {
    brand: "sonos", kind: "logotype",
    letters: "S O N O S",
    ref: { glyph: 2, rule: "cap height — flat capital N (O/S overshoot)" },
  },
  {
    brand: "soundcloud", kind: "lockup",
    icon: { axis: "y", retain: "above", at: 115 },
    letters: "S O U N D C L O U D",
    ref: { glyph: 6, rule: "cap height — flat capital L (S/O/C overshoot)" },
  },
  {
    brand: "spotify", kind: "lockup",
    icon: { axis: "x", retain: "above", at: 171 },
    letters: "S p o t i fy",
    ref: { glyph: 0, rule: "cap height — capital S measured to the i-stem baseline" },
    baseline: { glyph: 4, part: "lower" },
  },
];

/* ── the page: subpath splitting, grouping, and getBBox ───────────────────── */

const PAGE = (payload) => `<!doctype html><meta charset=utf-8><body style="margin:0">
<div id=stage></div>
<script>
const INPUT = ${JSON.stringify(payload)};
const SVGNS = 'http://www.w3.org/2000/svg';

/* Split a path's "d" on its move commands. A relative "m" continues from the
   previous subpath's current point, so a lifted subpath must be re-anchored:
   the pen is tracked and the leading move rewritten as an absolute "M". Without
   that, lifting a subpath out of its group silently relocates it. */
function splitSubpaths(d) {
  const toks = d.match(/[MmZzLlHhVvCcSsQqTtAa][^MmZzLlHhVvCcSsQqTtAa]*/g) || [];
  const out = [];
  let cur = null, px = 0, py = 0, sx = 0, sy = 0;
  const nums = (s) => (s.match(/-?\\d*\\.?\\d+(?:e[-+]?\\d+)?/gi) || []).map(Number);
  for (const t of toks) {
    const c = t[0], a = nums(t.slice(1));
    if (c === 'M' || c === 'm') {
      if (cur) out.push(cur);
      let x, y;
      if (c === 'M') { x = a[0]; y = a[1]; } else { x = px + a[0]; y = py + a[1]; }
      cur = { d: 'M' + x + ' ' + y };
      px = x; py = y; sx = x; sy = y;
      for (let i = 2; i + 1 < a.length; i += 2) {
        if (c === 'M') { px = a[i]; py = a[i+1]; } else { px += a[i]; py += a[i+1]; }
        cur.d += 'L' + px + ' ' + py;
      }
      continue;
    }
    if (!cur) continue;
    cur.d += t;
    switch (c) {
      case 'Z': case 'z': px = sx; py = sy; break;
      case 'L': px = a[a.length-2]; py = a[a.length-1]; break;
      case 'l': for (let i=0;i+1<a.length;i+=2){px+=a[i];py+=a[i+1];} break;
      case 'H': px = a[a.length-1]; break;
      case 'h': for (const v of a) px += v; break;
      case 'V': py = a[a.length-1]; break;
      case 'v': for (const v of a) py += v; break;
      case 'C': px = a[a.length-2]; py = a[a.length-1]; break;
      case 'c': for (let i=0;i+5<a.length;i+=6){px+=a[i+4];py+=a[i+5];} break;
      case 'S': case 'Q': px = a[a.length-2]; py = a[a.length-1]; break;
      case 's': case 'q': for (let i=0;i+3<a.length;i+=4){px+=a[i+2];py+=a[i+3];} break;
      case 'T': px = a[a.length-2]; py = a[a.length-1]; break;
      case 't': for (let i=0;i+1<a.length;i+=2){px+=a[i];py+=a[i+1];} break;
      case 'A': px = a[a.length-2]; py = a[a.length-1]; break;
      case 'a': for (let i=0;i+6<a.length;i+=7){px+=a[i+5];py+=a[i+6];} break;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* Group subpaths into letters by how much of the NARROWER shape the horizontal
   overlap covers — not by containment, and not by "do they touch at all".
   A counter sits fully inside its letter (100%). A letter drawn in pieces still
   overlaps itself heavily: Figma's F has a stem starting 4.8 units left of its
   own bars, so strict containment split that F into two letters. Kerned
   NEIGHBOURS, meanwhile, barely graze: Atlassian's A and T share 1.3% and
   LinkedIn's k and e 5.5%. MERGE_OVERLAP sits far above both and far below the
   80% the F needs. Widest first, so a dotted i is anchored by whichever of
   dot/stem is wider and the other joins it. */
const MERGE_OVERLAP = 0.5;
function groupLetters(subs) {
  const byWidth = subs.map((s, i) => ({ ...s, i })).sort((a, b) => b.w - a.w);
  const groups = [];
  for (const s of byWidth) {
    const host = groups.find((g) => {
      const over = Math.min(g.x + g.w, s.x + s.w) - Math.max(g.x, s.x);
      return over > 0 && over >= MERGE_OVERLAP * Math.min(g.w, s.w);
    });
    if (host) {
      host.parts.push(s);
      const right = Math.max(host.x + host.w, s.x + s.w);
      host.x = Math.min(host.x, s.x);
      host.w = right - host.x;
      host.y = Math.min(host.y, s.y);
      host.bottom = Math.max(host.bottom, s.y + s.h);
    } else groups.push({ x: s.x, w: s.w, y: s.y, bottom: s.y + s.h, parts: [s] });
  }
  return groups.sort((a, b) => a.x - b.x);
}

window.__run = () => {
  const stage = document.getElementById('stage');
  const out = [];
  for (const item of INPUT) {
    stage.innerHTML = item.svg;
    const svg = stage.querySelector('svg');
    svg.setAttribute('width', 1000);
    const vb = svg.getAttribute('viewBox').trim().split(/[ ,]+/).map(Number);

    const measure = (d) => {
      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
      const b = p.getBBox();
      p.remove();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };

    const paths = [...svg.querySelectorAll('path')].map((p) => {
      const attrs = {};
      for (const a of p.attributes) if (a.name !== 'd') attrs[a.name] = a.value;
      const subs = splitSubpaths(p.getAttribute('d') || '').map((s) => ({
        d: s.d, ...measure(s.d),
      }));
      return { attrs, subs };
    });
    out.push({ brand: item.brand, viewBox: vb, paths });
  }
  return out;
};

window.__group = (subs) => groupLetters(subs);

/* Re-measure a generated variant end to end: does its ink box actually equal the
   viewBox it declares? A variant whose declared box is wrong would scale wrong
   in the marquee and nothing downstream could see it. */
window.__inkOf = (svgText) => {
  const stage = document.getElementById('stage');
  stage.innerHTML = svgText;
  const svg = stage.querySelector('svg');
  svg.setAttribute('width', 1000);
  const b = svg.getBBox();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
};
</script>`;

/* ── Chrome plumbing ──────────────────────────────────────────────────────── */

async function withChrome(html, fn) {
  const server = createServer((_, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = mkdtempSync(join(tmpdir(), "logotype-"));
  const chrome = spawn(
    CHROME,
    ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
     "--no-first-run", "--no-default-browser-check", "about:blank"],
    { stdio: "ignore" },
  );
  let ws;
  try {
    let port;
    for (let i = 0; i < 80 && !port; i++) {
      try {
        port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0].trim();
      } catch { await sleep(250); }
    }
    if (!port) throw new Error("Chrome never reported a DevTools port");
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error("no attach")); });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
    };
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails)
        throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url: origin });
    for (let i = 0; i < 60; i++) {
      if (await evaluate("typeof window.__run === 'function'")) break;
      await sleep(150);
    }
    return await fn(evaluate);
  } finally {
    try { ws?.close(); } catch { /* best effort */ }
    chrome.kill();
    server.close();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/* ── main ─────────────────────────────────────────────────────────────────── */

const round = (n) => Math.round(n * 100) / 100;
const fail = (m) => { console.error(`\n✗ ${m}\n`); process.exitCode = 1; throw new Error(m); };

const payload = RECORD.map((r) => {
  const file = join(LOGOS_DIR, `${r.brand}.svg`);
  if (!existsSync(file)) fail(`no source SVG for ${r.brand} at ${file}`);
  return { brand: r.brand, svg: readFileSync(file, "utf8") };
});

const results = await withChrome(PAGE(payload), async (evaluate) => {
  const measured = await evaluate("window.__run()");
  const out = [];

  for (const rec of RECORD) {
    const m = measured.find((x) => x.brand === rec.brand);
    if (!m) fail(`${rec.brand}: nothing measured`);
    const [vbX, vbY, vbW, vbH] = m.viewBox;

    /* 1 — split icon from logotype, and PROVE the split is clean. */
    const keep = [];
    let dropped = 0;
    for (const p of m.paths) {
      const kept = [];
      for (const s of p.subs) {
        if (!rec.icon) { kept.push(s); continue; }
        const lo = rec.icon.axis === "x" ? s.x : s.y;
        const hi = lo + (rec.icon.axis === "x" ? s.w : s.h);
        const straddles = lo < rec.icon.at && hi > rec.icon.at;
        if (straddles)
          fail(
            `${rec.brand}: subpath ${rec.icon.axis}=${round(lo)}..${round(hi)} straddles the ` +
            `icon threshold ${rec.icon.at} — this lockup is NOT cleanly separable and must be ` +
            `re-categorised by hand (see the category rule at the top of this file)`,
          );
        if (lo >= rec.icon.at) kept.push(s); else dropped++;
      }
      if (kept.length) keep.push({ attrs: p.attrs, subs: kept });
    }
    if (rec.icon && dropped === 0) fail(`${rec.brand}: icon rule dropped nothing`);
    if (!keep.length) fail(`${rec.brand}: icon rule kept nothing`);

    /* 2 — the logotype's own ink box. */
    const all = keep.flatMap((p) => p.subs);
    const inkX = Math.min(...all.map((s) => s.x));
    const inkY = Math.min(...all.map((s) => s.y));
    const inkR = Math.max(...all.map((s) => s.x + s.w));
    const inkB = Math.max(...all.map((s) => s.y + s.h));
    const ink = { x: inkX, y: inkY, w: inkR - inkX, h: inkB - inkY };

    /* 3 — letters, and the reference glyph. Grouping is asserted against the
           recorded spelling so a regrouping cannot silently move the metric. */
    const groups = await evaluate(`window.__group(${JSON.stringify(all)})`);
    const expected = rec.letters.split(" ");
    if (groups.length !== expected.length)
      fail(
        `${rec.brand}: grouped ${groups.length} letters but the record says ` +
        `${expected.length} (${rec.letters}). The grouping changed — re-check the record ` +
        `before trusting any measurement from this file.`,
      );

    const pick = (sel) => {
      const g = groups[sel.glyph];
      if (!g) fail(`${rec.brand}: no letter at index ${sel.glyph}`);
      if (sel.part === "lower") {
        /* The stem of a dotted i, not its dot: the part sitting lowest. */
        return g.parts.reduce((a, b) => (b.y + b.h > a.y + a.h ? b : a));
      }
      return { x: g.x, y: g.y, w: g.w, h: g.bottom - g.y };
    };

    const refPart = pick(rec.ref);
    const basePart = pick(rec.baseline ?? rec.ref);
    const baselineY = basePart.y + basePart.h;
    const rawRise = baselineY - refPart.y;
    const capHeight = rec.ref.xHeight ? rawRise / X_HEIGHT_TO_CAP : rawRise;
    if (!(capHeight > 0)) fail(`${rec.brand}: derived a non-positive cap height`);

    /* 4 — does this brand need a variant file at all? */
    const drift = Math.max(
      Math.abs(ink.x - vbX) / vbW, Math.abs(ink.y - vbY) / vbH,
      Math.abs(ink.w - vbW) / vbW, Math.abs(ink.h - vbH) / vbH,
    );
    const needsVariant = Boolean(rec.icon) || drift > TRIM_TOLERANCE;

    /* ROUND FIRST, then derive every ratio from the rounded numbers. The
       viewBox written to the file is what the browser actually renders against,
       so ratios computed from full-precision geometry would describe a box that
       does not exist on disk. It matters most where the units are smallest:
       Sonos draws SONOS 4.67 units tall, where 2dp of rounding is already 0.1%
       and the two definitions visibly disagree. */
    const raw = needsVariant ? ink : { x: vbX, y: vbY, w: vbW, h: vbH };
    const box = {
      x: round(raw.x), y: round(raw.y), w: round(raw.w), h: round(raw.h),
    };
    const viewBox = [box.x, box.y, box.w, box.h].join(" ");

    out.push({
      rec, viewBox, box, keep, needsVariant,
      capHeight: round(capHeight),
      baselineY: round(baselineY),
      drift, letters: groups.length,
      trimReason: rec.icon ? "icon removed" : needsVariant ? "padding trimmed" : "already its logotype",
    });
  }

  /* 5 — generate, then RE-MEASURE what was generated. */
  for (const r of out) {
    if (!r.needsVariant) continue;
    const brand = r.rec.brand;
    const body = r.keep
      .map((p) => {
        const attrs = Object.entries(p.attrs)
          .map(([k, v]) => ` ${k}="${v}"`)
          .join("");
        /* Retained subpaths of ONE original path stay in ONE path element:
           counters are holes only under a shared fill rule, so splitting them
           into separate elements would fill every counter solid. */
        return `<path${attrs} d="${p.subs.map((s) => s.d).join("")}"/>`;
      })
      .join("");

    const svg =
      `<!-- GENERATED by scripts/logotype-variants.mjs — do not hand-edit.\n` +
      `     Logotype-only variant of ${brand}.svg (${r.trimReason}).\n` +
      `     ${r.rec.kind === "lockup" ? "Icon" : "Padding"} removed so the marquee can normalize\n` +
      `     every brand to one cap height. Original left untouched. -->\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r.viewBox}" fill="currentColor">` +
      `${body}</svg>\n`;

    const reInk = await evaluate(`window.__inkOf(${JSON.stringify(svg)})`);
    const off = Math.max(
      Math.abs(reInk.x - r.box.x), Math.abs(reInk.y - r.box.y),
      Math.abs(reInk.w - r.box.w), Math.abs(reInk.h - r.box.h),
    );
    if (off > 0.5)
      fail(
        `${brand}: generated variant re-measures as ${round(reInk.x)} ${round(reInk.y)} ` +
        `${round(reInk.w)} ${round(reInk.h)} but declares viewBox "${r.viewBox}" — the ` +
        `subpath lift moved the geometry`,
      );
    r.svgText = svg;
  }

  return out;
});

/* 6 — PIXEL-VERIFY every generated variant before writing. Geometry that
       re-measures correctly can still paint nothing (a fill rule that turns the
       whole mark into a hole, say). Dimensions are not pixels. */
const generated = results.filter((r) => r.needsVariant);
if (generated.length) {
  const checks = await verifyPixels(
    generated.map((r) => {
      const [, , w, h] = r.viewBox.split(" ").map(Number);
      /* Two adjustments, both about the PROBE and neither written to disk:
         WHITE, because verifyPixels calls a uniformly-black frame blank (right
         for an opaque poster, wrong for transparent line art — a black mark on
         a transparent canvas reads mean luma 0 and would fail as empty); and
         explicit width/height, because these files carry only a viewBox and an
         <img> with no intrinsic size is not a reliable drawImage source. */
      const probe = r.svgText
        .replace(/currentColor/g, "#fff")
        .replace("<svg ", `<svg width="${w}" height="${h}" `);
      return {
        label: `${r.rec.brand}-type`,
        buffer: Buffer.from(probe, "utf8"),
        mime: "image/svg+xml",
      };
    }),
  );
  for (const c of checks) {
    if (!c || c.blank)
      fail(`${c?.label ?? "a variant"} encodes to a BLANK image — refusing to write it`);
  }
  console.log(`pixel-verified ${checks.length} generated variant(s): all paint ink\n`);
}

for (const r of generated)
  writeFileSync(join(LOGOS_DIR, `${r.rec.brand}-type.svg`), r.svgText);

/* 7 — the derived metrics the marquee actually consumes. */
const metrics = results.map((r) => ({
  brand: r.rec.brand,
  kind: r.rec.kind,
  file: r.needsVariant ? `${r.rec.brand}-type.svg` : `${r.rec.brand}.svg`,
  viewBox: r.viewBox,
  capHeight: r.capHeight,
  capRule: r.rec.ref.rule,
  /* element height = --marquee-cap * heightRatio */
  heightRatio: Math.round((r.box.h / r.capHeight) * 10000) / 10000,
  /* width follows from the viewBox aspect once height is set */
  aspect: Math.round((r.box.w / r.box.h) * 10000) / 10000,
  /* where the baseline sits as a fraction of the box, so the strip can align
     baselines rather than boxes — equal caps only read as one line if the
     letters also stand on one. */
  baselineRatio: Math.round(((r.baselineY - r.box.y) / r.box.h) * 10000) / 10000,
}));

const ts =
  `/**\n` +
  ` * GENERATED by scripts/logotype-variants.mjs — do not hand-edit.\n` +
  ` *   npm run logos:logotype\n` +
  ` *\n` +
  ` * Cap-height metrics for the logo marquee, derived from the committed SVGs by\n` +
  ` * measuring real path geometry in Chrome. Every number here is measured; the\n` +
  ` * decisions behind them (which subpaths are icon, which letter is the reference)\n` +
  ` * live in the RECORD table in that script, next to the category rule that\n` +
  ` * separates a lockup from an integrated mark.\n` +
  ` */\n\n` +
  `export interface LogotypeMetric {\n` +
  `  brand: string;\n` +
  `  /** lockup = icon removed · logotype = the word itself · integrated = mark spells part of the word */\n` +
  `  kind: "lockup" | "logotype" | "integrated";\n` +
  `  file: string;\n` +
  `  viewBox: string;\n` +
  `  /** capital-letter height in the file's own user units */\n` +
  `  capHeight: number;\n` +
  `  capRule: string;\n` +
  `  /** rendered height = --marquee-cap * heightRatio */\n` +
  `  heightRatio: number;\n` +
  `  aspect: number;\n` +
  `  /** baseline position as a fraction of the box, measured from its top */\n` +
  `  baselineRatio: number;\n` +
  `}\n\n` +
  `export const LOGOTYPE_METRICS = ${JSON.stringify(metrics, null, 2)} as const satisfies readonly LogotypeMetric[];\n\n` +
  `export const LOGOTYPE_METRIC_BY_BRAND: Record<string, LogotypeMetric> =\n` +
  `  Object.fromEntries(LOGOTYPE_METRICS.map((m) => [m.brand, m]));\n`;

writeFileSync(join(LOGOS_DIR, "logotypeMetrics.ts"), ts);

/* 8 — report, including what the strip geometry works out to. */
const CAP = 21;
console.log(
  "brand        kind        file                    cap(u)   ratio    h@21px  w@21px  baseline  rule",
);
let sumW = 0;
let maxAscent = 0;
let maxDescent = 0;
for (const m of metrics) {
  const h = CAP * m.heightRatio;
  const w = h * m.aspect;
  sumW += w;
  maxAscent = Math.max(maxAscent, h * m.baselineRatio);
  maxDescent = Math.max(maxDescent, h * (1 - m.baselineRatio));
  console.log(
    m.brand.padEnd(13) + m.kind.padEnd(12) + m.file.padEnd(24) +
    String(m.capHeight).padStart(6) + "  " +
    m.heightRatio.toFixed(4).padStart(7) + "  " +
    h.toFixed(1).padStart(6) + "  " + w.toFixed(1).padStart(6) + "  " +
    m.baselineRatio.toFixed(3).padStart(7) + "   " + m.capRule,
  );
}
const GAP = 72;
const group = sumW + metrics.length * GAP;
console.log(
  `\n${generated.length} variant(s) written · ${metrics.length - generated.length} original(s) used as-is` +
  `\nstrip @ cap ${CAP}px, gap ${GAP}px: group width ${group.toFixed(0)}px` +
  `\n  max ascent above baseline ${maxAscent.toFixed(1)}px · max descent below ${maxDescent.toFixed(1)}px` +
  `\n  --marquee-duration for 38.7 px/s: ${(group / 38.67).toFixed(1)}s`,
);
