"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export const THEME_STORAGE_KEY = "clipcash-theme";

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  // Load theme from localStorage on mount and sync from preferences
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (
      storedTheme &&
      (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system")
    ) {
      setThemeState(storedTheme);
    } else {
      // Check preferences API if no local override
      fetch("/api/user/preferences")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (
            data?.display?.theme &&
            (data.display.theme === "light" ||
              data.display.theme === "dark" ||
              data.display.theme === "system")
          ) {
            setThemeState(data.display.theme);
            localStorage.setItem(THEME_STORAGE_KEY, data.display.theme);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Apply theme to document and resolve system theme
  useEffect(() => {
    const applyTheme = (themeValue: Theme) => {
      let actualTheme: "light" | "dark";

      if (themeValue === "system") {
        if (typeof window !== "undefined" && window.matchMedia) {
          actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
        } else {
          actualTheme = "dark";
        }
      } else {
        actualTheme = themeValue;
      }

      setResolvedTheme(actualTheme);

      // Apply data-theme attribute and classes to document
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", actualTheme);
        if (actualTheme === "dark") {
          document.documentElement.classList.add("dark");
          document.documentElement.classList.remove("light");
        } else {
          document.documentElement.classList.add("light");
          document.documentElement.classList.remove("dark");
        }

        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute(
            "content",
            actualTheme === "dark" ? "#080C0B" : "#F8FAF9"
          );
        }
      }
    };

    applyTheme(theme);

    // Listen for system theme changes when in system mode
    if (theme === "system" && typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Storage unavailable or disabled
    }

    // Persist to user preferences backend
    if (typeof window !== "undefined") {
      fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display: { theme: newTheme } }),
      }).catch(() => {});
    }
  };

  const toggleTheme = () => {
    setTheme(
      theme === "dark" ? "light" : theme === "light" ? "system" : "dark"
    );
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
