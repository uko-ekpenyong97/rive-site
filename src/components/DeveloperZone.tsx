import { useEffect, useRef, useState } from "react";
import { html as snippetHtml, source as snippetSource } from "virtual:dev-zone-snippet";
import SectionHeader from "./SectionHeader";
import "./DeveloperZone.css";

interface Runtime {
  label: string;
  href: string;
}

/**
 * The runtime chips and where each one goes.
 *
 * ONE DATA STRUCTURE, not hrefs scattered through JSX — the same shape
 * `useCaseContent` uses, so a docs reorg is one edit in one table and the href
 * pin in `src/__tests__/outboundLinks.test.tsx` diffs instead of the site 404ing
 * quietly.
 *
 * SOURCE: every URL read off rive.app/docs/runtimes/getting-started and verified
 * 200 on 2026-08-01. Three of them do not follow the pattern the labels suggest,
 * which is exactly why they are recorded rather than derived from the label:
 *   · IOS      → Rive publishes this as "Apple", not "ios"
 *   · UNITY    → lives under /game-runtimes/, not /runtimes/
 *   · UNREAL   → likewise /game-runtimes/
 *   · C++      → has no docs subpage at all; the GitHub repo IS the reference
 */
const RUNTIMES: Runtime[] = [
  { label: "WEB", href: "https://rive.app/docs/runtimes/web" },
  { label: "REACT", href: "https://rive.app/docs/runtimes/react" },
  { label: "IOS", href: "https://rive.app/docs/runtimes/apple" },
  { label: "ANDROID", href: "https://rive.app/docs/runtimes/android" },
  { label: "FLUTTER", href: "https://rive.app/docs/runtimes/flutter" },
  { label: "UNITY", href: "https://rive.app/docs/game-runtimes/unity" },
  { label: "UNREAL", href: "https://rive.app/docs/game-runtimes/unreal" },
  { label: "C++", href: "https://github.com/rive-app/rive-cpp" },
];

/** The two section links under the chips. */
const DOCS_URL = "https://rive.app/docs";
/**
 * SOURCE NOTE: rive.app's own site points its "Star on GitHub" link at the ORG
 * page, github.com/rive-app — which cannot be starred, because GitHub has no
 * star action on an organisation. We deliberately diverge and point at the
 * runtime repo, so the label describes something the destination can actually
 * do. Recorded because it is a knowing departure from the reference site, not
 * an oversight in reading it.
 */
const GITHUB_URL = "https://github.com/rive-app/rive-runtime";

/** How long "Copied" stays up before the button goes quiet again. */
const COPIED_MS = 1600;

/**
 * Copies the sample's SOURCE, never the highlighted markup — so what lands on
 * the clipboard is the text the compiler checks, with no span soup and no
 * gutter numbers (those are CSS generated content precisely so they cannot be
 * copied, by this button or by a manual selection).
 */
function CopyButton({ source }: { source: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      /* Clipboard denied or unavailable — say nothing rather than claim a copy
         that did not happen. The sample is still selectable by hand. */
    }
  };

  return (
    <button
      type="button"
      className="developer-zone__clipboard"
      onClick={copy}
      aria-label={copied ? "Code sample copied" : "Copy code sample"}
    >
      {/* Both labels are always in the DOM, stacked, so the button's width is
          the wider of the two and the confirmation shifts nothing. */}
      <span aria-hidden="true" className="developer-zone__clipboard-slot">
        <span data-shown={!copied}>Copy</span>
        <span data-shown={copied}>Copied</span>
      </span>
    </button>
  );
}

export function DeveloperZone() {
  return (
    <section className="developer-zone">
      <SectionHeader eyebrow="FOR DEVELOPERS" title="Built to be built on" />

      <div className="developer-zone__grid">
        {/* Copy column */}
        <div className="developer-zone__copy">
          <p className="developer-zone__body">
            Every runtime is open source. Data binding is the contract —
            designers publish view models, you bind them in code, and both sides
            iterate without waiting on each other. When built-in behavior isn't
            enough, script it directly in the file.
          </p>

          {/* Chips are anchors, not decoration. The box and type are unchanged
              from the <span> they replaced — same padding, border, radius and
              mono 12px — so becoming clickable costs no layout shift. */}
          <div className="developer-zone__pills">
            {RUNTIMES.map(({ label, href }) => (
              <a
                key={label}
                className="developer-zone__pill"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="developer-zone__links">
            <a
              className="text-link"
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the docs →
            </a>
            <a
              className="text-link"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Star on GitHub →
            </a>
          </div>
        </div>

        {/* Code panel */}
        <div className="developer-zone__panel">
          <div className="developer-zone__titlebar">
            <span className="developer-zone__dot" />
            <span className="developer-zone__dot" />
            <span className="developer-zone__dot" />
            <span className="developer-zone__filename">AgentCard.tsx</span>
            <CopyButton source={snippetSource} />
          </div>

          {/* Tokenized at build time from src/components/dev-zone/snippet.tsx —
              a real file that tsc compiles in CI, so this sample cannot teach an
              API the installed runtime no longer has. The markup carries only
              our own three token classes; no highlighter ships. */}
          <pre className="developer-zone__code">
            <code dangerouslySetInnerHTML={{ __html: snippetHtml }} />
          </pre>
        </div>
      </div>
    </section>
  );
}

export default DeveloperZone;
