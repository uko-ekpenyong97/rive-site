import { useEffect, useRef, useState } from "react";
import LoopCanvas, { BEATS as LOOP_BEATS, type Beat } from "./LoopCanvas";
import SectionHeader from "./SectionHeader";
import "./WorkflowStack.css";

interface WorkflowCard {
  step: string;
  eyebrow: string;
  title: string;
  body: string;
}

const CARDS: WorkflowCard[] = [
  {
    step: "STEP 01",
    eyebrow: "DESIGN",
    title: "Design it once",
    body: "Vector tools, responsive layouts, and reusable components — or import from the design tools you already use.",
  },
  {
    step: "STEP 02",
    eyebrow: "ANIMATE",
    title: "Bring it to life",
    body: "Timelines, keyframes, and smooth interpolation on the same file — no export, no handoff.",
  },
  {
    step: "STEP 03",
    eyebrow: "WIRE IT UP",
    title: "Make it respond",
    body: "State machines and listeners turn animation into behavior — hovers, presses, and app state drive what plays, right on the artboard.",
  },
  {
    step: "STEP 04",
    eyebrow: "BIND YOUR DATA",
    title: "Connect it to live data",
    body: "View models bind your design to real data — the contract between design and code. Numbers, text, colors, and states update the moment the data does. Need custom behavior? Script it, right in the file.",
  },
  {
    step: "STEP 05",
    eyebrow: "SHIP EVERYWHERE",
    title: "Same file, every runtime",
    body: "Run it natively on web, iOS, Android, Unity, Unreal, and embedded devices. What you built is what ships.",
  },
];

/* One source with LoopCanvas — these are the file's own enum values, and the
   card order IS the beat order. Duplicating the list here would let the two
   drift with nothing to notice. */
const BEATS: readonly Beat[] = LOOP_BEATS;

/* Feel dials */
const BIND_STALL_FRAC = 0.08; // last 8% of the beat-4 zone holds 99 (the joke)
const BIND_MAX_BEFORE_STALL = 99;

export function WorkflowStack() {
  const cardsRef = useRef<(HTMLElement | null)[]>([]);
  const bindZoneLenRef = useRef(0);
  const [beat, setBeat] = useState<Beat>("design");
  const progressTargetRef = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let raf = 0;
    let scheduled = false;
    let ownerIndex = 0;

    /* A card "owns" the beat once its top reaches its computed pin offset.
     * Sticky pin offsets live in CSS (top: 96px + index * stagger); they are
     * read once (and on resize) — computed-style reads per scroll frame cause
     * measurable jank while the performance timelines are playing. */
    let pinTops: number[] = [];
    const readPinTops = () => {
      pinTops = cardsRef.current.map((card) => (card ? parseFloat(getComputedStyle(card).top) || 96 : 96));
    };

    /* Hysteresis: a pinned sticky card's measured top can oscillate around its
     * pin during scroll; without slack the beat flickers and restarts the
     * entry one-shot (visibly jarring mid-performance). Entering a beat is
     * exact; giving it back requires scrolling EXIT_SLACK px back up. */
    const EXIT_SLACK = 24;

    const measure = () => {
      scheduled = false;
      const cards = cardsRef.current;
      if (pinTops.length !== cards.length) readPinTops();
      let next = 0;
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card) continue;
        const slack = i <= ownerIndex ? EXIT_SLACK : 1;
        if (card.getBoundingClientRect().top <= pinTops[i] + slack) next = i;
      }
      ownerIndex = next;
      const nextBeat = BEATS[ownerIndex] ?? "design";
      setBeat((prev) => (prev === nextBeat ? prev : nextBeat));

      /* Beat-4 progress: local position inside card 5's approach (the zone
       * between card 4 pinning and card 5 pinning). Warp per spec: first 92%
       * of the zone maps 0–99 linearly, the rest holds 99; the zone end IS
       * the beat-5 threshold, so 100 and Celebrate fire on one scroll event.
       * Bidirectional and unclamped in reverse — reversibility is the proof. */
      let target = 0;
      const liveCard = cards[4];
      if (nextBeat === "live") {
        target = 100;
      } else if (liveCard) {
        const remaining = liveCard.getBoundingClientRect().top - (pinTops[4] ?? 96);
        if (nextBeat === "bind") {
          if (remaining > bindZoneLenRef.current) bindZoneLenRef.current = remaining;
          const zone = bindZoneLenRef.current || 1;
          const t = Math.min(Math.max(1 - remaining / zone, 0), 1);
          target =
            t < 1 - BIND_STALL_FRAC
              ? (t / (1 - BIND_STALL_FRAC)) * BIND_MAX_BEFORE_STALL
              : BIND_MAX_BEFORE_STALL;
        }
      }
      progressTargetRef.current = target;
    };

    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      raf = requestAnimationFrame(measure);
    };
    const onResize = () => {
      pinTops = [];
      onScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    measure();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="workflow-stack">
      <SectionHeader eyebrow="ONE FILE, START TO SHIP" title="How Rive works" />

      <div className="workflow-stack__cards">
        <div className="workflow-stack__cardcol">
          {CARDS.map((card, index) => (
            <article
              key={card.step}
              ref={(el) => {
                cardsRef.current[index] = el;
              }}
              className="workflow-stack__card"
              style={{ "--card-index": index } as React.CSSProperties}
            >
              {/* THE BAND IS THE PEEK STRIP. Its height is --stack-stagger
                  exactly, so the part of a covered card that still shows above
                  the next one is this row — which turns the stack into an index
                  of where you are rather than four blank edges. The category
                  label leads because it is what the peek has to carry; STEP NN
                  sits beside it rather than above, so both start at the same y
                  in all five cards. */}
              <div className="workflow-stack__band">
                <span className="workflow-stack__card-eyebrow">{card.eyebrow}</span>
                <span className="workflow-stack__step">{card.step}</span>
              </div>
              <div className="workflow-stack__copy">
                <h3 className="workflow-stack__title">{card.title}</h3>
                <p className="workflow-stack__body">{card.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="workflow-stack__canvas-wrap">
          <LoopCanvas
            className="workflow-stack__canvas"
            beat={beat}
            progressTargetRef={progressTargetRef}
            reduceMotion={reduceMotion}
          />
        </div>
      </div>
    </section>
  );
}

export default WorkflowStack;
