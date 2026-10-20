import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from "@/components/theme-provider";

function TestConsumer() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button onClick={() => setTheme("light")} data-testid="set-light">
        Set Light
      </button>
      <button onClick={() => setTheme("dark")} data-testid="set-dark">
        Set Dark
      </button>
      <button onClick={() => setTheme("system")} data-testid="set-system">
        Set System
      </button>
      <button onClick={toggleTheme} data-testid="toggle-theme">
        Toggle Theme
      </button>
    </div>
  );
}

describe("ThemeProvider and useTheme", () => {
  let listeners: ((e: MediaQueryListEvent) => void)[] = [];
  let mediaQueryMatches = false;

  beforeEach(() => {
    localStorage.clear();
    listeners = [];
    mediaQueryMatches = false;

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ display: { theme: "dark" } }),
      } as Response)
    );

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: mediaQueryMatches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn((event: string, handler: (e: any) => void) => {
        if (event === "change") listeners.push(handler);
      }),
      removeEventListener: jest.fn((event: string, handler: (e: any) => void) => {
        if (event === "change") {
          listeners = listeners.filter((l) => l !== handler);
        }
      }),
      dispatchEvent: jest.fn(),
    }));

    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("applies default theme and updates document attributes", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
  });

  it("sets light theme, updates localStorage, and notifies preferences API", async () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId("set-light"));
    });

    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/user/preferences",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ display: { theme: "light" } }),
      })
    );
  });

  it("toggles theme correctly through dark -> light -> system -> dark", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    // Initial is dark
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");

    // Toggle 1: dark -> light
    act(() => {
      fireEvent.click(screen.getByTestId("toggle-theme"));
    });
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");

    // Toggle 2: light -> system
    act(() => {
      fireEvent.click(screen.getByTestId("toggle-theme"));
    });
    expect(screen.getByTestId("current-theme")).toHaveTextContent("system");

    // Toggle 3: system -> dark
    act(() => {
      fireEvent.click(screen.getByTestId("toggle-theme"));
    });
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
  });

  it("responds to matchMedia changes in system mode and cleans up listener on unmount", () => {
    mediaQueryMatches = false; // light system preference initially

    const { unmount } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId("set-system"));
    });

    expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("light");
    expect(listeners.length).toBeGreaterThan(0);

    // System switches to dark
    mediaQueryMatches = true;
    act(() => {
      listeners.forEach((l) => l({ matches: true } as MediaQueryListEvent));
    });

    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    // Unmount cleans up listener
    const initialListenerCount = listeners.length;
    unmount();
    expect(listeners.length).toBeLessThan(initialListenerCount);
  });
});
