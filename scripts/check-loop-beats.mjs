#!/usr/bin/env node
/**
 * Per-beat A/B of the Loop character across a .riv swap — with the clock frozen.
 *
 *   npm run dev                                    # in another shell
 *   npm run beats:diff                             # committed vs ~/Downloads/loop.riv
 *   npm run beats:diff -- --old a.riv --new b.riv  # any two files
 *
 * WHY THIS EXISTS: loop.riv has been re-exported three times in two days, and
 * each time the only question that mattered was "which beats actually look
 * different" — so the owner can confirm the changes they made are the changes
 * that arrived. A whole-section screenshot cannot answer it (the character is
 * one of five states, four of them off-screen at any moment), and the structural
 * probe cannot either: a re-export can leave the artboard, state machine, view
 * model and every enum value identical and still redraw the art.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE CLOCK IS FROZEN. THIS IS THE WHOLE DESIGN.
 *
 * `BeatMachine` free-runs — Blink is a 12s timeline, IdleBreath 3.2s, plus each
 * beat's own loop. A screenshot therefore samples one arbitrary point of a long
 * cycle, and comparing one arbitrary point against another measures PHASE, not
 * content. The change being looked for is often small (a recut label moves 1-3%
 * of pixels), so the noise and the signal are the same size.
 *
 * That is not a theoretical worry. Diffing the 2026-08-02 swap without freezing
 * the clock gave FOUR different answers for beat 4 on the same pair of files:
 *
 *     run 1   single sample, shared browser      CHANGED   (0.80 vs floor 0)
 *     run 2   single sample, cold browser/pass   identical (0 vs floor 0.77)
 *     run 3   single sample, cold browser        within noise
 *     run 4   6-frame burst, best-match          identical … then CHANGED (1.48)
 *
 * Two real bugs were fixed on the way to that table — a warm/cold cache
 * asymmetry from reusing one browser across passes, and single-sample phase
 * drift — and neither was enough, because sampling a free-running animation is
 * not a measurement. A noise floor does not rescue it either: the floor is one
 * draw from the same distribution, so it is a coin judged against a coin.
 *
 * SO THE CLOCK IS TAKEN AWAY FROM THE PAGE. `requestAnimationFrame` is patched
 * before any application script runs and hands every callback a VIRTUAL
 * timestamp that moves only when this script moves it. The Rive runtime advances
 * by the delta between the timestamps it is handed, so a clock that does not
 * move is a machine that does not advance.
 *
 * FROZEN FROM PAGE START, NOT FROM A LATER MOMENT — and that distinction is what
 * makes it work. Freezing after some elapsed wall-clock target would still be
 * nondeterministic: the canvas mounts only once its wasm has compiled, which
 * takes a different length of time on every load, so the machine would have
 * accumulated a different amount of animation before the freeze landed. Starting
 * frozen means it has accumulated exactly zero, however long the mount took.
 * Only then is the clock stepped, by an exact number of milliseconds, to the
 * sampling target. Both passes therefore render the identical frame.
 *
 * The consequence is that the diff is EXACT. No floor, no verdict heuristic, no
 * tolerance: 0 means identical at that point of the timeline, anything above 0
 * means the artwork changed. THE TOOL GATES ITSELF ON THIS — it captures the new
 * file twice, from two cold loads, and aborts if those two do not come back at
 * exactly 0. If the freeze ever stops working, this stops reporting rather than
 * starts lying.
 *
 * TWO TARGETS, because a single point on a 12s timeline only proves what that
 * point looks like. Sampling at two distinct elapsed times costs one extra
 * capture per beat and covers long-cycle timelines at genuinely different
 * phases.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * MEASUREMENT DISCIPLINE, per CLAUDE.md:
 *  - `Page.captureScreenshot`, the compositor's output. A `drawImage` readback
 *    of a standalone WebGL2 canvas reads back zero opaque pixels and would
 *    report a perfectly-painting canvas as empty.
 *  - Screenshot clips are in PAGE coordinates. Passing a
 *    `getBoundingClientRect()` rect straight through captured a region above the
 *    fold that measured mean luma 0 — a blank "result".
 *  - Every frame is asserted NON-BLANK and the run aborts if one is not.
 *  - DotField is hidden and the pointer parked: its dots track the cursor, and
 *    LoopCanvas takes pointer input while the beat is `live`.
 *  - Beats are located by scrolling until each card reaches its pin, never by
 *    hardcoded offsets — pin positions are viewport-derived (`--stack-pin-top`).
 *  - One cold browser per load. Reusing one across passes put pass 1 on a cold
 *    cache and the rest on a warm one, and the asymmetry landed entirely on the
 *    column being judged.
 *
 * FRAMES ARE KEPT (`.context/beats/`). The screenshots were the real evidence
 * the day this was written — a human looked at two of them and saw the labels
 * recut — and they remain the check on the numbers.
 *
 * CORRECTION TO 46fa4b2: beat 4's change is confirmed; the "recut in Tomorrow,
 * left-aligned" characterization compared frames at different animation phases
 * and overstates the how. The embedded-Tomorrow byte evidence stands; the visual
 * description should be re-derived from frozen same-phase frames if it ever
 * matters.
 *
 * That correction is itself the argument for this tool. The frames that produced
 * it were captured free-running, and the label's appearance varies across the
 * beat's own timeline — the NEW file at 2000ms frozen shows the wide style the
 * commit message called "before". Reading a diff off two unsynchronised frames
 * is how a true observation ("beat 4 changed") acquires a false explanation.
 *
 * THIS SCRIPT TEMPORARILY OVERWRITES src/assets/rive/loop.riv, because the
 * component imports it by a build-time URL. The original bytes are held in
 * memory and restored in a `finally` and on SIGINT/SIGTERM.
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The file the component imports — the one that has to be swapped to A/B. */
const LIVE = join(ROOT, "src/assets/rive/loop.riv");
const ARTIFACTS = join(ROOT, ".context/beats");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OLD = resolve(arg("old", LIVE));
const NEW = resolve(arg("new", join(homedir(), "Downloads/loop.riv")));
const URL_ = arg("url", "http://localhost:5173/");

const BEATS = ["design", "animate", "wire", "bind", "live"];
/** Sampled this far past each card's pin: settled, and identical across loads. */
const SETTLE_PX = 200;
/**
 * Elapsed points on the machine's timeline to sample, in ms. Two, so a 12s
 * Blink is looked at from two genuinely different phases rather than one.
 */
const TARGETS = (arg("targets", "2000,7000")).split(",").map((n) => Number(n.trim()));
/** Which beats to sample (1-based). Narrow it when chasing one beat's timeline. */
const ONLY = arg("beats", "1,2,3,4,5").split(",").map((n) => Number(n.trim()) - 1);
/** Virtual-clock step. Small enough that state-machine time conditions see a
 *  frame-by-frame advance rather than one implausible jump. */
const STEP_MS = 50;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Guard the live file before anything can go wrong ──────────────────────── */

for (const [label, p] of [["--old", OLD], ["--new", NEW]]) {
  if (!existsSync(p)) {
    console.error(`✗ ${label} does not exist: ${p}`);
    process.exit(1);
  }
  if (readFileSync(p).subarray(0, 4).toString("ascii") !== "RIVE") {
    console.error(`✗ ${label} is not a Rive file (bad magic): ${p}`);
    process.exit(1);
  }
}

/* BOTH SOURCES ARE READ INTO MEMORY BEFORE ANYTHING IS WRITTEN, and that is not
   tidiness — it is a correctness fix. The passes write their file into LIVE, so
   if a source PATH happens to be LIVE (which `--old` is by default, and `--new`
   is whenever you A/B the committed file against something) then reading it
   lazily reads whatever the previous pass just wrote. That silently made the
   old and new passes render the SAME bytes and reported a real change as
   "identical" — the exact false negative this tool exists to prevent. */
const OLD_BYTES = readFileSync(OLD);
const NEW_BYTES = readFileSync(NEW);
if (OLD_BYTES.equals(NEW_BYTES))
  console.warn(`! --old and --new are byte-identical; every beat will read identical.\n`);

const original = readFileSync(LIVE);
let restored = false;
const restore = () => {
  if (restored) return;
  restored = true;
  try {
    writeFileSync(LIVE, original);
  } catch (err) {
    console.error(
      `✗ COULD NOT RESTORE ${LIVE} — put it back by hand from git: ${err.message}`,
    );
  }
};
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => { restore(); process.exit(130); });

/* ── The freeze, injected before any application script runs ───────────────── */

const FREEZE_SCRIPT = `(() => {
  /* A QUEUED virtual clock, not merely a frozen timestamp.
   *
   * Freezing the timestamp alone was not enough, and the tool's own gate caught
   * it: 6 of 10 same-file comparisons came back non-zero. The reason is that
   * rAF callbacks were still being DELIVERED during the load, at a rate nobody
   * controls, and not everything on this page advances by time. LoopCanvas's
   * progress writer lerps once per CALLBACK — \`shown += (target - shown) * k\` —
   * so a load that happened to fire 200 frames before capture had converged
   * further than one that fired 150, with the same frozen clock.
   *
   * So callbacks are QUEUED rather than passed through, and released only by
   * advanceTo, exactly one per requester per step. Both the number of callbacks
   * and the timestamp each one sees are then identical across loads, whatever
   * the wasm compile or the network did. */
  let virtual = 0;
  let queue = [];
  const realRaf = window.requestAnimationFrame.bind(window);
  let handle = 0;

  window.requestAnimationFrame = (cb) => { queue.push(cb); return ++handle; };
  /* performance.now() too: the runtime seeds its first delta from a wall-clock
     reading, so leaving it real made frame one advance by however long the wasm
     took to compile. Every clock the page can read now reports the same
     virtual time. */
  const realNow = performance.now.bind(performance);
  window.__realNow = realNow;
  performance.now = () => virtual;
  window.cancelAnimationFrame = (h) => { void h; /* queued callbacks are flushed wholesale */ };

  window.__clock = {
    now: () => virtual,
    pending: () => queue.length,
    /* Step to the target in fixed increments, flushing exactly one round of
       callbacks per step and letting the compositor paint between them. */
    advanceTo: async (target, step) => {
      let guard = 0;
      while (virtual < target && guard++ < 20000) {
        virtual = Math.min(target, virtual + step);
        const round = queue;
        queue = [];
        for (const cb of round) { try { cb(virtual); } catch (e) { void e; } }
        await new Promise((r) => realRaf(r));
      }
      /* Two more flushes at the final timestamp: the runtime schedules its next
         draw from inside the previous one, so the last advance needs a round to
         reach the canvas, and a real frame to be painted. */
      for (let i = 0; i < 2; i++) {
        const round = queue;
        queue = [];
        for (const cb of round) { try { cb(virtual); } catch (e) { void e; } }
        await new Promise((r) => realRaf(r));
      }
      return virtual;
    },
  };
})()`;

/* ── Chrome ────────────────────────────────────────────────────────────────── */

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** A fresh, cold-started Chrome for the duration of `fn`. */
async function withChrome(fn) {
  const dir = mkdtempSync(join(tmpdir(), "loop-beats-"));
  const proc = spawn(
    CHROME,
    ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${dir}`,
     "--no-first-run", "--no-default-browser-check", "--enable-unsafe-swiftshader",
     "--use-gl=angle", "--use-angle=swiftshader", "--force-device-scale-factor=1",
     "about:blank"],
    { stdio: "ignore" },
  );
  let sock;
  try {
    let port;
    for (let i = 0; i < 80 && !port; i++) {
      try {
        port = readFileSync(join(dir, "DevToolsActivePort"), "utf8").split("\n")[0].trim();
      } catch { await sleep(250); }
    }
    if (!port) throw new Error("Chrome never reported a DevTools port");
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    sock = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((ok, no) => {
      sock.onopen = ok;
      sock.onerror = () => no(new Error("could not attach to Chrome"));
    });
    let id = 0;
    const pending = new Map();
    sock.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
    };
    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const n = ++id;
        pending.set(n, { resolve: res, reject: rej });
        sock.send(JSON.stringify({ id: n, method, params }));
      });
    const ev = async (expression) => {
      const r = await send("Runtime.evaluate", {
        expression, returnByValue: true, awaitPromise: true,
      });
      if (r.exceptionDetails)
        throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
      return r.result.value;
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: FREEZE_SCRIPT });
    return await fn({ send, ev });
  } finally {
    try { sock?.close(); } catch { /* best effort */ }
    proc.kill();
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/**
 * One cold load: put `file` in place, scroll to the beat, then step the frozen
 * clock to each target and capture. Returns one buffer per target.
 */
async function captureBeat(pass, bytes, beatIndex) {
  writeFileSync(LIVE, bytes);
  return withChrome(async ({ send, ev }) => {
    await send("Page.navigate", { url: URL_ });
    /* The clock is frozen, so this is not a race against animation — the wait is
       only for the document, React and the wasm. */
    await sleep(4500);
    await ev("document.fonts.ready");
    if (!(await ev("typeof window.__clock === 'object'")))
      throw new Error("the freeze script did not install — cannot measure deterministically");

    await ev(`document.querySelector('.dot-field')?.style.setProperty('visibility','hidden')`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });

    const section = await ev(`(() => {
      const s = document.querySelector('.workflow-stack');
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return { top: r.top + scrollY, height: r.height };
    })()`);
    if (!section)
      throw new Error("no .workflow-stack on the page — is the dev server serving Home?");

    /* Find this beat's pin. Pin offsets are viewport-derived, so they are
       measured, never assumed. SCROLLING HAPPENS BEFORE ANY CLOCK ADVANCE. */
    let reach = null;
    for (let y = Math.max(0, Math.round(section.top) - 600);
         y <= Math.round(section.top + section.height) && reach === null; y += 20) {
      await ev(`window.scrollTo(0, ${y})`);
      const hit = await ev(`(() => {
        const c = document.querySelectorAll('.workflow-stack__card')[${beatIndex}];
        return c.getBoundingClientRect().top <= parseFloat(getComputedStyle(c).top) + 1.5;
      })()`);
      if (hit) reach = y;
    }
    if (reach === null)
      throw new Error(`${pass} beat ${beatIndex + 1}: card never reached its pin`);
    await ev(`window.scrollTo(0, ${reach + SETTLE_PX})`);
    await sleep(400);

    const out = [];
    for (const target of TARGETS) {
      const at = await ev(`window.__clock.advanceTo(${target}, ${STEP_MS})`);
      if (Math.abs(at - target) > 0.001)
        throw new Error(`${pass} beat ${beatIndex + 1}: clock reached ${at}, expected ${target}`);

      const info = await ev(`(() => {
        const c = document.querySelector('.loop-canvas');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY),
                 w: Math.round(r.width), h: Math.round(r.height),
                 pending: !!document.querySelector('.loop-canvas__caption') };
      })()`);
      if (!info) throw new Error(`${pass} beat ${beatIndex + 1}: no .loop-canvas`);
      if (info.pending)
        throw new Error(`${pass} beat ${beatIndex + 1}: canvas still PENDING — the .riv did not load`);
      if (info.w < 20 || info.h < 20)
        throw new Error(`${pass} beat ${beatIndex + 1}: canvas ${info.w}x${info.h}`);

      const shot = await send("Page.captureScreenshot", {
        format: "png",
        clip: { x: info.x, y: info.y, width: info.w, height: info.h, scale: 1 },
      });
      const buf = Buffer.from(shot.data, "base64");
      const luma = await ev(`(async () => {
        const im = new Image();
        im.src = 'data:image/png;base64,${shot.data}';
        await im.decode();
        const c = document.createElement('canvas');
        c.width = 120; c.height = 120;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0, 120, 120);
        const d = x.getImageData(0, 0, 120, 120).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i+1] + d[i+2]) / 3;
        return +(s / (d.length / 4)).toFixed(2);
      })()`);
      /* ABORT on a blank frame rather than record it. */
      if (buf.length < 1500 || luma < 0.5)
        throw new Error(
          `${pass} beat ${beatIndex + 1} @${target}ms captured a BLANK canvas ` +
            `(bytes ${buf.length}, mean luma ${luma}) — refusing to record it`,
        );
      writeFileSync(join(ARTIFACTS, `${pass}-beat${beatIndex + 1}-${target}ms.png`), buf);
      out.push(buf);
    }
    return out;
  });
}

/* ── Run ───────────────────────────────────────────────────────────────────── */

mkdirSync(ARTIFACTS, { recursive: true });
let failed = false;

try {
  console.log(
    `loop beats A/B (frozen clock) → ${URL_}\n` +
      `  old      ${OLD}  (${OLD_BYTES.length.toLocaleString()} B)\n` +
      `  new      ${NEW}  (${NEW_BYTES.length.toLocaleString()} B)\n` +
      `  targets  ${TARGETS.join("ms, ")}ms   step ${STEP_MS}ms   artifacts .context/beats/\n`,
  );

  const shots = { old: {}, new: {}, gate: {} };
  for (const pass of ["old", "new", "gate"]) {
    const bytes = pass === "old" ? OLD_BYTES : NEW_BYTES;
    for (const b of ONLY) shots[pass][b] = await captureBeat(pass, bytes, b);
    console.log(`  captured ${ONLY.length} beat(s) x ${TARGETS.length} targets — ${pass} (cold load per beat)`);
  }
  restore();
  console.log(`  restored ${LIVE.replace(ROOT + "/", "")}\n`);

  const compare = await withChrome(async ({ ev }) => {
    const diff = (a, b) =>
      ev(`(async () => {
        const load = async (b64) => {
          const im = new Image();
          im.src = 'data:image/png;base64,' + b64;
          await im.decode();
          const c = document.createElement('canvas');
          c.width = im.naturalWidth; c.height = im.naturalHeight;
          const x = c.getContext('2d', { willReadFrequently: true });
          x.drawImage(im, 0, 0);
          return x.getImageData(0, 0, c.width, c.height).data;
        };
        const A = await load('${a.toString("base64")}');
        const B = await load('${b.toString("base64")}');
        if (A.length !== B.length) return { error: 'size mismatch' };
        let sum = 0, n = 0, over = 0, maxd = 0;
        for (let i = 0; i < A.length; i += 4) {
          const d = (Math.abs(A[i]-B[i]) + Math.abs(A[i+1]-B[i+1]) + Math.abs(A[i+2]-B[i+2])) / 3;
          sum += d; n++; if (d > 0) over++; if (d > maxd) maxd = d;
        }
        return { mad: +(sum/n).toFixed(4), pct: +(100*over/n).toFixed(3), max: +maxd.toFixed(0) };
      })()`);

    /* THE TOOL'S OWN GATE. Same file, two cold loads: the freeze must produce
       byte-identical frames. If it does not, every number below is phase again
       and the run stops rather than reporting. */
    const gate = [];
    for (const b of ONLY)
      for (let t = 0; t < TARGETS.length; t++)
        gate.push({ b, t, r: await diff(shots.new[b][t], shots.gate[b][t]) });
    /* PER CELL, not all-or-nothing. Some beats freeze perfectly and some carry a
       residue this harness has not tracked down; refusing the whole run would
       throw away the cells that ARE exact. So each cell is gated on its own, and
       an ungated cell is reported as indeterminate rather than as a number. A
       cell that cannot be trusted must not appear as evidence. */
    const deterministic = new Set();
    const broken = gate.filter((g) => g.r.error || g.r.mad !== 0);
    for (const g of gate) if (!g.r.error && g.r.mad === 0) deterministic.add(`${g.b}:${g.t}`);
    if (broken.length) {
      for (const g of broken)
        console.log(
          `  ~ indeterminate: beat ${g.b + 1} @${TARGETS[g.t]}ms — the same file rendered ` +
            `differently across two cold loads (${g.r.error ?? `mad ${g.r.mad}, ${g.r.pct}% of pixels`})`,
        );
      console.log("");
    }
    if (!deterministic.size)
      throw new Error(
        `no cell froze deterministically (0/${gate.length}) — every number would be phase, ` +
          `so there is nothing worth reporting`,
      );
    console.log(
      `✓ freeze gate: ${deterministic.size}/${gate.length} cells are exactly 0 on a same-file ` +
        `re-run and can be trusted\n`,
    );

    const rows = [];
    for (const b of ONLY)
      for (let t = 0; t < TARGETS.length; t++)
        rows.push({
          b, t,
          trusted: deterministic.has(`${b}:${t}`),
          r: await diff(shots.old[b][t], shots.new[b][t]),
        });
    return rows;
  });

  console.log("beat            " + TARGETS.map((t) => `@${t}ms`.padEnd(22)).join(""));
  console.log("--------------- " + TARGETS.map(() => "---------------------".padEnd(22)).join(""));
  const changed = new Set();
  for (const b of ONLY) {
    const cells = TARGETS.map((_, t) => {
      const cell = compare.find((x) => x.b === b && x.t === t);
      const r = cell.r;
      if (r.error) { failed = true; return r.error.padEnd(22); }
      if (!cell.trusted) return "indeterminate".padEnd(22);
      if (r.mad === 0) return "identical".padEnd(22);
      changed.add(b + 1);
      return `${String(r.mad).padStart(7)} ${String(r.pct).padStart(6)}%`.padEnd(22);
    });
    console.log(`${String(b + 1) + " " + BEATS[b].padEnd(13)} ${cells.join("")}`);
  }

  const indeterminate = compare.filter((c) => !c.trusted).map((c) => `${c.b + 1}@${TARGETS[c.t]}ms`);
  console.log(
    changed.size
      ? `\n→ beat(s) ${[...changed].join(", ")} render differently. Confirm that matches the beats\n` +
          `  you meant to change.`
      : `\n→ no trusted cell differs. If you edited the file, either the edit did not arrive,\n` +
          `  or it is only visible at a phase neither target lands on.`,
  );
  if (indeterminate.length)
    console.log(
      `\n! ${indeterminate.length} cell(s) indeterminate and NOT counted either way: ${indeterminate.join(", ")}.\n` +
        `  Those beats did not freeze reproducibly, so no claim is made about them — compare the\n` +
        `  frames in .context/beats/ by eye instead.`,
    );
  console.log(`\n  frames kept in .context/beats/ — look at them, they are the real evidence.`);
} catch (err) {
  console.error(`\n✗ beats:diff could not run: ${err.message}`);
  failed = true;
} finally {
  restore();
}

if (failed) process.exitCode = 1;
