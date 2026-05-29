import type { Locale } from "./types";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import pt from "./locales/pt.json";

const translations: Record<Locale, Record<string, any>> = { en, es, fr, pt };

function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  const keys = path.split(".");
  let current: any = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const localeTranslations = translations[locale];
  if (!localeTranslations) return key;

  let value = getNestedValue(localeTranslations, key);
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
