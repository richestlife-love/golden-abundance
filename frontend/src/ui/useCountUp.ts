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
  // Computed during render so the initial state is correct without a
  // synchronous setState in the effect (react-hooks/set-state-in-effect).
  const skipAnimation =
    typeof window === "undefined" ||
    target === 0 ||
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const [value, setValue] = useState(skipAnimation ? target : 0);

  useEffect(() => {
    if (skipAnimation) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * easeOut(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, skipAnimation]);

  return skipAnimation ? target : value;
}
