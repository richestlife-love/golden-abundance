// frontend/src/ui/toasts.ts
export type Toast = {
  id?: string; // assigned by the sink
  kind: "info" | "error" | "success";
  message: string;
};

type ToastSink = ((t: Toast) => void) | null;

let sink: ToastSink = null;

export function setToastSink(fn: ToastSink): void {
  sink = fn;
}

export function pushToast(t: Toast): void {
  sink?.(t);
}
