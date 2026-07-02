import Button from "./Button";
import "./FinalCTA.css";

export function FinalCTA() {
  return (
    <section className="final-cta">
      <div className="final-cta__inner">
        <h2 className="final-cta__headline">Ready to build something alive?</h2>
        <p className="final-cta__support">
          Free to start. Your first artboard is running in minutes — and it ships
          anywhere.
        </p>
        <div className="final-cta__actions">
          <Button variant="primary" href="https://editor.rive.app">
            Open the editor
          </Button>
          <Button variant="secondary" href="#">
            Talk to us
          </Button>
        </div>
      </div>
    </section>
  );
}

export default FinalCTA;
