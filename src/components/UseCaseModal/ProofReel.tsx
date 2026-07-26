import type { ProofItem, UseCaseQuote } from "./useCaseContent";
import "./ProofReel.css";

export interface ProofReelProps {
  proof: ProofItem[];
  quote?: UseCaseQuote;
}

/**
 * Customer proof — spec §4.3. Each card is source + one-sentence claim + one
 * stat. Text-first and static by design: video belongs to CaseStudies, because
 * video of interactivity is the After Effects worldview.
 */
export function ProofReel({ proof, quote }: ProofReelProps) {
  return (
    <div className="proof-reel">
      <ul className="proof-reel__cards">
        {proof.map((item) => (
          <li key={`${item.source}-${item.claim}`} className="proof-reel__card">
            <span className="proof-reel__source">{item.source}</span>
            {item.stat && <span className="proof-reel__stat">{item.stat}</span>}
            <p className="proof-reel__claim">{item.claim}</p>
          </li>
        ))}
      </ul>

      {quote && (
        <blockquote className="proof-reel__quote">
          <p className="proof-reel__quote-text">“{quote.text}”</p>
          <footer className="proof-reel__quote-by">{quote.attribution}</footer>
        </blockquote>
      )}
    </div>
  );
}

export default ProofReel;
