import type { Locale } from "./types";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import ar from "./locales/ar.json";
import pt from "./locales/pt.json";

// Built-in translations map
const translations: Record<string, Record<string, any>> = {
  en,
  es,
  fr,
  de,
  ar,
  pt,
};

// Community / runtime registered translations
const communityTranslations: Record<string, Record<string, any>> = {};

/**
 * Register community or custom translation dictionary at runtime
 */
export function registerCommunityTranslations(
  locale: string,
  dict: Record<string, any>
): void {
  communityTranslations[locale] = {
    ...(communityTranslations[locale] || {}),
    ...dict,
  };
}

/**
 * Get all available translations for a locale (merging built-in and community)
 */
export function getLocaleTranslations(locale: string): Record<string, any> | undefined {
  return communityTranslations[locale] || translations[locale];
}

/**
 * Retrieve English base dictionary to serve as schema for community contributions
 */
export function getBaseTranslationSchema(): Record<string, any> {
  return en;
}

function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  const keys = path.split(".");
  let current: any = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Detect user's preferred language from browser settings
 */
export function detectBrowserLocale(supportedLocales: string[]): string | null {
  if (typeof window === "undefined" || !navigator) return null;

  const rawLangs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || ""];

  for (const lang of rawLangs) {
    if (!lang) continue;
    const clean = lang.toLowerCase();

    // 1. Exact match e.g. "es", "de", "ar"
    if (supportedLocales.includes(clean)) {
      return clean;
    }

    // 2. Language code prefix without region e.g. "es-ES" -> "es", "ar-EG" -> "ar", "de-DE" -> "de"
    const prefix = clean.split("-")[0];
    if (supportedLocales.includes(prefix)) {
      return prefix;
    }
  }

  return null;
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const localeTranslations = communityTranslations[locale] || translations[locale];
  let value: string | undefined;

  if (localeTranslations) {
    value = getNestedValue(localeTranslations, key);
  }

  if (!value) {
    // Fallback to English
    value = getNestedValue(translations.en, key);
  }

  if (!value) return key;

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(`{${paramKey}}`, String(paramValue));
    }
  }

  return value;
}
