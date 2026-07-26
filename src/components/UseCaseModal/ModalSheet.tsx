import { useId, type ReactNode } from "react";
import "./ModalSheet.css";

export interface ModalSheetProps {
  /** Modal H2 — also labels the dialog for assistive tech. */
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children?: ReactNode;
}

/**
 * The rising card. Owns the `role="dialog"` semantics; ModalRoot supplies the
 * scrim, scroll lock, focus trap, and motion around it. Bottom bleeds
 * off-viewport (sheet grammar, not card grammar) — only the top corners round.
 */
export function ModalSheet({ title, eyebrow, onClose, children }: ModalSheetProps) {
  const headingId = useId();

  return (
    <section
      className="modal-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      {/* Mobile-only drag-handle affordance (swipe-to-dismiss is v2). */}
      <span className="modal-sheet__handle" aria-hidden="true" />

      <button
        type="button"
        className="modal-sheet__close"
        onClick={onClose}
        aria-label="Close dialog"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="modal-sheet__body">
        {eyebrow && <span className="modal-sheet__eyebrow">{eyebrow}</span>}
        <h2 id={headingId} className="modal-sheet__title">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export default ModalSheet;
