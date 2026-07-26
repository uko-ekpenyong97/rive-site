import Button from "../Button";
import "./ModalCTA.css";

export interface ModalCTAProps {
  /**
   * The use case's own page — the escape valve, deliberately last (§4.7).
   * Omitted when the use case has no page, in which case the modal simply ends
   * at "Get started".
   */
  pageHref?: string;
  /** e.g. "Game UI" — completes "Everything about {label} →". */
  label: string;
  editorHref: string;
}

export function ModalCTA({ pageHref, label, editorHref }: ModalCTAProps) {
  return (
    <div className="modal-cta">
      <Button variant="primary" href={editorHref}>
        Get started
      </Button>
      {pageHref && (
        <a className="text-link modal-cta__page" href={pageHref}>
          Everything about {label} →
        </a>
      )}
    </div>
  );
}

export default ModalCTA;
