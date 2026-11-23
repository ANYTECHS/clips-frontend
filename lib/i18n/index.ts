/**
 * i18n core for ClipCash.
 *
 * - Loads the JSON locale dictionaries under ./locales.
 * - `t()` performs {{name}} interpolation and locale-aware plural selection
 *   (using `Intl.PluralRules`, so Arabic's six forms are handled correctly).
 * - `formatDate` / `formatNumber` / `formatXlm` / `formatCurrency` delegate to
 *   `Intl.DateTimeFormat` / `Intl.NumberFormat` with the active locale, so
 *   thousands and decimal separators follow the locale (e.g. en "1,234.50",
 *   es "1.234,50", ar-Indic digits).
 *
 * This module is framework-agnostic (works in the browser, in Next.js server
 * components, and in Node/vitest). It is pure-logic and uses only the built-in
 * `Intl` APIs, so it has no runtime dependencies.
 */

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import pt from "./locales/pt.json";
import ar from "./locales/ar.json";

export type LocaleId = "en" | "es" | "fr" | "pt" | "ar";

export const SUPPORTED_LOCALES: LocaleId[] = ["en", "es", "fr", "pt", "ar"];
export const DEFAULT_LOCALE: LocaleId = "en";
const RTL_LOCALES: LocaleId[] = ["ar"];

/** All locale dictionaries. Typed loosely so plural nodes (objects) fit. */
export const translations: Record<LocaleId, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  es: es as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
  pt: pt as Record<string, unknown>,
  ar: ar as Record<string, unknown>,
};

const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;
type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

/** Maps a BCP-47 tag (e.g. "en-US", "pt-BR") to a supported locale, or en. */
export function normalizeLocale(locale: string): LocaleId {
  const base = (locale || "").toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as string[]).includes(base) ? (base as LocaleId) : DEFAULT_LOCALE;
}

export function isLocale(value: unknown): value is LocaleId {
  return typeof value === "string" && (SUPPORTED_LOCALES as string[]).includes(value);
}

/** "rtl" for Arabic, "ltr" otherwise. */
export function getLocaleDir(locale: LocaleId): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

// Intl.PluralRules instances are expensive to construct; cache per locale.
const pluralRulesCache = new Map<LocaleId, Intl.PluralRules>();
function getPluralRules(locale: LocaleId): Intl.PluralRules {
  let pr = pluralRulesCache.get(locale);
  if (!pr) {
    pr = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, pr);
  }
  return pr;
}

/** Returns the CLDR plural category for `count` in `locale`. */
export function pluralCategory(locale: LocaleId, count: number): PluralCategory {
  const category = getPluralRules(normalizeLocale(locale)).select(count) as PluralCategory;
  return (PLURAL_CATEGORIES as readonly string[]).includes(category) ? category : "other";
}

/** An object whose keys are all CLDR plural categories (>= 1 key). */
function isPluralNode(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  return keys.every((k) => (PLURAL_CATEGORIES as readonly string[]).includes(k));
}

/** Replaces {{name}} placeholders with params[name]. */
export function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const v = params[name];
    return v === undefined || v === null ? "" : String(v);
  });
}

function resolveKey(locale: LocaleId, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = translations[locale];
  for (const part of parts) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export interface TranslateOptions extends Record<string, unknown> {
  /** When present, selects a plural form via Intl.PluralRules. */
  count?: number;
}

/**
 * Translates `key` for `locale` (default en), interpolating {{name}} params.
 *
 * If the resolved value is a plural node (object keyed by CLDR categories),
 * `count` selects the form for this locale, falling back to `other`, then to
 * the first available form. Missing keys fall back to the English locale.
 */
export function t(
  key: string,
  params?: TranslateOptions,
  locale: LocaleId = DEFAULT_LOCALE
): string {
  const loc = normalizeLocale(locale);
  let value = resolveKey(loc, key);
  if (value === undefined && loc !== DEFAULT_LOCALE) {
    value = resolveKey(DEFAULT_LOCALE, key);
  }

  if (isPluralNode(value)) {
    const count = params && "count" in params ? Number(params.count) : NaN;
    const category = Number.isFinite(count) ? pluralCategory(loc, count) : "other";
    let form = value[category];
    if (form === undefined) form = value["other"];
    if (form === undefined) form = Object.values(value)[0];
    return typeof form === "string" ? interpolate(form, params) : key;
  }

  if (typeof value === "string") return interpolate(value, params);
  return key;
}

// ── Formatting (Intl) ───────────────────────────────────────────────────────

export type DateTimeFormat = Intl.DateTimeFormatOptions;

/** Formats a date using Intl.DateTimeFormat with the active locale. */
export function formatDate(
  date: Date | string | number,
  locale: LocaleId = DEFAULT_LOCALE,
  options?: DateTimeFormat
): string {
  const d = date instanceof Date ? date : new Date(date);
  const opts: DateTimeFormat = options ?? { month: "short", day: "numeric", year: "numeric" };
  return new Intl.DateTimeFormat(normalizeLocale(locale), opts).format(d);
}

export type NumberFormat = Intl.NumberFormatOptions;

/** Formats a number using Intl.NumberFormat with the active locale. */
export function formatNumber(
  value: number | string,
  locale: LocaleId = DEFAULT_LOCALE,
  options?: NumberFormat
): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(normalizeLocale(locale), options).format(n);
}

/**
 * Formats an XLM amount with locale-appropriate separators and 2 decimals
 * (e.g. en "1,234.50", es "1.234,50", ar Arabic-Indic digits).
 */
export function formatXlm(value: number | string, locale: LocaleId = DEFAULT_LOCALE): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(normalizeLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Formats a currency amount using Intl.NumberFormat with the active locale. */
export function formatCurrency(
  value: number | string,
  currency: string,
  locale: LocaleId = DEFAULT_LOCALE
): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(normalizeLocale(locale), {
    style: "currency",
    currency,
  }).format(n);
}
