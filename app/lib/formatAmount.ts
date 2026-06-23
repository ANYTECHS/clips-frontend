/**
 * Amount Formatting Utilities for XLM and other currencies
 * 
 * Provides locale-aware formatting for crypto amounts and fiat currencies
 * with support for different decimal places and formatting options.
 * 
 * Features:
 * - Locale-aware number formatting (commas, decimals)
 * - Support for different locales (e.g., en-US, de-DE, fr-FR)
 * - Configurable decimal places
 * - Special handling for XLM (7 decimal places by default)
 * - USD currency formatting
 * - Safe type-safe API
 */

/**
 * Options for formatting amounts
 */
export interface FormatAmountOptions {
  /** Number of decimal places to display. Default: 2 */
  decimals?: number;
  /** Locale string (e.g., 'en-US', 'de-DE'). Default: browser locale */
  locale?: string;
  /** Whether to include the currency symbol/code. Default: false */
  includeCurrency?: boolean;
  /** Currency code for display (e.g., 'XLM', 'USD'). Ignored if includeCurrency is false */
  currencyCode?: string;
  /** Minimum fraction digits. Default: same as decimals */
  minimumFractionDigits?: number;
}

/**
 * Options for XLM-specific formatting
 */
export interface FormatXLMOptions extends Omit<FormatAmountOptions, 'decimals'> {
  /** Number of decimal places for XLM. Default: 2 (7 for full precision) */
  decimals?: number;
  /** Whether to include 'XLM' suffix. Default: true */
  includeCurrency?: boolean;
}

/**
 * Options for USD formatting
 */
export interface FormatUSDOptions extends Omit<FormatAmountOptions, 'decimals'> {
  /** Number of decimal places for USD. Default: 2 */
  decimals?: number;
  /** Whether to use currency symbol ($) or code (USD). Default: 'symbol' */
  currencyFormat?: 'symbol' | 'code';
}

/**
 * Get the browser's locale or return a default
 */
function getBrowserLocale(): string {
  if (typeof navigator === 'undefined') {
    return 'en-US';
  }
  return navigator.language || 'en-US';
}

/**
 * Format a generic amount with locale-aware number formatting
 * 
 * @param amount - The amount to format (as number or string)
 * @param options - Formatting options
 * @returns Formatted amount string
 * 
 * @example
 * formatAmount(1234.567, { decimals: 2, locale: 'en-US' })
 * // Returns: "1,234.57"
 * 
 * @example
 * formatAmount(1234.567, { decimals: 2, locale: 'de-DE' })
 * // Returns: "1.234,57"
 */
export function formatAmount(
  amount: number | string,
  options: FormatAmountOptions = {}
): string {
  const {
    decimals = 2,
    locale = getBrowserLocale(),
    includeCurrency = false,
    currencyCode = '',
    minimumFractionDigits,
  } = options;

  // Convert to number if string
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Handle NaN or invalid input
  if (isNaN(numAmount)) {
    return '0';
  }

  // Handle infinity
  if (!isFinite(numAmount)) {
    return '∞';
  }

  try {
    const minFractionDigits = minimumFractionDigits ?? decimals;

    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: decimals,
      useGrouping: true,
    }).format(numAmount);

    if (includeCurrency && currencyCode) {
      return `${formatted} ${currencyCode}`;
    }

    return formatted;
  } catch (error) {
    console.error('Error formatting amount:', error);
    return numAmount.toFixed(decimals);
  }
}

/**
 * Format XLM amount with proper localization and decimal support
 * 
 * XLM uses 7 decimal places internally, but typically displays 2-7 decimals
 * depending on the use case.
 * 
 * @param amount - XLM amount (as number or string)
 * @param options - XLM formatting options
 * @returns Formatted XLM string
 * 
 * @example
 * formatXLM(1234.5678901, { decimals: 2 })
 * // Returns: "1,234.57 XLM"
 * 
 * @example
 * formatXLM(1234.5678901, { decimals: 7 })
 * // Returns: "1,234.5678901 XLM"
 * 
 * @example
 * formatXLM(1234.5678901, { decimals: 7, includeCurrency: false })
 * // Returns: "1,234.5678901"
 */
export function formatXLM(
  amount: number | string,
  options: FormatXLMOptions = {}
): string {
  const {
    decimals = 2,
    locale = getBrowserLocale(),
    includeCurrency = true,
    minimumFractionDigits,
  } = options;

  const formatted = formatAmount(amount, {
    decimals,
    locale,
    includeCurrency,
    currencyCode: 'XLM',
    minimumFractionDigits,
  });

  return formatted;
}

/**
 * Format XLM for display without currency symbol (compact display)
 * 
 * @param amount - XLM amount
 * @param decimals - Number of decimal places. Default: 2
 * @param locale - Locale string. Default: browser locale
 * @returns Formatted XLM amount without 'XLM' suffix
 * 
 * @example
 * formatXLMAmount(1234.5678901)
 * // Returns: "1,234.57"
 */
export function formatXLMAmount(
  amount: number | string,
  decimals: number = 2,
  locale?: string
): string {
  return formatAmount(amount, {
    decimals,
    locale,
    includeCurrency: false,
  });
}

/**
 * Format USD amount with currency formatting
 * 
 * @param amount - USD amount (as number or string)
 * @param options - USD formatting options
 * @returns Formatted USD string
 * 
 * @example
 * formatUSD(1234.5, { currencyFormat: 'symbol' })
 * // Returns: "$1,234.50" (in en-US locale)
 * 
 * @example
 * formatUSD(1234.5, { currencyFormat: 'code' })
 * // Returns: "1,234.50 USD"
 */
export function formatUSD(
  amount: number | string,
  options: FormatUSDOptions = {}
): string {
  const {
    decimals = 2,
    locale = getBrowserLocale(),
    currencyFormat = 'symbol',
  } = options;

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Handle NaN or invalid input
  if (isNaN(numAmount)) {
    return currencyFormat === 'symbol' ? '$0.00' : '0.00 USD';
  }

  try {
    if (currencyFormat === 'symbol') {
      const formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(numAmount);
      return formatted;
    } else {
      const formatted = formatAmount(numAmount, {
        decimals,
        locale,
        includeCurrency: true,
        currencyCode: 'USD',
      });
      return formatted;
    }
  } catch (error) {
    console.error('Error formatting USD:', error);
    return currencyFormat === 'symbol' 
      ? `$${numAmount.toFixed(decimals)}`
      : `${numAmount.toFixed(decimals)} USD`;
  }
}

/**
 * Format any cryptocurrency amount
 * 
 * @param amount - Amount (as number or string)
 * @param assetCode - Asset code (e.g., 'USDC', 'ETH')
 * @param decimals - Number of decimal places. Default: 2
 * @param locale - Locale string. Default: browser locale
 * @returns Formatted amount with asset code
 * 
 * @example
 * formatCrypto(100.5, 'USDC', 2)
 * // Returns: "100.50 USDC"
 */
export function formatCrypto(
  amount: number | string,
  assetCode: string,
  decimals: number = 2,
  locale?: string
): string {
  return formatAmount(amount, {
    decimals,
    locale,
    includeCurrency: true,
    currencyCode: assetCode,
  });
}

/**
 * Format a price in terms of another currency
 * Used for displaying exchange rates, e.g., "1 XLM ≈ $0.12"
 * 
 * @param amount - Amount of the first asset
 * @param fromAsset - First asset code (e.g., 'XLM')
 * @param toAmount - Amount of the second asset
 * @param toAsset - Second asset code (e.g., 'USD')
 * @param toDecimals - Decimal places for the second amount. Default: 2
 * @param locale - Locale string. Default: browser locale
 * @returns Formatted price string
 * 
 * @example
 * formatPrice(1, 'XLM', 0.12, 'USD')
 * // Returns: "1 XLM ≈ $0.12"
 * (Uses locale-appropriate formatting)
 */
export function formatPrice(
  amount: number | string,
  fromAsset: string,
  toAmount: number | string,
  toAsset: string,
  toDecimals: number = 2,
  locale?: string
): string {
  const fromFormatted = formatAmount(amount, {
    decimals: 0,
    locale,
    includeCurrency: true,
    currencyCode: fromAsset,
  });

  let toFormatted: string;
  if (toAsset === 'USD') {
    toFormatted = formatUSD(toAmount, {
      decimals: toDecimals,
      locale,
      currencyFormat: 'symbol',
    });
  } else {
    toFormatted = formatCrypto(toAmount, toAsset, toDecimals, locale);
  }

  return `${fromFormatted} ≈ ${toFormatted}`;
}

/**
 * Parse a formatted amount string back to a number
 * Useful for reversing locale-specific formatting
 * 
 * @param formatted - Formatted amount string
 * @param locale - Locale used for formatting. Default: browser locale
 * @returns Parsed number
 * 
 * @example
 * parseFormattedAmount("1,234.57", "en-US")
 * // Returns: 1234.57
 * 
 * @example
 * parseFormattedAmount("1.234,57", "de-DE")
 * // Returns: 1234.57
 */
export function parseFormattedAmount(
  formatted: string,
  locale: string = getBrowserLocale()
): number {
  // Remove any non-numeric characters except the decimal separator
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  const decimalPart = parts.find((p) => p.type === 'decimal');
  const groupPart = parts.find((p) => p.type === 'group');

  const decimalSeparator = decimalPart?.value ?? '.';
  const groupSeparator = groupPart?.value ?? ',';

  // Remove all group separators and replace decimal separator with '.'
  let normalized = formatted
    .replace(new RegExp(groupSeparator === '.' ? '\\.' : groupSeparator, 'g'), '')
    .replace(decimalSeparator, '.');

  // Remove any non-numeric characters except the decimal point
  normalized = normalized.replace(/[^\d.-]/g, '');

  return parseFloat(normalized) || 0;
}

/**
 * Format a transaction amount (shows both asset and amount)
 * 
 * @param amount - Transaction amount
 * @param assetCode - Asset code
 * @param decimals - Decimal places
 * @param locale - Locale for formatting
 * @returns Formatted transaction amount
 * 
 * @example
 * formatTransactionAmount(100.5, 'XLM', 2)
 * // Returns: "100.50 XLM"
 */
export function formatTransactionAmount(
  amount: number | string,
  assetCode: string,
  decimals: number = 2,
  locale?: string
): string {
  return formatCrypto(amount, assetCode, decimals, locale);
}

/**
 * Abbreviate large amounts with K, M, B suffixes
 * 
 * @param amount - Amount to abbreviate
 * @param decimals - Decimal places. Default: 1
 * @param locale - Locale for formatting
 * @returns Abbreviated amount (e.g., "1.2K", "3.5M")
 * 
 * @example
 * formatAbbreviated(1234)
 * // Returns: "1.2K"
 * 
 * @example
 * formatAbbreviated(1234567, 2)
 * // Returns: "1.23M"
 */
export function formatAbbreviated(
  amount: number | string,
  decimals: number = 1,
  locale?: string
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return '0';
  }

  const absAmount = Math.abs(numAmount);
  const sign = numAmount < 0 ? '-' : '';

  if (absAmount >= 1_000_000_000) {
    return `${sign}${formatAmount(absAmount / 1_000_000_000, {
      decimals,
      locale,
    })}B`;
  }
  if (absAmount >= 1_000_000) {
    return `${sign}${formatAmount(absAmount / 1_000_000, {
      decimals,
      locale,
    })}M`;
  }
  if (absAmount >= 1_000) {
    return `${sign}${formatAmount(absAmount / 1_000, {
      decimals,
      locale,
    })}K`;
  }

  return formatAmount(numAmount, { decimals, locale });
}

/**
 * Get a list of supported locales for testing/UI purposes
 */
export const SUPPORTED_LOCALES = [
  'en-US', // English - United States
  'en-GB', // English - United Kingdom
  'de-DE', // German - Germany
  'fr-FR', // French - France
  'es-ES', // Spanish - Spain
  'it-IT', // Italian - Italy
  'ja-JP', // Japanese - Japan
  'zh-CN', // Chinese - Simplified
  'zh-TW', // Chinese - Traditional
  'pt-BR', // Portuguese - Brazil
  'ko-KR', // Korean - Korea
];

/**
 * XLM-specific constants
 */
export const XLM_CONSTANTS = {
  /** Maximum decimal places for XLM (Stellar native limit) */
  MAX_DECIMALS: 7,
  /** Display decimal places for balance (typical use) */
  DISPLAY_DECIMALS: 2,
  /** Full precision decimal places */
  FULL_PRECISION_DECIMALS: 7,
  /** Minimum XLM amount (stroops) */
  MINIMUM_AMOUNT: 0.0000001,
};
