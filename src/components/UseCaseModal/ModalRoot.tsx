import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  dialsToStyle,
  exitDurationMs,
  resolveDials,
  type ModalDials,
} from "./dials";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import "./ModalRoot.css";

/* ──────────────────────────────────────────────────────────────────────────
 * MODAL STATE MACHINE
 *
 *  closed ──open=true──► opening ──(2 frames)──► open
 *     ▲                                            │
 *     └──────── (unmount after exit) ◄── closing ◄─┘  open=false
 *
 *  data-state drives the CSS: `opening` holds the hidden initial frame so the
 *  entrance transition has somewhere to travel from; `open` is the resting
 *  state; `closing` swaps in the faster exit timing. The overlay stays mounted
 *  through `closing` so the exit choreography can play, then unmounts.
 * ────────────────────────────────────────────────────────────────────────── */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    // getClientRects() is empty for display:none but non-empty for visible
    // elements including position:fixed/sticky — offsetParent would wrongly
    // drop fixed-positioned controls.
    (el) => el.getClientRects().length > 0,
  );
}

export interface ModalRootProps {
  open: boolean;
  onClose: () => void;
  /** Partial override of the §6 dial defaults (used by the live tuning panel). */
  dials?: Partial<ModalDials>;
  /** Force the reduced-motion path on/off; defaults to the system preference. */
  reducedMotion?: boolean;
  /** The rising card — a <ModalSheet>. */
  children: ReactNode;
  className?: string;
}

export function ModalRoot({
  open,
  onClose,
  dials: dialOverride,
  reducedMotion,
  children,
  className,
}: ModalRootProps) {
  const systemReduce = usePrefersReducedMotion();
  const reduce = reducedMotion ?? systemReduce;

  const dials = resolveDials(dialOverride);
  const overlayRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // `mounted` = present in the DOM; `active` = resting/open (drives data-state).
  const [mounted, setMounted] = useState(open);
  const [active, setActive] = useState(false);

  // Mount as soon as we're asked to open.
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Entrance / exit choreography. Two rAFs guarantee a painted hidden frame
  // before we flip to `open`, so the transition actually plays.
  useLayoutEffect(() => {
    if (!mounted) return;

    if (open) {
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setActive(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    // open === false while still mounted → run the exit, then unmount.
    setActive(false);
    const timer = window.setTimeout(
      () => setMounted(false),
      exitDurationMs(dials, reduce),
    );
    return () => window.clearTimeout(timer);
    // dials/reduce intentionally omitted: exit timing is captured at close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, open]);

  // Scroll lock on <html> with scrollbar-width compensation, exact restore.
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPaddingRight = html.style.paddingRight;
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    html.style.overflow = "hidden";
    if (scrollbarWidth > 0) html.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPaddingRight;
    };
  }, [mounted]);

  // Containment: inert the app background, move focus into the sheet on open,
  // return focus to the trigger on close. The overlay (and the dev dial panel)
  // portal into <body> as siblings of #root, so inert-ing #root leaves them
  // interactive while making the receded page non-interactive for pointer AND
  // the AT virtual cursor — the guarantee aria-modal alone can't make.
  useEffect(() => {
    if (!mounted) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const appRoot = document.getElementById("root");
    appRoot?.setAttribute("inert", "");

    const raf = requestAnimationFrame(() => {
      const first = getFocusable(overlayRef.current)[0];
      (first ?? overlayRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      // Un-inert BEFORE restoring focus, or the trigger is still non-focusable.
      appRoot?.removeAttribute("inert");
      // Restore focus without yanking the page back into view.
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [mounted]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = getFocusable(overlayRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  // Click on the overlay's own background (not the sheet) dismisses.
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  if (!mounted) return null;

  const dataState = active ? "open" : open ? "opening" : "closing";

  return createPortal(
    <div
      ref={overlayRef}
      className={["modal-overlay", className].filter(Boolean).join(" ")}
      data-state={dataState}
      data-motion={reduce ? "reduced" : "full"}
      style={dialsToStyle(dials)}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={handleOverlayClick}
    >
      <div className="modal-scrim" aria-hidden="true" />
      {children}
    </div>,
    document.body,
  );
}

export default ModalRoot;
