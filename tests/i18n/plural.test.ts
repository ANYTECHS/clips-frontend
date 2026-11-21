import { describe, it, expect } from "vitest";
import {
  t,
  pluralCategory,
  translations,
  interpolate,
  SUPPORTED_LOCALES,
} from "../../lib/i18n";

const COUNTS = [0, 1, 2, 3, 5, 10, 11, 15, 20, 100, 101, 1000];


describe("pluralization — Intl.PluralRules selection", () => {
  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale}: t('clips.count') matches the Intl-selected form`, () => {
     
      const node = (translations[locale].clips as Record<string, unknown>)
        .count as Record<string, string>;
      for (const count of COUNTS) {
        const category = pluralCategory(locale, count);
        const form = node[category] ?? node["other"];
        const expected = interpolate(form, { count });
        expect(t("clips.count", { count }, locale)).toBe(expected);
      }
    });
  }
});

describe("pluralization — concrete forms per locale", () => {
  it("en: one / other", () => {
    expect(t("clips.count", { count: 1 }, "en")).toBe("1 clip");
    expect(t("clips.count", { count: 0 }, "en")).toBe("0 clips");
    expect(t("clips.count", { count: 2 }, "en")).toBe("2 clips");
    expect(t("clips.count", { count: 5 }, "en")).toBe("5 clips");
  });

  it("es: one / other", () => {
    expect(t("clips.count", { count: 1 }, "es")).toBe("1 clip");
    expect(t("clips.count", { count: 0 }, "es")).toBe("0 clips");
    expect(t("clips.count", { count: 2 }, "es")).toBe("2 clips");
  });

  it("fr: 0 and 1 are singular (one)", () => {
    expect(t("clips.count", { count: 0 }, "fr")).toBe("0 clip");
    expect(t("clips.count", { count: 1 }, "fr")).toBe("1 clip");
    expect(t("clips.count", { count: 2 }, "fr")).toBe("2 clips");
  });

  it("pt: one / other", () => {
    
    expect(t("clips.count", { count: 1 }, "pt")).toBe("1 clipe");
    expect(t("clips.count", { count: 2 }, "pt")).toBe("2 clips");
  });

  it("ar: all six plural forms", () => {
    expect(t("clips.count", { count: 0 }, "ar")).toBe("لا مقاطع"); // zero
    expect(t("clips.count", { count: 1 }, "ar")).toBe("مقطع واحد"); // one
    expect(t("clips.count", { count: 2 }, "ar")).toBe("مقطعان"); // two
    expect(t("clips.count", { count: 5 }, "ar")).toBe("5 مقاطع"); // few
    expect(t("clips.count", { count: 15 }, "ar")).toBe("15 مقطعًا"); // many
    expect(t("clips.count", { count: 100 }, "ar")).toBe("100 مقطع"); // other
  });
});
