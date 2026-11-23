"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { getTheme, setTheme, initTheme, type Theme } from "@/lib/theme";

/** Issue #1382 — dashboard dark/light mode toggle. */
export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    initTheme();
    setThemeState(getTheme());
    const onChange = () => setThemeState(getTheme());
    window.addEventListener("clipcash_theme_changed", onChange);
    return () => window.removeEventListener("clipcash_theme_changed", onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="p-2 rounded-lg text-[#90A89C] hover:text-[#F4F7EF] hover:bg-white/5 transition-colors"
    >
      {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
