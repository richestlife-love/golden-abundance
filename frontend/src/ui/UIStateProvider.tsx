import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { setToastSink, type Toast } from "./toasts";

export interface SuccessData {
  color: string;
  points: number;
  bonus?: string | null;
  title?: string;
}

interface UIState {
  successData: SuccessData | null;
  setSuccessData: (d: SuccessData | null) => void;
  toasts: Toast[];
  dismissToast: (id: string) => void;
}

export const UIStateCtx = createContext<UIState | null>(null);

let nextId = 0;

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const enqueue = useCallback((t: Toast) => {
    nextId += 1;
    const withId = { ...t, id: t.id ?? `t-${nextId}` };
    setToasts((prev) => [...prev, withId]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    setToastSink(enqueue);
    return () => setToastSink(null);
  }, [enqueue]);

  return (
    <UIStateCtx.Provider
      value={{ successData, setSuccessData, toasts, dismissToast }}
    >
      {children}
    </UIStateCtx.Provider>
  );
}
