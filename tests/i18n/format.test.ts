import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatNumber,
  formatXlm,
  formatCurrency,
  SUPPORTED_LOCALES,
} from "../../lib/i18n";

const LOCALES = SUPPORTED_LOCALES as readonly string[];
type Locale = (typeof SUPPORTED_LOCALES)[number];
const asLocale = (l: string) => l as Locale;

const DATE = new Date(2024, 5, 15); // local time, 15 June 2024 — TZ-stable
const DATE_OPTS = { month: "short", day: "numeric", year: "numeric" } as const;

describe("formatDate", () => {
  it("uses Intl.DateTimeFormat with the active locale (en)", () => {
    // en short-month/day/year is stable across ICU versions
    expect(formatDate(DATE, "en")).toBe("Jun 15, 2024");
  });

  it("delegates to Intl.DateTimeFormat for every supported locale", () => {
    for (const locale of LOCALES) {
      const expected = new Intl.DateTimeFormat(locale, DATE_OPTS).format(DATE);
      expect(formatDate(DATE, asLocale(locale))).toBe(expected);
    }
  });

  it("changes output when the locale changes", () => {
    expect(formatDate(DATE, "en")).not.toBe(formatDate(DATE, "es"));
  });
});

describe("formatNumber", () => {
  it("uses locale-appropriate separators (en)", () => {
    expect(formatNumber(1234567.89, "en")).toBe("1,234,567.89");
  });

  it("uses the locale decimal separator", () => {
    // 1.5 has no thousands group, so only the decimal separator varies here.
    expect(formatNumber(1.5, "en")).toBe("1.5");
    expect(formatNumber(1.5, "es")).toBe("1,5");
  });

  it("delegates to Intl.NumberFormat for every supported locale", () => {
    for (const locale of LOCALES) {
      const expected = new Intl.NumberFormat(locale).format(9876543.21);
      expect(formatNumber(9876543.21, asLocale(locale))).toBe(expected);
    }
  });
});

describe("formatXlm", () => {
  it("formats XLM with 2 decimals and en separators", () => {
    expect(formatXlm(1234.5, "en")).toBe("1,234.50");
    expect(formatXlm(0, "en")).toBe("0.00");
    expect(formatXlm(1, "en")).toBe("1.00");
  });

  it("delegates to Intl.NumberFormat (2 decimals) for every supported locale", () => {
    for (const locale of LOCALES) {
      const expected = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(1234567.5);
      expect(formatXlm(1234567.5, asLocale(locale))).toBe(expected);
    }
  });

  it("uses a different decimal separator per locale", () => {
    // en uses '.' as the decimal separator, es uses ',' — proving the locale
    // actually drives the formatting rather than a single hard-coded format.
    expect(formatXlm(1.5, "en")).toBe("1.50");
    expect(formatXlm(1.5, "es")).toBe("1,50");
    expect(formatXlm(1.5, "en")).not.toBe(formatXlm(1.5, "es"));
  });
});

describe("formatCurrency", () => {
  it("formats currency with the active locale", () => {
    expect(formatCurrency(12.5, "USD", "en")).toBe("$12.50");
  });
});
