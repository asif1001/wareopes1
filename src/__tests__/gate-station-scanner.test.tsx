import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StationPanel } from "@/app/gate/station-panel";

const CODE = "EKKB1.AbCdEfGhIjKlMnOpQ_rS.59512345.Ab-dEfGhIjKlMnOpQrStUv";

/** Key events as a USB scanner sends them: the physical key (e.code) plus Shift for capitals. */
function scannerEvents(text: string, layoutChar: (ch: string) => string) {
  return [...text].map((ch) => {
    let code = "";
    let shiftKey = false;
    if (/[a-z]/i.test(ch)) {
      code = `Key${ch.toUpperCase()}`;
      shiftKey = ch !== ch.toLowerCase();
    } else if (/\d/.test(ch)) code = `Digit${ch}`;
    else if (ch === ".") code = "Period";
    else if (ch === "-") code = "Minus";
    else if (ch === "_") {
      code = "Minus";
      shiftKey = true;
    }
    return new KeyboardEvent("keydown", { key: layoutChar(ch), code, shiftKey, bubbles: true });
  });
}

describe("gate station scanner input", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, results: [{ status: "ACCEPTED", type: "IN", message: "Checked in at 07:00" }] })));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const sentCode = () => JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)).scans[0].code;

  it("reads the code on an Arabic keyboard layout and without an Enter suffix", async () => {
    render(<StationPanel site="site1" gateKey="key1" />);
    await act(async () => {
      for (const e of scannerEvents(CODE, () => "ش")) window.dispatchEvent(e);
      vi.advanceTimersByTime(400);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentCode()).toBe(CODE);
  });

  it("reads the code when the scanner ends with Enter", async () => {
    render(<StationPanel site="site1" gateKey="key1" />);
    await act(async () => {
      for (const e of scannerEvents(CODE, (ch) => ch)) window.dispatchEvent(e);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentCode()).toBe(CODE);
  });

  it("shows a warning when the window does not have focus", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const view = render(<StationPanel site="site1" gateKey="key1" />);
    expect(view.getByText(/Scanner not active — click anywhere/)).toBeTruthy();
  });
});
