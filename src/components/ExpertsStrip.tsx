import "./ExpertsStrip.css";

interface Expert {
  title: string;
  line: string;
  cta: string;
  href: string;
}

const EXPERTS: Expert[] = [
  {
    title: "Rive Experts",
    line: "Certified builders for hire — bring one onto your next launch.",
    cta: "Find an expert →",
    href: "https://rive.app/experts",
  },
  {
    title: "Community",
    line: "Thousands of builders sharing files, feedback, and techniques.",
    cta: "Join the community →",
    href: "https://rive.app/community",
  },
  {
    title: "Documentation",
    line: "Every runtime, every API, data binding to scripting.",
    cta: "Read the docs →",
    href: "https://rive.app/docs",
  },
];

/**
 * A quiet coda beneath CaseStudies: three ways to get help shipping. Reuses the
 * AudienceRails visual language (top hairline + padding-top columns) at a
 * smaller, calmer scale — no SectionHeader, so it reads as a beat, not a stop.
 */
export function ExpertsStrip() {
  return (
    <section className="experts-strip">
      <h2 className="experts-strip__heading">Ship with help</h2>

      <div className="experts-strip__grid">
        {EXPERTS.map((expert) => (
          <div key={expert.title} className="experts-strip__col">
            <h3 className="experts-strip__title">{expert.title}</h3>
            <p className="experts-strip__line">{expert.line}</p>
            <a className="text-link" href={expert.href}>
              {expert.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ExpertsStrip;
