export type Locale = "en" | "es" | "fr" | "pt" | "ar" | "he";

export interface LocaleConfig {
  value: Locale;
  label: string;
  direction: "ltr" | "rtl";
}

export interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locales: LocaleConfig[];
  dir: "ltr" | "rtl";
}