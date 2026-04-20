import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { UIStateProvider } from "../UIStateProvider";
import { useUIState } from "../useUIState";
import { pushToast } from "../toasts";

function Probe() {
  const { successData, setSuccessData, toasts } = useUIState();
  return (
    <div>
      <div data-testid="success">
        {successData ? (successData.bonus ?? "yes") : "no"}
      </div>
      <div data-testid="toast-count">{toasts.length}</div>
      <button
        onClick={() =>
          setSuccessData({ color: "#fff", points: 50, bonus: "ok" })
        }
      >
        push success
      </button>
    </div>
  );
}

describe("UIStateProvider", () => {
  it("starts with no successData and no toasts", () => {
    render(
      <UIStateProvider>
        <Probe />
      </UIStateProvider>,
    );
    expect(screen.getByTestId("success")).toHaveTextContent("no");
    expect(screen.getByTestId("toast-count")).toHaveTextContent("0");
  });

  it("setSuccessData updates state", () => {
    render(
      <UIStateProvider>
        <Probe />
      </UIStateProvider>,
    );
    act(() => screen.getByText("push success").click());
    expect(screen.getByTestId("success")).toHaveTextContent("ok");
  });

  it("registers pushToast sink that flows into the toasts list", () => {
    render(
      <UIStateProvider>
        <Probe />
      </UIStateProvider>,
    );
    act(() => pushToast({ kind: "info", message: "hello" }));
    expect(screen.getByTestId("toast-count")).toHaveTextContent("1");
  });
});
