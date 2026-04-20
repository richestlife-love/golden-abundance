import { useContext } from "react";
import { UIStateCtx } from "./UIStateProvider";

export function useUIState() {
  const ctx = useContext(UIStateCtx);
  if (!ctx) throw new Error("useUIState must be used inside <UIStateProvider>");
  return ctx;
}

// Module-level overlay pusher — mirrors toasts.ts so mutation onSuccess
// and signOut (both outside the React tree) can fire the celebration
// overlay without threading the provider's setState through every caller.
export type SuccessPayload = {
  color: string;
  points: number;
  bonus?: string | null;
  title?: string;
};
let successSink: ((p: SuccessPayload) => void) | null = null;
export function setSuccessSink(fn: ((p: SuccessPayload) => void) | null): void {
  successSink = fn;
}
export function pushSuccess(p: SuccessPayload): void {
  successSink?.(p);
}
export { pushToast } from "./toasts";
