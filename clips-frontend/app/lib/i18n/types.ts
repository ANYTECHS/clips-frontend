export type Locale = "en" | "es" | "fr" | "pt";

export interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locales: { value: Locale; label: string }[];
}
