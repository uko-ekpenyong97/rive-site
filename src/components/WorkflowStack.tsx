import DemoSlot from "./DemoSlot";
import SectionHeader from "./SectionHeader";
import "./WorkflowStack.css";

interface WorkflowCard {
  step: string;
  eyebrow: string;
  title: string;
  body: string;
  demoLabel: string;
}

const CARDS: WorkflowCard[] = [
  {
    step: "STEP 01",
    eyebrow: "DESIGN",
    title: "Design it once",
    body: "Vector tools, responsive layouts, and reusable components — or import from the design tools you already use.",
    demoLabel: "● STAGE 1 — VECTORS ON THE ARTBOARD",
  },
  {
    step: "STEP 02",
    eyebrow: "ANIMATE",
    title: "Bring it to life",
    body: "Timelines, keyframes, and smooth interpolation on the same file — no export, no handoff.",
    demoLabel: "● STAGE 2 — THE SAME FILE, NOW MOVING",
  },
  {
    step: "STEP 03",
    eyebrow: "WIRE IT UP",
    title: "Make it respond",
    body: "State machines and listeners turn animation into behavior — hovers, presses, and app state drive what plays, right on the artboard.",
    demoLabel: "● STAGE 3 — NOW IT RESPONDS TO YOU",
  },
  {
    step: "STEP 04",
    eyebrow: "BIND YOUR DATA",
    title: "Connect it to live data",
    body: "View models bind your design to real data — the contract between design and code. Numbers, text, colors, and states update the moment the data does. Need custom behavior? Script it, right in the file.",
    demoLabel: "● STAGE 4 — DRIVEN BY LIVE DATA",
  },
  {
    step: "STEP 05",
    eyebrow: "SHIP EVERYWHERE",
    title: "Same file, every runtime",
    body: "Run it natively on web, iOS, Android, Unity, Unreal, and embedded devices. What you built is what ships.",
    demoLabel: "● STAGE 5 — RUNNING IN PRODUCTION",
  },
];

export function WorkflowStack() {
  return (
    <section className="workflow-stack">
      <SectionHeader eyebrow="ONE FILE, START TO SHIP" title="How Rive works" />

      <div className="workflow-stack__cards">
        {CARDS.map((card, index) => (
          <article
            key={card.step}
            className="workflow-stack__card"
            style={{ "--card-index": index } as React.CSSProperties}
          >
            <div className="workflow-stack__copy">
              <span className="workflow-stack__step">{card.step}</span>
              <span className="workflow-stack__card-eyebrow">{card.eyebrow}</span>
              <h3 className="workflow-stack__title">{card.title}</h3>
              <p className="workflow-stack__body">{card.body}</p>
            </div>
            <DemoSlot className="workflow-stack__demo" label={card.demoLabel} />
          </article>
        ))}
      </div>
    </section>
  );
}

export default WorkflowStack;
