import type { CSSProperties } from "react";
import "./DemoSlot.css";

export interface DemoSlotProps {
  /** Mono caption rendered centered in the frame. */
  label?: string;
  /** Optional inline styles for sizing (fixed size, aspect-ratio, flex, etc.). */
  style?: CSSProperties;
  className?: string;
}

/**
 * A reusable placeholder for future Rive canvases: a raised, rounded frame
 * with a centered mono caption. Size it via the `style` prop.
 */
export function DemoSlot({ label, style, className }: DemoSlotProps) {
  return (
    <div className={className ? `demo-slot ${className}` : "demo-slot"} style={style}>
      {label && <span className="demo-slot__caption">{label}</span>}
    </div>
  );
}

export default DemoSlot;
