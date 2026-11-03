import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ModeToggle from "../components/ModeToggle.jsx";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("ModeToggle (rule 19)", () => {
  it("mock only: Mock is pressed and Real is disabled with the reason", () => {
    render(<ModeToggle info={{ mode: "local", hosted: false, source: "mock", realAvailable: false }} onSelect={() => {}} />);
    expect(screen.getByTestId("mode-mock")).toHaveAttribute("aria-pressed", "true");
    const real = screen.getByTestId("mode-real");
    expect(real).toBeDisabled();
    expect(real.getAttribute("title")).toMatch(/no live version/i);
  });

  it("hosted: Real is disabled saying the hosted build is Mock only", () => {
    render(<ModeToggle info={{ mode: "mock-only", hosted: true, source: "mock", realAvailable: false }} onSelect={() => {}} />);
    expect(screen.getByTestId("mode-real")).toBeDisabled();
    expect(screen.getByTestId("mode-real").getAttribute("title")).toBe("The hosted build is Mock only.");
  });

  it("before the server answers both buttons are disabled", () => {
    render(<ModeToggle info={null} onSelect={() => {}} />);
    expect(screen.getByTestId("mode-mock")).toBeDisabled();
    expect(screen.getByTestId("mode-real")).toBeDisabled();
  });

  it("clicking the pressed Mock does not call onSelect; a call goes through when the mode differs", async () => {
    const onSelect = vi.fn();
    const { unmount } = render(<ModeToggle info={{ mode: "local", hosted: false, source: "mock", realAvailable: false }} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("mode-mock"));
    expect(onSelect).not.toHaveBeenCalled();
    unmount();
    render(<ModeToggle info={{ mode: "local", hosted: false, source: "real", realAvailable: true }} onSelect={onSelect} />);
    await fireEvent.click(screen.getByTestId("mode-mock"));
    expect(onSelect).toHaveBeenCalledWith("mock");
  });
});
