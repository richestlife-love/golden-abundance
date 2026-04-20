import { useContext } from "react";
import { UIStateCtx } from "./UIStateProvider";

export function useUIState() {
  const ctx = useContext(UIStateCtx);
  if (!ctx) throw new Error("useUIState must be used inside <UIStateProvider>");
  return ctx;
}

export { pushToast } from "./toasts";
