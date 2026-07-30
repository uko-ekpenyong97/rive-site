// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { html as snippetHtml, source as snippetSource } from "virtual:dev-zone-snippet";
import rawSnippetFile from "../components/dev-zone/snippet.tsx?raw";
import { DeveloperZone } from "../components/DeveloperZone";
import { text } from "./helpers";

/**
 * DeveloperZone code window.
 *
 * The sample is a REAL FILE that tsc compiles in CI. These tests guard the two
 * things a compiler cannot: that the text on screen is that file's text, and
 * that no highlighter ships to a visitor.
 */

/** The documented display rule: everything from the first `import` onward. */
const displaySource = rawSnippetFile
  .slice(rawSnippetFile.indexOf("import "))
  .trimEnd();

/** Undo the escaping the tokenizer applies, so markup can be compared to source. */
const unescape = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The snippet's own text, recovered from the highlighted markup. */
const htmlText = () =>
  unescape(
    snippetHtml
      // Each source line is one <span class="dz-line">…</span>, joined by \n.
      .replace(/<\/span>\n<span class="dz-line">/g, "\n")
      .replace(/<[^>]+>/g, ""),
  );

/* ── the anti-drift invariant ─────────────────────────────────────────────── */

describe("the rendered sample is the file the compiler checks", () => {
  /* THE test. Comparing the raw import to itself would only prove Vite reads a
     file twice the same way; this compares the tokenizer's OUTPUT against an
     independent read of the source, so highlighting cannot silently drop,
     reorder or mangle a line. */
  it("stripped highlighted markup equals the snippet source, byte for byte", () => {
    expect(htmlText()).toBe(displaySource);
  });

  it("the copied source is that same text", () => {
    expect(snippetSource).toBe(displaySource);
  });

  /* The file opens with a note to whoever edits it. That belongs in the repo,
     not on the marketing page. */
  it("shows the code and not the file's editing note", () => {
    expect(rawSnippetFile).toContain("It typechecks in CI on purpose");
    expect(snippetSource).not.toContain("It typechecks in CI on purpose");
    expect(snippetSource.startsWith("import ")).toBe(true);
  });
});

/* ── the argument the sample is making ────────────────────────────────────── */

describe("the sample demonstrates the section's own claim", () => {
  /* "Data binding is the contract — bind in code, design keeps moving." A sample
     that did not bind would be the section contradicting itself in its own
     illustration. Pinned in the same spirit as the no-handoff copy guard. */
  it("binds a view model in both directions", () => {
    expect(snippetSource).toContain("autoBind");
    expect(snippetSource).toContain("viewModelInstance");
    // Write: code drives design. Subscribe: design reports back.
    expect(snippetSource).toMatch(/state\.value = /);
    expect(snippetSource).toMatch(/state\.on\(/);
    expect(snippetSource).toMatch(/state\.off\(/);
  });

  /* The three comments are the section thesis annotated onto working code. */
  it("keeps the three annotations that carry the argument", () => {
    expect(snippetSource).toContain("// bind the default view model");
    expect(snippetSource).toContain("// code drives design");
    expect(snippetSource).toContain("// design reports back");
  });

  /* Accessibility falling out of data binding for free — a quiet flex, and a
     line-budget pass must not remove it. */
  it("shows the bound value doing real work", () => {
    expect(snippetSource).toContain("aria-label={status}");
  });

  /* The site ships WebGL2 and chose it for performance. The old sample named
     react-canvas, which is the section advertising a runtime we rejected. */
  it("names the runtime this site actually ships", () => {
    expect(snippetSource).toContain("@rive-app/react-webgl2");
    expect(snippetSource).not.toContain("react-canvas");
  });
});

/* ── highlighting is build-time only ──────────────────────────────────────── */

describe("no highlighter reaches a visitor", () => {
  it("emits only our own three token classes", () => {
    const classes = [...snippetHtml.matchAll(/class="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(new Set(classes)).toEqual(
      new Set(["dz-line", "dz-kw", "dz-str", "dz-com"]),
    );
  });

  /* shiki's own codeToHtml writes inline hex on every span. Using it as a
     tokenizer instead is what keeps a dark-only, single-accent site from
     sprouting a rainbow — and keeps the colours in tokens, where they belong. */
  it("carries no inline colours and no hardcoded hex", () => {
    expect(snippetHtml).not.toContain("style=");
    expect(snippetHtml).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("marks up every source line so the gutter can be a counter", () => {
    const lines = [...snippetHtml.matchAll(/class="dz-line"/g)].length;
    expect(lines).toBe(displaySource.split("\n").length);
  });
});

/* ── the window ───────────────────────────────────────────────────────────── */

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
});

async function mount() {
  await act(async () => {
    root!.render(<DeveloperZone />);
  });
  return host!;
}

describe("the code window", () => {
  it("renders the sample text into the panel", async () => {
    await mount();
    const code = host!.querySelector(".developer-zone__code");
    expect(code?.textContent).toContain("autoBind");
    expect(code?.textContent).toContain("@rive-app/react-webgl2");
  });

  it("names the file in the titlebar", async () => {
    await mount();
    expect(host!.querySelector(".developer-zone__filename")?.textContent).toBe(
      "AgentCard.tsx",
    );
  });

  it("server-renders without a highlighter", () => {
    const rendered = renderToString(<DeveloperZone />);
    expect(text(rendered)).toContain("autoBind");
  });
});

describe("the copy button", () => {
  const clipboard = () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    return writeText;
  };

  it("has an accessible name", async () => {
    await mount();
    const button = host!.querySelector(".developer-zone__clipboard");
    expect(button?.getAttribute("aria-label")).toBe("Copy code sample");
    expect(button?.tagName).toBe("BUTTON");
  });

  /* The clipboard must get the SOURCE — not the highlighted markup, and not the
     gutter numbers. */
  it("writes the exact snippet source", async () => {
    const writeText = clipboard();
    await mount();
    const button = host!.querySelector(
      ".developer-zone__clipboard",
    ) as HTMLButtonElement;

    await act(async () => {
      button.click();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(displaySource);
    const written = writeText.mock.calls[0][0] as string;
    expect(written).not.toContain("<span");
    expect(written).not.toMatch(/^\s*\d+\s/m);
  });

  it("confirms the copy in its accessible name", async () => {
    clipboard();
    await mount();
    const button = host!.querySelector(
      ".developer-zone__clipboard",
    ) as HTMLButtonElement;

    await act(async () => {
      button.click();
    });

    expect(button.getAttribute("aria-label")).toBe("Code sample copied");
  });

  /* Both labels stay in the DOM so the button cannot resize when it swaps. */
  it("keeps both labels mounted so the swap shifts no layout", async () => {
    await mount();
    const slot = host!.querySelector(".developer-zone__clipboard-slot");
    const labels = [...(slot?.children ?? [])].map((c) => c.textContent);
    expect(labels).toEqual(["Copy", "Copied"]);
  });

  it("stays quiet when the clipboard refuses", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    await mount();
    const button = host!.querySelector(
      ".developer-zone__clipboard",
    ) as HTMLButtonElement;

    await act(async () => {
      button.click();
    });

    // No false confirmation of a copy that did not happen.
    expect(button.getAttribute("aria-label")).toBe("Copy code sample");
  });
});
