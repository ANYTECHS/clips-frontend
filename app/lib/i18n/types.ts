export type Locale = "en" | "es" | "fr" | "de" | "ar" | "pt" | "he" | string;

export interface LocaleConfig {
  value: Locale;
  label: string;
  nativeName?: string;
  direction: "ltr" | "rtl";
  flag?: string;
  isCommunity?: boolean;
}

export interface CommunityTranslationSubmission {
  locale: string;
  languageName: string;
  contributorName: string;
  contributorEmail?: string;
  translations: Record<string, any>;
  notes?: string;
}

export interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locales: LocaleConfig[];
  dir: "ltr" | "rtl";
  isRTL: boolean;
  registerLocale: (config: LocaleConfig, translations: Record<string, any>) => void;
  detectedLocale?: string | null;
}