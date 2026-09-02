/**
 * AnimatedNumber — smooth numeric transitions for usage percentages.
 *
 * Renders tabular numerals; tweens only when the value actually changes and
 * rests completely between changes (zero idle cost). Renders plain text when
 * motion is reduced. Formatted output comes from `format` so locale rules
 * stay with the caller.
 */
import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { springSoft } from "./motion";

export interface AnimatedNumberProps {
  value: number | null;
  /** Render the numeric value to display text (e.g. percent formatting). */
  format: (v: number) => string;
  className?: string;
  /** Fallback when value is null (unknown). */
  placeholder?: string;
  /** Accessible label override; defaults to formatted value. */
  ariaLabel?: string;
}

export function AnimatedNumber({
  value,
  format,
  className,
  placeholder = "—",
  ariaLabel,
}: AnimatedNumberProps) {
  const systemReduced = useReducedMotion();
  const [display, setDisplay] = useState<number | null>(value);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (value == null) {
      setDisplay(null);
      return;
    }
    if (systemReduced) {
      setDisplay(value);
      return;
    }
    const controls = animate(display ?? value, value, {
      ...springSoft,
      onComplete: () => setDisplay(latest.current),
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
    // `display` intentionally excluded: we tween from the last rendered value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, systemReduced]);

  const text = display == null ? placeholder : format(display);

  return (
    <span
      className={className}
      style={{ fontVariantNumeric: "tabular-nums" }}
      aria-label={ariaLabel ?? text}
    >
      {text}
    </span>
  );
}
