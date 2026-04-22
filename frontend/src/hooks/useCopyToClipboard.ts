import { useCallback, useEffect, useRef, useState } from "react";

export function useCopyToClipboard(duration = 1800) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string) => {
      if (!navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), duration);
      } catch {
        // permission denied or another failure — skip confirmation
      }
    },
    [duration],
  );

  return { copied, copy };
}
