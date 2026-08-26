"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Locale, I18nContextType, LocaleConfig } from "./types";
import { translate } from "./translations";

const I18nContext = createContext<I18nContextType | undefined>(undefined);
I18nContext.displayName = "I18nContext";

const STORAGE_KEY = "clipcash_locale";

const AVAILABLE_LOCALES: LocaleConfig[] = [
  { value: "en", label: "English", direction: "ltr" },
  { value: "es", label: "Español", direction: "ltr" },
  { value: "fr", label: "Français", direction: "ltr" },
  { value: "pt", label: "Português", direction: "ltr" },
  { value: "ar", label: "العربية", direction: "rtl" },
  { value: "he", label: "עברית", direction: "rtl" },
];

const RTL_LOCALES = new Set<Locale>(["ar", "he"]);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es" || stored === "fr" || stored === "pt" || stored === "ar" || stored === "he") {
      setLocaleState(stored as Locale);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = RTL_LOCALES.has(newLocale) ? "rtl" : "ltr";
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(locale, key, params);
    },
    [locale]
  );

  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        locales: AVAILABLE_LOCALES,
        dir,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}