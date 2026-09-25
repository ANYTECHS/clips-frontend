"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Locale, I18nContextType, LocaleConfig } from "./types";
import {
  translate,
  detectBrowserLocale,
  registerCommunityTranslations,
} from "./translations";

const I18nContext = createContext<I18nContextType | undefined>(undefined);
I18nContext.displayName = "I18nContext";

const STORAGE_KEY = "clipcash_locale";
const CUSTOM_LOCALES_STORAGE_KEY = "clipcash_custom_locales";

const DEFAULT_LOCALES: LocaleConfig[] = [
  { value: "en", label: "English", nativeName: "English", direction: "ltr", flag: "🇺🇸" },
  { value: "es", label: "Spanish", nativeName: "Español", direction: "ltr", flag: "🇪🇸" },
  { value: "fr", label: "French", nativeName: "Français", direction: "ltr", flag: "🇫🇷" },
  { value: "de", label: "German", nativeName: "Deutsch", direction: "ltr", flag: "🇩🇪" },
  { value: "ar", label: "Arabic", nativeName: "العربية", direction: "rtl", flag: "🇸🇦" },
  { value: "pt", label: "Portuguese", nativeName: "Português", direction: "ltr", flag: "🇧🇷" },
];

const RTL_LOCALES = new Set<string>(["ar", "he", "fa", "ur"]);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locales, setLocales] = useState<LocaleConfig[]>(DEFAULT_LOCALES);
  const [locale, setLocaleState] = useState<Locale>("en");
  const [detectedLocale, setDetectedLocale] = useState<string | null>(null);

  // Load custom community translations and initial locale on client mount
  useEffect(() => {
    // 1. Restore any community locales registered previously
    try {
      const storedCustom = localStorage.getItem(CUSTOM_LOCALES_STORAGE_KEY);
      if (storedCustom) {
        const parsed = JSON.parse(storedCustom) as {
          config: LocaleConfig;
          translations: Record<string, any>;
        }[];
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            registerCommunityTranslations(item.config.value, item.translations);
          });
          setLocales((prev) => [
            ...prev,
            ...parsed.map((p) => ({ ...p.config, isCommunity: true })),
          ]);
        }
      }
    } catch {
      // Ignore JSON parse errors from local storage
    }

    // 2. Determine active locale (Saved Preference -> Browser Detection -> Fallback "en")
    const stored = localStorage.getItem(STORAGE_KEY);
    const availableValues = DEFAULT_LOCALES.map((l) => l.value);

    if (stored && (availableValues.includes(stored as Locale) || stored)) {
      setLocaleState(stored as Locale);
    } else {
      const detected = detectBrowserLocale(availableValues);
      if (detected) {
        setDetectedLocale(detected);
        setLocaleState(detected as Locale);
      }
    }
  }, []);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      try {
        localStorage.setItem(STORAGE_KEY, newLocale);
      } catch {
        // Ignore storage errors in private browsing
      }

      const activeConfig = locales.find((l) => l.value === newLocale);
      const isRtl = activeConfig ? activeConfig.direction === "rtl" : RTL_LOCALES.has(newLocale);

      if (typeof document !== "undefined") {
        document.documentElement.lang = newLocale;
        document.documentElement.dir = isRtl ? "rtl" : "ltr";
      }
    },
    [locales]
  );

  const registerLocale = useCallback(
    (config: LocaleConfig, dict: Record<string, any>) => {
      registerCommunityTranslations(config.value, dict);
      setLocales((prev) => {
        const filtered = prev.filter((l) => l.value !== config.value);
        return [...filtered, { ...config, isCommunity: true }];
      });

      try {
        const storedCustom = localStorage.getItem(CUSTOM_LOCALES_STORAGE_KEY);
        const existing = storedCustom ? JSON.parse(storedCustom) : [];
        const next = [
          ...existing.filter(
            (item: { config: LocaleConfig }) => item.config.value !== config.value
          ),
          { config, translations: dict },
        ];
        localStorage.setItem(CUSTOM_LOCALES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
    },
    []
  );

  const activeConfig = locales.find((l) => l.value === locale);
  const dir: "ltr" | "rtl" = activeConfig
    ? activeConfig.direction
    : RTL_LOCALES.has(locale)
    ? "rtl"
    : "ltr";

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = dir;
    }
  }, [locale, dir]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(locale, key, params);
    },
    [locale]
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        locales,
        dir,
        isRTL: dir === "rtl",
        registerLocale,
        detectedLocale,
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