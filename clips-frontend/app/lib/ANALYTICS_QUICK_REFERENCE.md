# Analytics Quick Reference

Quick reference guide for using the analytics system in ClipCash AI.

## Setup (One-Time)

```bash
# .env.local
NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

## Import

```typescript
import analytics from '@/lib/analytics';
```

## Common Usage

### Track Custom Event
```typescript
analytics.trackEvent('event_name', {
  property1: 'value1',
  property2: 123,
  property3: true
});
```

### Track User Signup
```typescript
analytics.trackSignup('email');      // Email signup
analytics.trackSignup('google');     // Google OAuth
analytics.trackSignup('apple');      // Apple OAuth
```

### Track Video Upload
```typescript
const fileSize = file.size;          // in bytes
const duration = 120;                // in seconds
analytics.trackVideoUpload(fileSize, duration);
```

### Track NFT Minting
```typescript
const clipId = 'clip_123';
analytics.trackNFTMint(clipId);
```

### Track Earnings Export
```typescript
analytics.trackEarningsExport('csv');   // CSV export
analytics.trackEarningsExport('json');  // JSON export
analytics.trackEarningsExport('pdf');   // PDF export
```

### Track Wallet Connection
```typescript
analytics.trackWalletConnect('metamask');  // MetaMask
analytics.trackWalletConnect('phantom');   // Phantom
```

### Track Page View (Manual)
```typescript
// Usually automatic, but can be called manually
analytics.trackPageView('/custom-page');
```

## Event Naming Convention

Use `snake_case` for event names and properties:

```typescript
// ✅ Good
analytics.trackEvent('button_clicked', {
  button_name: 'subscribe',
  page_location: 'header'
});

// ❌ Avoid
analytics.trackEvent('ButtonClicked', {
  buttonName: 'subscribe',
  PageLocation: 'header'
});
```

## Privacy Notes

### Automatically Redacted
- Email addresses
- Wallet addresses (Stellar, Ethereum)
- Any property with keys: `email`, `wallet`, `address`, `phone`, `ssn`, `card`

### Safe to Track
- User actions (clicks, views, etc.)
- Feature usage
- Performance metrics
- Non-identifying metadata

```typescript
// ✅ Safe
analytics.trackEvent('feature_used', {
  feature_name: 'ai_clipping',
  clips_generated: 5,
  processing_time: 120
});

// ⚠️ Will be redacted automatically
analytics.trackEvent('user_info', {
  email: 'user@example.com',        // → [REDACTED]
  wallet: 'GA7XXX...',              // → [REDACTED]
  username: 'john_doe'              // → OK
});
```

## Consent Check

Analytics only tracks when user has granted consent via `/cookies` page.

```typescript
// No need to check consent manually - handled automatically
analytics.trackEvent('my_event');  // Only tracks if consent given
```

## Debug Mode

In development, all events are logged to console:

```
[Analytics] Event: button_clicked { button_name: 'subscribe' }
[Analytics] Page view: /dashboard
```

## Providers

### Google Analytics 4
```bash
NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Plausible
```bash
NEXT_PUBLIC_ANALYTICS_PROVIDER=plausible
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=clipcash.ai
```

### Custom Endpoint
```bash
NEXT_PUBLIC_ANALYTICS_PROVIDER=custom
NEXT_PUBLIC_ANALYTICS_ENDPOINT=https://api.example.com/events
```

### Disable
```bash
NEXT_PUBLIC_ANALYTICS_PROVIDER=none
```

## Common Patterns

### Track Button Click
```typescript
<button onClick={() => {
  analytics.trackEvent('button_clicked', {
    button_name: 'subscribe',
    location: 'pricing_page'
  });
  // ... rest of handler
}}>
  Subscribe
</button>
```

### Track Form Submission
```typescript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  analytics.trackEvent('form_submitted', {
    form_name: 'contact',
    fields_filled: 5
  });
  
  // ... submit logic
};
```

### Track Feature Usage
```typescript
const generateClips = async () => {
  const startTime = Date.now();
  
  // ... generation logic
  
  const duration = Date.now() - startTime;
  analytics.trackEvent('clips_generated', {
    count: clips.length,
    duration_ms: duration,
    ai_model: 'v2'
  });
};
```

### Track Error
```typescript
try {
  // ... some operation
} catch (error) {
  analytics.trackEvent('error_occurred', {
    error_type: error.name,
    error_location: 'video_upload',
    // Don't include error.message if it might contain PII
  });
}
```

## TypeScript Types

```typescript
import analytics, { type EventProperties } from '@/lib/analytics';

// EventProperties type
interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

// Usage
const properties: EventProperties = {
  feature: 'ai_clipping',
  count: 5,
  enabled: true
};

analytics.trackEvent('feature_used', properties);
```

## Troubleshooting

### Events Not Tracking
1. Check console for `[Analytics]` logs
2. Verify consent at `/cookies`
3. Check environment variables
4. Disable ad blockers

### PII Appearing
1. Check property names (avoid `email`, `wallet`, etc.)
2. Review `PII_PATTERNS` in `analytics.ts`
3. Test in development mode first

### Provider Not Loading
1. Verify measurement ID/domain
2. Check browser console for errors
3. Check Network tab for script loading

## Best Practices

1. **Track meaningful events** - Focus on user actions that provide insights
2. **Use consistent naming** - Stick to `snake_case` convention
3. **Include context** - Add relevant properties to events
4. **Test in development** - Verify events before deploying
5. **Respect privacy** - Never manually send PII

## Examples by Feature

### Dashboard
```typescript
// Track dashboard view
analytics.trackPageView('/dashboard');

// Track stat card click
analytics.trackEvent('stat_card_clicked', {
  card_type: 'earnings',
  value: '12450.80'
});
```

### Video Upload
```typescript
// Track upload start
analytics.trackEvent('upload_started', {
  file_count: files.length
});

// Track upload complete
analytics.trackVideoUpload(totalSize, fileCount);
```

### NFT Minting
```typescript
// Track mint button click
analytics.trackEvent('mint_button_clicked', {
  clip_id: clipId,
  rarity: 'epic'
});

// Track successful mint
analytics.trackNFTMint(clipId);
```

### Earnings
```typescript
// Track export button click
analytics.trackEvent('export_button_clicked', {
  format: 'csv',
  transaction_count: transactions.length
});

// Track successful export
analytics.trackEarningsExport('csv');
```

## Need Help?

- Read full documentation: `ANALYTICS.md`
- Check implementation: `app/lib/analytics.ts`
- View examples: `ANALYTICS_IMPLEMENTATION_SUMMARY.md`
