# XLM Amount Formatting Utilities

Comprehensive locale-aware formatting utilities for XLM and other cryptocurrency amounts with support for different locales and decimal places.

## Features

✅ **Locale-Aware Number Formatting** - Supports commas, decimals, and different separators based on locale (en-US, de-DE, fr-FR, etc.)

✅ **XLM-Specific Formatting** - Default 7 decimal places with flexible display options

✅ **USD Currency Support** - Format with $ symbol or USD code

✅ **Multi-Currency Support** - Format any cryptocurrency (USDC, ETH, etc.)

✅ **Reverse Parsing** - Convert formatted strings back to numbers

✅ **Abbreviated Display** - Show large amounts with K, M, B suffixes

✅ **Type-Safe API** - Full TypeScript support with proper types

## Installation

The formatting utilities are included in `app/lib/formatAmount.ts`. No additional installation needed.

## Usage

### Basic Amount Formatting

```tsx
import { formatAmount } from '@/app/lib/formatAmount';

// Default (2 decimals, browser locale)
formatAmount(1234.567);
// Returns: "1,234.57" (in en-US)

// Custom decimals
formatAmount(1234.5678901, { decimals: 7 });
// Returns: "1,234.5678901"

// Specific locale
formatAmount(1234.567, { locale: 'de-DE', decimals: 2 });
// Returns: "1.234,57"
```

### XLM Formatting

```tsx
import { formatXLM, formatXLMAmount } from '@/app/lib/formatAmount';

// Full format with XLM suffix
formatXLM(1234.5678901, { decimals: 2 });
// Returns: "1,234.57 XLM"

// Full precision
formatXLM(1234.5678901, { decimals: 7 });
// Returns: "1,234.5678901 XLM"

// Without suffix
formatXLMAmount(1234.5678901, 2);
// Returns: "1,234.57"
```

### USD Formatting

```tsx
import { formatUSD } from '@/app/lib/formatAmount';

// With $ symbol (default)
formatUSD(1234.5, { locale: 'en-US' });
// Returns: "$1,234.50"

// With USD code
formatUSD(1234.5, { locale: 'en-US', currencyFormat: 'code' });
// Returns: "1,234.50 USD"
```

### Multi-Currency Formatting

```tsx
import { formatCrypto } from '@/app/lib/formatAmount';

// Format any cryptocurrency
formatCrypto(100.5, 'USDC', 2, 'en-US');
// Returns: "100.50 USDC"

formatCrypto(1.23456, 'ETH', 4, 'en-US');
// Returns: "1.2346 ETH"
```

### Price Display

```tsx
import { formatPrice } from '@/app/lib/formatAmount';

// Show exchange rate
formatPrice(1, 'XLM', 0.12, 'USD', 2, 'en-US');
// Returns: "1 XLM ≈ $0.12"
```

### Abbreviate Large Numbers

```tsx
import { formatAbbreviated } from '@/app/lib/formatAmount';

formatAbbreviated(1234);         // "1.2K"
formatAbbreviated(1234567);      // "1.2M"
formatAbbreviated(1234567890);   // "1.2B"
formatAbbreviated(1234, 2);      // "1.23K"
```

### Parse Formatted Strings

```tsx
import { parseFormattedAmount } from '@/app/lib/formatAmount';

// Reverse locale-specific formatting
parseFormattedAmount('1,234.57', 'en-US');  // 1234.57
parseFormattedAmount('1.234,57', 'de-DE');  // 1234.57
```

## Component Integration

### In `WalletInfoCard.tsx`

```tsx
import { formatXLM, formatUSD } from '@/app/lib/formatAmount';

// Display XLM balance
const xlmDisplay = formatXLM(balance.xlm, { decimals: 2 });
// "1,234.57 XLM"

// Display USD equivalent
const usdDisplay = formatUSD(balance.usd, { currencyFormat: 'symbol' });
// "$148.15"
```

### In `TransactionHistory.tsx`

```tsx
import { formatTransactionAmount } from '@/app/lib/formatAmount';

// Format transaction amount
formatTransactionAmount(100.5, 'XLM', 2);
// "100.50 XLM"
```

### In `BalanceDisplay.tsx`

```tsx
import { formatCrypto } from '@/app/lib/formatAmount';

// Display other assets
formatCrypto(asset.balance, asset.code, 2);
// "50.00 USDC"
```

## Supported Locales

The utilities support these locales out of the box:

- `en-US` - English (United States)
- `en-GB` - English (United Kingdom)
- `de-DE` - German (Germany)
- `fr-FR` - French (France)
- `es-ES` - Spanish (Spain)
- `it-IT` - Italian (Italy)
- `ja-JP` - Japanese (Japan)
- `zh-CN` - Chinese (Simplified)
- `zh-TW` - Chinese (Traditional)
- `pt-BR` - Portuguese (Brazil)
- `ko-KR` - Korean (Korea)

## API Reference

### `formatAmount(amount, options?): string`

Format a generic amount with locale-aware number formatting.

**Options:**
- `decimals?: number` - Decimal places (default: 2)
- `locale?: string` - Locale code (default: browser locale)
- `includeCurrency?: boolean` - Add currency suffix (default: false)
- `currencyCode?: string` - Currency code to display
- `minimumFractionDigits?: number` - Minimum fraction digits

### `formatXLM(amount, options?): string`

Format XLM amount with proper localization.

**Options:**
- `decimals?: number` - Decimal places (default: 2)
- `locale?: string` - Locale code (default: browser locale)
- `includeCurrency?: boolean` - Add 'XLM' suffix (default: true)
- `minimumFractionDigits?: number` - Minimum fraction digits

### `formatXLMAmount(amount, decimals?, locale?): string`

Format XLM for display without currency symbol.

### `formatUSD(amount, options?): string`

Format USD amount with currency formatting.

**Options:**
- `decimals?: number` - Decimal places (default: 2)
- `locale?: string` - Locale code (default: browser locale)
- `currencyFormat?: 'symbol' | 'code'` - Format style (default: 'symbol')

### `formatCrypto(amount, assetCode, decimals?, locale?): string`

Format any cryptocurrency amount.

### `formatPrice(amount, fromAsset, toAmount, toAsset, toDecimals?, locale?): string`

Format exchange rate display.

### `parseFormattedAmount(formatted, locale?): number`

Parse formatted amount string back to number.

### `formatTransactionAmount(amount, assetCode, decimals?, locale?): string`

Format transaction amount with asset code.

### `formatAbbreviated(amount, decimals?, locale?): string`

Abbreviate large amounts with K, M, B suffixes.

## Constants

### `XLM_CONSTANTS`

```typescript
export const XLM_CONSTANTS = {
  MAX_DECIMALS: 7,              // Maximum decimal places (Stellar limit)
  DISPLAY_DECIMALS: 2,           // Typical display decimals
  FULL_PRECISION_DECIMALS: 7,    // Full precision decimals
  MINIMUM_AMOUNT: 0.0000001,     // Minimum XLM amount (1 stroop)
};
```

### `SUPPORTED_LOCALES`

Array of supported locale codes for testing/UI purposes.

## Examples

### Wallet Balance Display

```tsx
import { formatXLM, formatUSD } from '@/app/lib/formatAmount';

export function BalanceCard({ xlmBalance, usdValue }) {
  return (
    <div>
      <h2>{formatXLM(xlmBalance, { decimals: 2 })}</h2>
      <p>≈ {formatUSD(usdValue, { currencyFormat: 'symbol' })}</p>
    </div>
  );
}
```

### Transaction List

```tsx
import { formatTransactionAmount, formatUSD } from '@/app/lib/formatAmount';

export function TransactionRow({ amount, asset, usdValue }) {
  return (
    <div>
      <span>{formatTransactionAmount(amount, asset, 2)}</span>
      <span>{formatUSD(usdValue, { currencyFormat: 'symbol' })}</span>
    </div>
  );
}
```

### Multi-Currency Asset Display

```tsx
import { formatCrypto } from '@/app/lib/formatAmount';

export function AssetList({ assets }) {
  return (
    <ul>
      {assets.map(asset => (
        <li key={asset.code}>
          {asset.code}: {formatCrypto(asset.balance, asset.code, 2)}
        </li>
      ))}
    </ul>
  );
}
```

### Abbreviate Large Amounts

```tsx
import { formatAbbreviated } from '@/app/lib/formatAmount';

export function TotalVolume({ volume }) {
  return <div>Total: {formatAbbreviated(volume, 2)}</div>;
}
```

## Testing

Tests are included in `app/lib/formatAmount.test.ts`. Run tests with:

```bash
npm run test
```

Or with vitest:

```bash
npm run test:unit
```

The test suite covers:
- Basic formatting
- Decimal places
- Locale variations (en-US, de-DE, fr-FR, etc.)
- Currency display
- Edge cases (NaN, Infinity, very small/large numbers)
- Parsing formatted amounts
- Multi-locale consistency
- Integration scenarios

## Best Practices

1. **Use Specific Formatters** - Use `formatXLM()` for XLM, not generic `formatAmount()`
2. **Consistent Decimals** - Use `decimals: 2` for display, `decimals: 7` for full precision
3. **Locale from Context** - Let the browser determine locale by default, or pass from user settings
4. **Handle Edge Cases** - Functions handle NaN, Infinity, and invalid input gracefully
5. **Parse When Needed** - Use `parseFormattedAmount()` when converting user input back
6. **Type Safety** - Always import TypeScript types for better IDE support

## Related Files

- `components/dashboard/WalletInfoCard.tsx` - Uses formatXLM, formatUSD
- `components/ui/TransactionTable.tsx` - Uses formatUSD, formatCrypto
- `components/wallet/TransactionHistory.tsx` - Uses formatTransactionAmount
- `components/wallet/BalanceDisplay.tsx` - Uses formatCrypto
- `components/WalletConnectButton.tsx` - Uses formatXLMAmount
- `components/SendPaymentForm.tsx` - Uses formatXLMAmount

## Changelog

### v1.0.0

Initial release with comprehensive locale-aware formatting for XLM and other cryptocurrencies.

- ✅ Locale-aware number formatting
- ✅ XLM, USD, and multi-currency support
- ✅ Abbreviated display (K, M, B)
- ✅ Reverse parsing capability
- ✅ Full TypeScript support
- ✅ Comprehensive test suite
- ✅ Integration with existing components
