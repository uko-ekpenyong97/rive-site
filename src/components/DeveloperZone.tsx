import SectionHeader from "./SectionHeader";
import "./DeveloperZone.css";

const RUNTIMES = [
  "WEB",
  "REACT",
  "IOS",
  "ANDROID",
  "FLUTTER",
  "UNITY",
  "UNREAL",
  "C++",
];

/* Three-tone token highlighting — plain spans, no highlighting library.
   base: --text-secondary · str: --text-accent · com: --text-muted · kw: --text-primary */
const S = ({ children }: { children: React.ReactNode }) => (
  <span className="dz-str">{children}</span>
);
const C = ({ children }: { children: React.ReactNode }) => (
  <span className="dz-com">{children}</span>
);
const K = ({ children }: { children: React.ReactNode }) => (
  <span className="dz-kw">{children}</span>
);

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

          <div className="developer-zone__pills">
            {RUNTIMES.map((rt) => (
              <span key={rt} className="developer-zone__pill">
                {rt}
              </span>
            ))}
          </div>

          <div className="developer-zone__links">
            <a className="text-link" href="https://rive.app/docs">
              Read the docs →
            </a>
            <a className="text-link" href="https://github.com/rive-app">
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
            <span className="developer-zone__filename">App.tsx</span>
          </div>

          <pre className="developer-zone__code">
            <code>
              <K>import</K> {"{ useRive }"} <K>from</K>{" "}
              <S>'@rive-app/react-canvas'</S>;{"\n"}
              {"\n"}
              <K>export function</K> <K>Hero</K>() {"{"}
              {"\n"}
              {"  "}
              <K>const</K> {"{ rive, RiveComponent }"} = <K>useRive</K>({"{"}
              {"\n"}
              {"    "}src: <S>'hero.riv'</S>,{"\n"}
              {"    "}stateMachines: <S>'Main'</S>,{"\n"}
              {"    "}autoplay: <K>true</K>,{"\n"}
              {"    "}autoBind: <K>true</K>, <C>{"// binds the default view model"}</C>
              {"\n"}
              {"  "}{"}"});{"\n"}
              {"\n"}
              {"  "}
              <C>{"// design's contract, live in code"}</C>
              {"\n"}
              {"  "}rive?.viewModelInstance?.<K>number</K>(<S>'progress'</S>).value
              = <K>0.5</K>;{"\n"}
              {"\n"}
              {"  "}
              <K>return</K> {"<"}
              <K>RiveComponent</K> {"/>"};{"\n"}
              {"}"}
              {"\n"}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

export default DeveloperZone;
