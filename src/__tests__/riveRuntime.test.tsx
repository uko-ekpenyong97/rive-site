import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The self-hosted Rive wasm — the join between source and committed artifact.
 *
 * WHAT THIS LAYER CAN AND CANNOT SEE. These are cheap structural guards: that
 * the runtime is pointed at our files, that both setters are called, and that
 * the files named actually exist. They cannot prove the wasm LOADS — the Rive
 * runtime is mocked here, so a mock would happily agree with a URL that 404s.
 *
 * The real proof is split across two other gates, deliberately:
 *   `npm run check:assets`   pins the committed bytes to node_modules (CI)
 *   `npm run check:offline`  blocks both CDNs, loads the site for real, and
 *                            asserts every surface still mounts and paints
 *
 * That last one is the acceptance test. This file is the fast tripwire.
 */

const setWasmUrl = vi.hoisted(() => vi.fn());
const setWasmFallbackUrl = vi.hoisted(() => vi.fn());

vi.mock("@rive-app/react-webgl2", () => ({
  RuntimeLoader: { setWasmUrl, setWasmFallbackUrl },
}));

const {
  configureRiveRuntime,
  RIVE_WASM_URL,
  RIVE_WASM_FALLBACK_URL,
  RIVE_WASM_VERSION,
} = await import("../riveRuntime");

const ROOT = process.cwd();
const source = readFileSync(join(ROOT, "src/riveRuntime.ts"), "utf8");
/** The pathname the browser would request, independent of BASE_URL. */
const publicPath = (url: string) => join(ROOT, "public", url.replace(/^\/+/, ""));

beforeEach(() => {
  setWasmUrl.mockClear();
  setWasmFallbackUrl.mockClear();
});

describe("the wasm URLs", () => {
  it("point at our own origin, never a CDN", () => {
    for (const url of [RIVE_WASM_URL, RIVE_WASM_FALLBACK_URL]) {
      expect(url.startsWith("http")).toBe(false);
      expect(url).not.toContain("unpkg.com");
      expect(url).not.toContain("cdn.jsdelivr.net");
      expect(url).toContain("/rive/runtime/");
    }
  });

  it("carry the runtime version in the filename", () => {
    /* The wasm and the JS that consumes it are one unit. Versioned names mean an
       upgrade cannot silently serve old bytes to a new runtime — the name stops
       matching and check:assets fails. */
    expect(RIVE_WASM_URL).toContain(RIVE_WASM_VERSION);
    expect(RIVE_WASM_FALLBACK_URL).toContain(RIVE_WASM_VERSION);
  });

  it("resolve to files that are actually committed", () => {
    for (const url of [RIVE_WASM_URL, RIVE_WASM_FALLBACK_URL]) {
      expect(existsSync(publicPath(url)), url).toBe(true);
    }
  });

  it("name two DIFFERENT binaries", () => {
    /* rive_fallback.wasm is compiled for older architectures — it is not a
       mirror of the primary. Pointing both at one file would look like a tidy
       simplification and would silently drop support for the CPUs the fallback
       exists to serve. */
    expect(RIVE_WASM_URL).not.toBe(RIVE_WASM_FALLBACK_URL);
    const a = readFileSync(publicPath(RIVE_WASM_URL));
    const b = readFileSync(publicPath(RIVE_WASM_FALLBACK_URL));
    expect(a.equals(b)).toBe(false);
  });
});

describe("configureRiveRuntime", () => {
  it("sets both the primary and the fallback", () => {
    configureRiveRuntime();
    expect(setWasmUrl).toHaveBeenCalledWith(RIVE_WASM_URL);
    expect(setWasmFallbackUrl).toHaveBeenCalledWith(RIVE_WASM_FALLBACK_URL);
  });

  it("never disables the fallback", () => {
    /* setWasmFallbackUrl(null) turns the older-architecture path off entirely. */
    configureRiveRuntime();
    expect(setWasmFallbackUrl).not.toHaveBeenCalledWith(null);
  });

  it("is idempotent, so a second call cannot half-configure the runtime", () => {
    configureRiveRuntime();
    configureRiveRuntime();
    expect(setWasmUrl).toHaveBeenCalledTimes(2);
    expect(new Set(setWasmUrl.mock.calls.map((c) => c[0])).size).toBe(1);
    expect(new Set(setWasmFallbackUrl.mock.calls.map((c) => c[0])).size).toBe(1);
  });
});

describe("the entry point", () => {
  const main = readFileSync(join(ROOT, "src/main.tsx"), "utf8");

  it("configures the runtime before the app renders", () => {
    /* Ordering is the whole contract: the runtime resolves its wasm URL when the
       first surface asks for an instance, so the override has to beat the first
       render every time. */
    expect(main).toContain("configureRiveRuntime()");
    /* Against the createRoot CALL, not the `import { createRoot }` line — which
       naturally sits above everything and made the first version of this
       assertion pass for the wrong reason. */
    const call = main.indexOf("createRoot(document");
    expect(call).toBeGreaterThan(-1);
    expect(main.indexOf("configureRiveRuntime()")).toBeLessThan(call);
  });
});

describe("no CDN path survives", () => {
  it("leaves no live unpkg or jsdelivr URL in the runtime config", () => {
    /* Comments are exempt on purpose — riveRuntime.ts records the exact unpkg
       URL the site used to fetch, and that measured before-state is worth
       keeping. check:assets strips comments and re-checks the code itself. */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("unpkg.com");
    expect(code).not.toContain("cdn.jsdelivr.net");
  });

  it("no component reaches for a CDN wasm of its own", () => {
    /* A per-component override would reintroduce the dependency in one place
       while the global config kept the test green everywhere else. */
    const files = import.meta.glob("../components/**/*.{ts,tsx}", {
      eager: true,
      query: "?raw",
      import: "default",
    }) as Record<string, string>;
    for (const [path, contents] of Object.entries(files)) {
      expect(contents, path).not.toContain("unpkg.com");
      expect(contents, path).not.toContain("cdn.jsdelivr.net");
      expect(contents, path).not.toContain("setWasmUrl");
    }
  });
});
