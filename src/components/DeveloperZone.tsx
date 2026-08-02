import { useEffect, useRef, useState } from "react";
import { html as snippetHtml, source as snippetSource } from "virtual:dev-zone-snippet";
import SectionHeader from "./SectionHeader";
import { PLATFORM_DOCS, type PlatformId, type PlatformRef } from "./platformDocs";
import "./DeveloperZone.css";

/**
 * The runtime chips and where each one goes.
 *
 * Destinations come from the shared PLATFORM_DOCS map, which the modals' "Runs
 * on" chips also read — six platforms appear on both surfaces, and two lists
 * would drift the moment Rive reorganises a docs section. The uppercase labels
 * here are this section's own typography; the map is keyed by canonical id
 * precisely so each surface keeps its own spelling.
 *
 * Typed as the LINKED variant of PlatformRef: every chip in this section has a
 * destination, so the null case is excluded here rather than asserted away at
 * the point of use. The modals' chips use the full PlatformRef, because one of
 * theirs is deliberately link-less.
 */
type LinkedRuntime = PlatformRef & { platform: PlatformId };

const RUNTIMES: LinkedRuntime[] = [
  { label: "WEB", platform: "web" },
  { label: "REACT", platform: "react" },
  { label: "IOS", platform: "apple" },
  { label: "ANDROID", platform: "android" },
  { label: "FLUTTER", platform: "flutter" },
  { label: "UNITY", platform: "unity" },
  { label: "UNREAL", platform: "unreal" },
  { label: "C++", platform: "cpp" },
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
            {RUNTIMES.map(({ label, platform }) => (
              <a
                key={label}
                className="developer-zone__pill"
                href={PLATFORM_DOCS[platform]}
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
