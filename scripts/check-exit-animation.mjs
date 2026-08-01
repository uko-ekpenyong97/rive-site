#!/usr/bin/env node
/**
 * Falling-edge check: when a hover input goes true → false, does the state
 * machine actually play its exit animation?
 *
 * WHY THIS IS A COMMITTED SCRIPT AND NOT A VITEST CASE: the suite mocks the Rive
 * runtime and jsdom paints nothing, so nothing in `npm test` can see whether a
 * .riv renders an exit. The unit suite pins the CAUSE (inputs go true → false on
 * pointerleave); only a real browser can pin the EFFECT. This repo has already
 * paid for keeping verification untracked — see the history note in
 * src/__tests__/helpers.ts — so it lives here rather than in .context/.
 *
 * ⚠ TWO TRAPS THIS SCRIPT EXISTS TO AVOID, both of which produced a confident
 * WRONG ANSWER before being caught:
 *
 * 1. READBACK. `drawImage` on a STANDALONE WebGL2 canvas returns zero opaque
 *    pixels — the drawing buffer is gone by the time it is sampled. That yields
 *    a clean-looking "0/33 frames differ from idle", i.e. a null result from a
 *    canvas that was never showing anything. Capture is therefore
 *    `Page.captureScreenshot`, and the script ABORTS on a blank baseline rather
 *    than reporting one. Same family as the AVIF trap in CLAUDE.md: decoding is
 *    not having pixels, and no pixel CHANGE is not no animation.
 * 2. SAMPLING RATE. A screenshot costs ~900ms at full page size. Sampling a
 *    450ms exit that way steps straight over it and reports "settles
 *    immediately". The window here is small enough to sample fast.
 *
 * Measured on the committed files, 2026-07-31:
 *   get-started-cat.riv    isHoverLeft  → exit runs ~450ms (timeline Left_end, 0.45s)
 *   get-started-rocket.riv isHover      → exit runs ~590-700ms
 *
 * Usage:
 *   node scripts/check-exit-animation.mjs                      # cat, default
 *   node scripts/check-exit-animation.mjs isHover public/rive/site/get-started-rocket.riv Button Motion 500 500
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const INPUT = process.argv[2] ?? "isHoverLeft";
const RIV = process.argv[3] ?? "public/rive/site/get-started-cat.riv";
const ARTBOARD = process.argv[4] ?? "Cat";
const MACHINE = process.argv[5] ?? "Motion";
const W = Number(process.argv[6] ?? 269);
const H = Number(process.argv[7] ?? 150);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const runtimeJs = readFileSync("node_modules/@rive-app/webgl2/rive.js");
const runtimeWasm = readFileSync("node_modules/@rive-app/webgl2/rive.wasm");
const riv = readFileSync(RIV);

const page = `<!doctype html><meta charset=utf-8>
<body style="margin:0;background:#000">
<canvas id="c" width="${W}" height="${H}" style="width:${W}px;height:${H}px;display:block"></canvas>
<script src="/rive.js"></script>
<script>
window.__ready = (async () => {
  rive.RuntimeLoader.setWasmUrl("/rive.wasm");
  const c = document.getElementById("c");
  const r = new rive.Rive({ src:"/file.riv", canvas:c, artboard:${JSON.stringify(ARTBOARD)},
    stateMachines:${JSON.stringify(MACHINE)}, autoplay:true });
  await new Promise((res) => { r.on("load", res); setTimeout(res, 8000); });
  r.resizeDrawingSurfaceToCanvas();
  window.__rive = r;
  window.__inputs = {};
  for (const i of r.stateMachineInputs(${JSON.stringify(MACHINE)}) || []) window.__inputs[i.name] = i;
  return Object.keys(window.__inputs);
})();
</script>`;

const server = createServer((req, res) => {
  const go = (t, b) => { res.writeHead(200, { "content-type": t }); res.end(b); };
  if (req.url === "/") return go("text/html", page);
  if (req.url === "/rive.js") return go("application/javascript", runtimeJs);
  if (req.url === "/rive.wasm") return go("application/wasm", runtimeWasm);
  if (req.url === "/file.riv") return go("application/octet-stream", riv);
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(join(tmpdir(), "fe2-"));
/* Window must contain the whole canvas: `captureScreenshot` clips to the
   viewport, so a 500×500 artboard in a 600×400 window reads mostly blank — which
   is what tripped the blank-baseline guard on the rocket. */
const chrome = spawn(CHROME, ["--headless=new","--remote-debugging-port=0",`--user-data-dir=${profile}`,"--no-first-run","--no-default-browser-check","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader",`--window-size=${W+120},${H+120}`,"about:blank"], { stdio: "ignore" });

/** Opaque-ish pixel count + luma sum of the captured rect. */
async function signature(pngB64) {
  const { data, info } = await sharp(Buffer.from(pngB64, "base64"))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, s = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const lum = (data[i] + data[i+1] + data[i+2]) / 3;
    if (lum > 10) { n++; s += lum; }   // background is #000
  }
  return { n, s: Math.round(s) };
}

try {
  let port;
  for (let i=0;i<80&&!port;i++){try{port=readFileSync(join(profile,"DevToolsActivePort"),"utf8").split("\n")[0].trim();}catch{await sleep(250);}}
  const t=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x=>x.type==="page");
  const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>(ws.onopen=r));
  let id=0; const p=new Map();
  ws.onmessage=(e)=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
  const send=(m,q)=>new Promise(r=>{const i=++id;p.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:q}));});
  const ev=async(x,aw=false)=>{const r=await send("Runtime.evaluate",{expression:x,awaitPromise:aw,returnByValue:true});
    if(r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
    return r.result.result.value;};
  const shot = async () => {
    const r = await send("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: false,
      clip: { x: 0, y: 0, width: W, height: H, scale: 1 },
    });
    return signature(r.result.data);
  };

  await send("Page.navigate", { url: origin + "/" });
  await sleep(1200);
  const names = await ev("window.__ready", true);
  console.log(`file      ${RIV}`);
  console.log(`artboard  ${ARTBOARD} · machine ${MACHINE}`);
  console.log(`inputs    ${JSON.stringify(names)}\n`);
  if (!names.includes(INPUT)) { console.log(`✗ "${INPUT}" not in this machine`); process.exit(1); }

  /* ── settled idle baseline ── */
  await sleep(2500);
  const idleF = [];
  for (let i=0;i<12;i++){ idleF.push(await shot()); await sleep(60); }
  const mean=(a)=>a.reduce((x,y)=>x+y,0)/a.length;
  const sdev=(a)=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)));};
  const iN=mean(idleF.map(f=>f.n)), iS=mean(idleF.map(f=>f.s));
  const sN=sdev(idleF.map(f=>f.n)), sS=sdev(idleF.map(f=>f.s));

  /* THE GUARD. A blank baseline means the capture is broken, not that the file
     is static — refuse to draw any conclusion from it. */
  if (iN < 50) {
    console.log(`✗ ABORT: idle baseline is blank (${iN.toFixed(1)} lit pixels).`);
    console.log(`  The canvas is not being captured — no conclusion is possible.`);
    process.exit(2);
  }

  const tolN = Math.max(sN*3, 12), tolS = Math.max(sS*3, 1500);
  console.log(`idle baseline   lit ${iN.toFixed(1)} ±${sN.toFixed(1)}   luma ${iS.toFixed(0)} ±${sS.toFixed(0)}`);
  console.log(`gate            |Δlit| > ${tolN.toFixed(1)}   or   |Δluma| > ${tolS.toFixed(0)}\n`);

  await ev(`window.__inputs[${JSON.stringify(INPUT)}].value = true`);
  await sleep(600);
  const held = await shot();
  console.log(`held true 600ms   lit ${held.n}  luma ${held.s}   Δlit ${(held.n-iN).toFixed(0)}  Δluma ${(held.s-iS).toFixed(0)}`);

  const t0 = Date.now();
  await ev(`window.__inputs[${JSON.stringify(INPUT)}].value = false`);
  const frames = [];
  while (Date.now() - t0 < 2200) {
    const f = await shot();
    frames.push({ t: Date.now() - t0, ...f });
  }

  console.log(`\nfalling edge — after clearing "${INPUT}":`);
  let last = -1;
  for (const f of frames) {
    const dn=f.n-iN, ds=f.s-iS;
    const diff = Math.abs(dn)>tolN || Math.abs(ds)>tolS;
    if (diff) last = f.t;
    console.log(`  t=${String(f.t).padStart(4)}ms  lit ${String(f.n).padStart(5)}  Δlit ${(dn>=0?"+":"")+dn.toFixed(0).padStart(5)}  Δluma ${(ds>=0?"+":"")+ds.toFixed(0).padStart(8)}  ${diff?"◀ DIFFERS":"= idle"}`);
  }
  const differing = frames.filter(f=>Math.abs(f.n-iN)>tolN||Math.abs(f.s-iS)>tolS).length;
  console.log(`\n  ${differing}/${frames.length} post-clear frames differ from idle`);
  console.log(last>0
    ? `\n✓ EXIT ANIMATION EXISTS — last differing frame at t=${last}ms after the input cleared`
    : `\n✗ no exit animation detected — frames settle to idle immediately`);
} finally {
  chrome.kill(); server.close();
  try{rmSync(profile,{recursive:true,force:true});}catch{}
}
