import { useEffect, useState } from "react";

// easeOutCubic — softer tail than linear, so the counter decelerates
// into its final value instead of slamming to a stop.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts from 0 up to `target` over `durationMs`, returning the current
 * integer value. Re-runs from 0 whenever `target` changes.
 *
 * Respects `prefers-reduced-motion`: if the user opted out of motion,
 * jumps to `target` immediately instead of animating.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      setValue(target);
      return;
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || target === 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * easeOut(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
