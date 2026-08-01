import { RuntimeLoader } from "@rive-app/react-webgl2";

/**
 * Points the Rive runtime at OUR copies of its WebAssembly, retiring the CDN.
 *
 * WHAT THIS FIXES: out of the box, @rive-app/webgl2 fetches ~2.4 MB of wasm from
 * unpkg at runtime, with jsdelivr behind it. On hostile wifi, behind a corporate
 * proxy, or during a CDN incident, every Rive surface on this site fails to load
 * and degrades to its DOM fallback — gracefully absent, but absent, and the hero
 * CTAs are where absence costs most. Measured before this change, a fresh load
 * made exactly one such request:
 *   https://unpkg.com/@rive-app/webgl2@2.39.1/rive.wasm
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TWO FILES ARE NOT A CDN AND ITS MIRROR. DO NOT "SIMPLIFY" TO ONE.
 *
 * It is tempting to read `wasmUrl` and `wasmFallbackUrl` as "primary host" and
 * "backup host" and to conclude that self-hosting makes the second redundant.
 * That is wrong, and the runtime says so itself (@rive-app/webgl2 2.39.1,
 * rive.js:224):
 *
 *   > In case the primary URL fails, or the wasm was not supported, try the
 *   > fallback URL (a rive_fallback.wasm compiled for older architectures).
 *
 * They are DIFFERENT BINARIES. `rive.wasm` is the modern build; the runtime
 * falls back to `rive_fallback.wasm` both when the primary cannot be fetched AND
 * when it cannot be COMPILED — a `WebAssembly.CompileError` on a CPU that lacks
 * the instructions the modern build assumes. Dropping the fallback, or pointing
 * it at the same file as the primary, silently drops support for those machines.
 * It would never show up in review or in local testing, because the machines it
 * breaks are by definition not the ones we develop on.
 *
 * So both are committed under public/rive/runtime/ and both are pinned by
 * `npm run check:assets`. Passing `null` to setWasmFallbackUrl would disable the
 * fallback entirely; we never do.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * VERSIONED FILENAMES are the point of the naming, not decoration. The wasm and
 * the JS runtime that consumes it are one unit; a runtime upgrade with a stale
 * wasm is undefined behaviour. Encoding the version means an upgrade cannot
 * silently serve old bytes to a new runtime — the filename stops matching and
 * check:assets fails, which is the config-vs-artifact drift guard this repo
 * applies to every .riv as well.
 *
 * ON UPGRADING @rive-app/webgl2: re-copy BOTH files from node_modules under the
 * new version's names, update the constants below, and re-run check:assets.
 * There is no step that does this for you.
 */

/**
 * The installed @rive-app/webgl2 version. check:assets asserts this against
 * node_modules, so it cannot quietly drift from the runtime actually bundled.
 */
export const RIVE_WASM_VERSION = "2.39.1";

/* BASE_URL, not a bare "/": a deploy under a sub-path would otherwise request
   the wasm from the domain root and get the CDN failure mode back by accident —
   this time with no CDN behind it. */
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

/** The modern build. Byte-identical to node_modules/@rive-app/webgl2/rive.wasm. */
export const RIVE_WASM_URL = `${base}/rive/runtime/rive-${RIVE_WASM_VERSION}.wasm`;

/** The older-architecture build. See the block above — this is not a mirror. */
export const RIVE_WASM_FALLBACK_URL = `${base}/rive/runtime/rive_fallback-${RIVE_WASM_VERSION}.wasm`;

/**
 * Call ONCE, before anything mounts a Rive canvas.
 *
 * The runtime resolves its wasm URL when the first surface asks for an instance,
 * so this only has to beat the first render — but it has to beat it every time,
 * which is why main.tsx calls it explicitly before createRoot().render() rather
 * than relying on module import order to produce the side effect.
 *
 * Idempotent: both setters are plain assignments, so StrictMode's double
 * invocation and any accidental second call are harmless.
 */
export function configureRiveRuntime(): void {
  RuntimeLoader.setWasmUrl(RIVE_WASM_URL);
  RuntimeLoader.setWasmFallbackUrl(RIVE_WASM_FALLBACK_URL);
}
