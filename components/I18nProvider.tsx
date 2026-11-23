"use client";

/**
 * I18nProvider
 *
 * Holds the active locale and exposes bound translation + formatting helpers
 * via the useI18n() hook. The locale is persisted in localStorage and applied
 * to <html lang/dir> so the document follows the active locale (RTL for Arabic).
 *
 * Formatting/translation logic itself lives in the framework-agnostic
 * lib/i18n module; this provider just binds it to the active locale for React.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLocaleDir,
  isLocale,
  normalizeLocale,
  t as translate,
  formatDate as formatDateFn,
  formatNumber as formatNumberFn,
  formatXlm as formatXlmFn,
  formatCurrency as formatCurrencyFn,
} from "@/lib/i18n";
import type { LocaleId, TranslateOptions, DateTimeFormat, NumberFormat } from "@/lib/i18n";

const STORAGE_KEY = "clipcash_locale";

interface I18nContextType {
  locale: LocaleId;
  setLocale: (locale: LocaleId) => void;
  dir: "ltr" | "rtl";
  t: (key: string, params?: TranslateOptions) => string;
  formatDate: (date: Date | string | number, options?: DateTimeFormat) => string;
  formatNumber: (value: number | string, options?: NumberFormat) => string;
  formatXlm: (value: number | string) => string;
  formatCurrency: (value: number | string, currency: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * Consumer hook for the active locale and bound i18n helpers.
 * @public — the i18n provider's API for components; kept even when no
 * component currently consumes it.
 */
export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}

function readStoredLocale(): LocaleId {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
    // Respect the browser language when nothing is stored.
    const nav = window.navigator?.language;
    if (nav) return normalizeLocale(nav);
  } catch {
    // localStorage may be unavailable (private mode) — fall back to default.
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>(DEFAULT_LOCALE);

  // Hydrate the stored locale on mount (client-only to avoid SSR mismatch).
  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  // Reflect the active locale on <html lang/dir>.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const dir = getLocaleDir(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const setLocale = useCallback((next: LocaleId) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore persistence failures (e.g. private mode).
      }
    }
  }, []);

  const value = useMemo<I18nContextType>(() => {
    const t = (key: string, params?: TranslateOptions) => translate(key, params, locale);
    const formatDate = (date: Date | string | number, options?: DateTimeFormat) =>
      formatDateFn(date, locale, options);
    const formatNumber = (value: number | string, options?: NumberFormat) =>
      formatNumberFn(value, locale, options);
    const formatXlm = (value: number | string) => formatXlmFn(value, locale);
    const formatCurrency = (value: number | string, currency: string) =>
      formatCurrencyFn(value, currency, locale);
    return {
      locale,
      setLocale,
      dir: getLocaleDir(locale),
      t,
      formatDate,
      formatNumber,
      formatXlm,
      formatCurrency,
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export { SUPPORTED_LOCALES };
