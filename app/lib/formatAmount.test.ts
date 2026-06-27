import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatAmount,
  formatXLM,
  formatXLMAmount,
  formatUSD,
  formatCrypto,
  formatPrice,
  parseFormattedAmount,
  formatTransactionAmount,
  formatAbbreviated,
  SUPPORTED_LOCALES,
  XLM_CONSTANTS,
  type FormatAmountOptions,
  type FormatXLMOptions,
  type FormatUSDOptions,
} from './formatAmount';

describe('formatAmount', () => {
  describe('basic formatting', () => {
    it('should format with default locale and 2 decimals', () => {
      const result = formatAmount(1234.567);
      expect(result).toMatch(/1[,.]234\.57/); // Matches with either locale separator
    });

    it('should handle string input', () => {
      const result = formatAmount('1234.567', { decimals: 2 });
      expect(result).toMatch(/1[,.]234\.57/);
    });

    it('should handle zero', () => {
      expect(formatAmount(0)).toBe('0.00');
    });

    it('should handle negative numbers', () => {
      const result = formatAmount(-1234.567, { decimals: 2 });
      expect(result).toContain('-');
    });
  });

  describe('decimal places', () => {
    it('should format with 0 decimals', () => {
      const result = formatAmount(1234.567, { decimals: 0 });
      expect(result).toMatch(/1[,.]235/); // Should round up
    });

    it('should format with 7 decimals', () => {
      const result = formatAmount(1234.5678901, { decimals: 7 });
      expect(result).toMatch(/1[,.]234\.5678901/);
    });

    it('should format with custom decimals', () => {
      const result = formatAmount(1234.567, { decimals: 3 });
      expect(result).toMatch(/1[,.]234\.567/);
    });
  });

  describe('locale support', () => {
    it('should format with en-US locale', () => {
      const result = formatAmount(1234.567, { locale: 'en-US', decimals: 2 });
      expect(result).toBe('1,234.57');
    });

    it('should format with de-DE locale (European)', () => {
      const result = formatAmount(1234.567, { locale: 'de-DE', decimals: 2 });
      expect(result).toBe('1.234,57');
    });

    it('should format with fr-FR locale (French)', () => {
      const result = formatAmount(1234.567, { locale: 'fr-FR', decimals: 2 });
      expect(result).toMatch(/1[^\d]234[^\d]57/); // Uses space as separator
    });
  });

  describe('currency display', () => {
    it('should include currency code when requested', () => {
      const result = formatAmount(1234.567, {
        decimals: 2,
        locale: 'en-US',
        includeCurrency: true,
        currencyCode: 'XLM',
      });
      expect(result).toBe('1,234.57 XLM');
    });

    it('should not include currency by default', () => {
      const result = formatAmount(1234.567, {
        decimals: 2,
        locale: 'en-US',
      });
      expect(result).not.toContain('XLM');
    });
  });

  describe('edge cases', () => {
    it('should handle NaN', () => {
      expect(formatAmount(NaN)).toBe('0');
    });

    it('should handle Infinity', () => {
      expect(formatAmount(Infinity)).toBe('∞');
    });

    it('should handle negative Infinity', () => {
      expect(formatAmount(-Infinity)).toBe('∞');
    });

    it('should handle very small numbers', () => {
      const result = formatAmount(0.0000001, { decimals: 7 });
      expect(result).toMatch(/0\.0000001/);
    });

    it('should handle very large numbers', () => {
      const result = formatAmount(1000000000, { decimals: 0 });
      expect(result).toMatch(/1[,.]000[,.]000[,.]000/);
    });

    it('should fall back to toFixed when Intl.NumberFormat throws for invalid locale', () => {
      const result = formatAmount(1234.567, {
        locale: 'en_US',
        decimals: 2,
      });

      expect(result).toBe('1234.57');
    });
  });

  describe('minimumFractionDigits', () => {
    it('should apply minimum fraction digits', () => {
      const result = formatAmount(100, {
        decimals: 4,
        locale: 'en-US',
        minimumFractionDigits: 2,
      });
      expect(result).toBe('100.00');
    });
  });
});

describe('formatXLM', () => {
  describe('basic formatting', () => {
    it('should format XLM with currency suffix', () => {
      const result = formatXLM(1234.5678901, {
        decimals: 2,
        locale: 'en-US',
      });
      expect(result).toBe('1,234.57 XLM');
    });

    it('should format with full precision (7 decimals)', () => {
      const result = formatXLM(1234.5678901, {
        decimals: 7,
        locale: 'en-US',
      });
      expect(result).toBe('1,234.5678901 XLM');
    });

    it('should handle string input', () => {
      const result = formatXLM('1234.5678901', {
        decimals: 2,
        locale: 'en-US',
      });
      expect(result).toBe('1,234.57 XLM');
    });
  });

  describe('currency suffix control', () => {
    it('should include XLM suffix by default', () => {
      const result = formatXLM(1234.567, {
        decimals: 2,
        locale: 'en-US',
      });
      expect(result).toContain('XLM');
    });

    it('should omit XLM suffix when includeCurrency is false', () => {
      const result = formatXLM(1234.567, {
        decimals: 2,
        locale: 'en-US',
        includeCurrency: false,
      });
      expect(result).toBe('1,234.57');
    });
  });

  describe('locale variations', () => {
    it('should format with German locale', () => {
      const result = formatXLM(1234.567, {
        decimals: 2,
        locale: 'de-DE',
      });
      expect(result).toBe('1.234,57 XLM');
    });

    it('should format with French locale', () => {
      const result = formatXLM(1234.567, {
        decimals: 2,
        locale: 'fr-FR',
      });
      expect(result).toMatch(/1\s1234\s57 XLM/);
    });
  });
});

describe('formatXLMAmount', () => {
  it('should format XLM amount without currency', () => {
    const result = formatXLMAmount(1234.5678901);
    expect(result).toMatch(/1[,.]234\.57/);
  });

  it('should use custom decimal places', () => {
    const result = formatXLMAmount(1234.5678901, 7, 'en-US');
    expect(result).toBe('1,234.5678901');
  });

  it('should use custom locale', () => {
    const result = formatXLMAmount(1234.567, 2, 'de-DE');
    expect(result).toBe('1.234,57');
  });
});

describe('formatUSD', () => {
  describe('symbol format', () => {
    it('should format with $ symbol in en-US', () => {
      const result = formatUSD(1234.5, {
        locale: 'en-US',
        currencyFormat: 'symbol',
      });
      expect(result).toBe('$1,234.50');
    });

    it('should default to symbol format', () => {
      const result = formatUSD(1234.5, { locale: 'en-US' });
      expect(result).toBe('$1,234.50');
    });
  });

  describe('code format', () => {
    it('should format with USD code', () => {
      const result = formatUSD(1234.5, {
        locale: 'en-US',
        currencyFormat: 'code',
      });
      expect(result).toBe('1,234.50 USD');
    });
  });

  describe('locale variations', () => {
    it('should format with German locale', () => {
      const result = formatUSD(1234.5, {
        locale: 'de-DE',
        currencyFormat: 'symbol',
      });
      expect(result).toContain('1234');
    });
  });

  describe('edge cases', () => {
    it('should handle NaN', () => {
      expect(formatUSD(NaN, { locale: 'en-US' })).toBe('$0.00');
    });

    it('should handle zero', () => {
      expect(formatUSD(0, { locale: 'en-US' })).toBe('$0.00');
    });
  });

  describe('custom decimal places', () => {
    it('should use custom decimals', () => {
      const result = formatUSD(1234.5, {
        decimals: 3,
        locale: 'en-US',
        currencyFormat: 'symbol',
      });
      expect(result).toBe('$1,234.500');
    });

    it('should fall back when Intl.NumberFormat throws for invalid locale', () => {
      const result = formatUSD(1234.5, {
        decimals: 2,
        locale: 'en_US',
        currencyFormat: 'symbol',
      });

      expect(result).toBe('$1234.50');
    });
  });
});

describe('formatCrypto', () => {
  it('should format USDC', () => {
    const result = formatCrypto(100.5, 'USDC', 2, 'en-US');
    expect(result).toBe('100.50 USDC');
  });

  it('should format ETH with 4 decimals', () => {
    const result = formatCrypto(1.23456, 'ETH', 4, 'en-US');
    expect(result).toBe('1.2346 ETH');
  });

  it('should handle string input', () => {
    const result = formatCrypto('100.5', 'USDC', 2, 'en-US');
    expect(result).toBe('100.50 USDC');
  });
});

describe('formatPrice', () => {
  it('should format XLM to USD price', () => {
    const result = formatPrice(1, 'XLM', 0.12, 'USD', 2, 'en-US');
    expect(result).toBe('1 XLM ≈ $0.12');
  });

  it('should format XLM to other asset', () => {
    const result = formatPrice(1, 'XLM', 0.05, 'USDC', 2, 'en-US');
    expect(result).toBe('1 XLM ≈ 0.05 USDC');
  });

  it('should use locale formatting', () => {
    const result = formatPrice(1, 'XLM', 0.12, 'USD', 2, 'de-DE');
    expect(result).toContain('XLM');
    expect(result).toContain('≈');
  });
});

describe('parseFormattedAmount', () => {
  it('should parse en-US formatted amount', () => {
    expect(parseFormattedAmount('1,234.57', 'en-US')).toBe(1234.57);
  });

  it('should parse de-DE formatted amount', () => {
    expect(parseFormattedAmount('1.234,57', 'de-DE')).toBe(1234.57);
  });

  it('should handle amount without thousands separator', () => {
    expect(parseFormattedAmount('123.45', 'en-US')).toBe(123.45);
  });

  it('should handle negative amounts', () => {
    expect(parseFormattedAmount('-1,234.57', 'en-US')).toBe(-1234.57);
  });

  it('should handle invalid input', () => {
    expect(parseFormattedAmount('invalid', 'en-US')).toBe(0);
  });
});

describe('formatTransactionAmount', () => {
  it('should format transaction amount', () => {
    const result = formatTransactionAmount(100.5, 'XLM', 2, 'en-US');
    expect(result).toBe('100.50 XLM');
  });

  it('should work with different assets', () => {
    const result = formatTransactionAmount(50.123, 'USDC', 3, 'en-US');
    expect(result).toBe('50.123 USDC');
  });
});

describe('formatAbbreviated', () => {
  describe('thousands (K)', () => {
    it('should abbreviate thousands', () => {
      const result = formatAbbreviated(1234, 1, 'en-US');
      expect(result).toBe('1.2K');
    });

    it('should abbreviate with custom decimals', () => {
      const result = formatAbbreviated(1234, 2, 'en-US');
      expect(result).toBe('1.23K');
    });
  });

  describe('millions (M)', () => {
    it('should abbreviate millions', () => {
      const result = formatAbbreviated(1234567, 1, 'en-US');
      expect(result).toBe('1.2M');
    });

    it('should abbreviate with 2 decimals', () => {
      const result = formatAbbreviated(1234567, 2, 'en-US');
      expect(result).toBe('1.23M');
    });
  });

  describe('billions (B)', () => {
    it('should abbreviate billions', () => {
      const result = formatAbbreviated(1234567890, 1, 'en-US');
      expect(result).toBe('1.2B');
    });
  });

  describe('edge cases', () => {
    it('should not abbreviate small numbers', () => {
      const result = formatAbbreviated(100, 1, 'en-US');
      expect(result).toBe('100.0');
    });

    it('should handle negative numbers', () => {
      const result = formatAbbreviated(-1234, 1, 'en-US');
      expect(result).toBe('-1.2K');
    });

    it('should handle NaN', () => {
      const result = formatAbbreviated(NaN);
      expect(result).toBe('0');
    });
  });
});

describe('constants', () => {
  it('should have correct XLM_CONSTANTS', () => {
    expect(XLM_CONSTANTS.MAX_DECIMALS).toBe(7);
    expect(XLM_CONSTANTS.DISPLAY_DECIMALS).toBe(2);
    expect(XLM_CONSTANTS.FULL_PRECISION_DECIMALS).toBe(7);
    expect(XLM_CONSTANTS.MINIMUM_AMOUNT).toBe(0.0000001);
  });

  it('should have supported locales', () => {
    expect(SUPPORTED_LOCALES).toContain('en-US');
    expect(SUPPORTED_LOCALES).toContain('de-DE');
    expect(SUPPORTED_LOCALES).toContain('fr-FR');
    expect(SUPPORTED_LOCALES.length).toBeGreaterThan(0);
  });
});

describe('integration scenarios', () => {
  describe('wallet balance display', () => {
    it('should format balance for display', () => {
      const xlmBalance = 1234.5678901;
      const usdValue = 148.15;

      const xlmDisplay = formatXLM(xlmBalance, {
        decimals: 2,
        locale: 'en-US',
      });
      const usdDisplay = formatUSD(usdValue, {
        locale: 'en-US',
        currencyFormat: 'symbol',
      });

      expect(xlmDisplay).toBe('1,234.57 XLM');
      expect(usdDisplay).toBe('$148.15');
    });
  });

  describe('transaction confirmation', () => {
    it('should format transaction details', () => {
      const txAmount = 50.0;
      const exchangeRate = 0.12;

      const xlmFormatted = formatXLMAmount(txAmount, 2, 'en-US');
      const equivalentUSD = formatUSD(txAmount * exchangeRate, {
        locale: 'en-US',
        currencyFormat: 'symbol',
      });

      expect(xlmFormatted).toBe('50.00');
      expect(equivalentUSD).toBe('$6.00');
    });
  });

  describe('multi-locale support', () => {
    it('should handle multiple locales consistently', () => {
      const amount = 1234.567;
      const decimals = 2;

      const enUS = formatAmount(amount, { locale: 'en-US', decimals });
      const deDE = formatAmount(amount, { locale: 'de-DE', decimals });
      const frFR = formatAmount(amount, { locale: 'fr-FR', decimals });

      // All should parse back to the same number
      const parsedUS = parseFormattedAmount(enUS, 'en-US');
      const parsedDE = parseFormattedAmount(deDE, 'de-DE');
      const parsedFR = parseFormattedAmount(frFR, 'fr-FR');

      expect(parsedUS).toBe(amount);
      expect(parsedDE).toBe(amount);
      expect(parsedFR).toBe(amount);
    });
  });
});
