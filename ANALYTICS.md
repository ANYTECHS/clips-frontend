# Analytics Event Tracking

This document describes the analytics tracking implementation for ClipCash AI.

## Overview

The analytics system provides a unified interface for tracking user behavior across different analytics providers (Google Analytics 4, Plausible, or custom endpoints). It respects user cookie consent preferences and automatically filters out personally identifiable information (PII).

## Features

- ✅ **Multiple Provider Support**: Google Analytics 4, Plausible, or custom analytics endpoints
- ✅ **Privacy-First**: Respects cookie consent preferences from `/cookies` page
- ✅ **PII Protection**: Automatically sanitizes emails, wallet addresses, and other sensitive data
- ✅ **Automatic Page Tracking**: Tracks page views on route changes
- ✅ **Key Event Tracking**: User signup, video uploads, NFT minting, earnings exports, wallet connections
- ✅ **Configurable**: Provider selection via environment variables
- ✅ **Debug Mode**: Console logging in development environment

## Setup

### 1. Environment Configuration

Add the following to your `.env.local` file:

```bash
# Analytics Provider (options: 'ga4', 'plausible', 'custom', 'none')
NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4

# Google Analytics 4 Configuration (if using ga4)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Plausible Configuration (if using plausible)
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=clipcash.ai

# Custom Analytics Endpoint (if using custom)
NEXT_PUBLIC_ANALYTICS_ENDPOINT=https://your-analytics-api.com/events
```

### 2. Provider Setup

#### Google Analytics 4

1. Create a GA4 property in [Google Analytics](https://analytics.google.com/)
2. Copy your Measurement ID (format: `G-XXXXXXXXXX`)
3. Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4`
4. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`

#### Plausible Analytics

1. Sign up at [Plausible.io](https://plausible.io/)
2. Add your domain
3. Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=plausible`
4. Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=yourdomain.com`

#### Custom Analytics

1. Set up your custom analytics endpoint
2. Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=custom`
3. Set `NEXT_PUBLIC_ANALYTICS_ENDPOINT=https://your-api.com/events`

The custom endpoint will receive POST requests with this payload:

```json
{
  "event": "event_name",
  "properties": {
    "key": "value"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "url": "https://clipcash.ai/dashboard",
  "referrer": "https://google.com"
}
```

## Usage

### Automatic Tracking

Page views are automatically tracked when users navigate between pages. No additional code is required.

### Manual Event Tracking

Import the analytics utility and call tracking methods:

```typescript
import analytics from '@/lib/analytics';

// Track a custom event
analytics.trackEvent('button_clicked', {
  button_name: 'subscribe',
  location: 'header'
});

// Track user signup
analytics.trackSignup('email'); // or 'google', 'apple'

// Track video upload
analytics.trackVideoUpload(fileSize, duration);

// Track NFT minting
analytics.trackNFTMint(clipId);

// Track earnings export
analytics.trackEarningsExport('csv'); // or 'json', 'pdf'

// Track wallet connection
analytics.trackWalletConnect('metamask'); // or 'phantom'
```

## Tracked Events

### Core Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `page_view` | User navigates to a new page | `path` |
| `user_signup` | User creates an account | `method` (email, google, apple) |
| `video_upload` | User uploads a video | `file_size`, `duration` |
| `nft_mint` | User mints an NFT | `clip_id` |
| `earnings_export` | User exports earnings report | `format` (csv, json, pdf) |
| `wallet_connect` | User connects a wallet | `wallet_type` (metamask, phantom) |
| `wallet_disconnect` | User disconnects wallet | `wallet_type` |
| `signup_attempt` | User attempts OAuth signup | `method` (google, apple) |

### Custom Events

You can track custom events using `analytics.trackEvent()`:

```typescript
analytics.trackEvent('feature_used', {
  feature_name: 'ai_clip_generator',
  clips_generated: 5,
  processing_time: 120
});
```

## Privacy & Compliance

### Cookie Consent

Analytics tracking only occurs when users have granted analytics consent via the `/cookies` page. The system listens for consent changes and initializes/stops tracking accordingly.

### PII Protection

The following data is automatically redacted before sending to analytics providers:

- **Email addresses**: Replaced with `[REDACTED]`
- **Wallet addresses**: Stellar, Ethereum addresses replaced with `[REDACTED]`
- **SSN, Credit Cards**: Replaced with `[REDACTED]`
- **Object keys containing**: `email`, `wallet`, `address`, `phone`, `ssn`, `card`

Example:

```typescript
// Input
analytics.trackEvent('user_action', {
  user_email: 'user@example.com',
  wallet_address: 'GA7XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  action: 'clicked_button'
});

// Sent to analytics
{
  event: 'user_action',
  properties: {
    user_email: '[REDACTED]',
    wallet_address: '[REDACTED]',
    action: 'clicked_button'
  }
}
```

### IP Anonymization

For Google Analytics 4, IP anonymization is enabled by default:

```typescript
gtag('config', measurementId, {
  anonymize_ip: true,
  cookie_flags: 'SameSite=None;Secure',
});
```

## Architecture

### Files

```
clips-frontend/
├── app/
│   ├── lib/
│   │   └── analytics.ts          # Core analytics utility
│   └── components/
│       └── AnalyticsProvider.tsx # Auto page view tracking
├── .env.example                   # Environment variable template
└── ANALYTICS.md                   # This documentation
```

### Analytics Class

The `Analytics` class is a singleton that manages:

1. **Provider initialization**: Loads the appropriate analytics script
2. **Consent management**: Checks and respects user preferences
3. **Data sanitization**: Removes PII before transmission
4. **Event tracking**: Sends events to the configured provider

### Flow Diagram

```
User Action
    ↓
Track Event Called
    ↓
Check Consent ──→ No Consent? → Log & Exit
    ↓ Yes
Sanitize Data (Remove PII)
    ↓
Send to Provider (GA4/Plausible/Custom)
    ↓
Event Recorded
```

## Testing

### Development Mode

In development, analytics events are logged to the console:

```
[Analytics] Page view: /dashboard
[Analytics] Event: video_upload { file_size: 1048576, duration: 120 }
```

### Testing Checklist

- [ ] Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4` (or your provider)
- [ ] Configure measurement ID/domain
- [ ] Navigate to `/cookies` and enable analytics cookies
- [ ] Perform tracked actions (signup, upload, etc.)
- [ ] Check browser console for `[Analytics]` logs
- [ ] Verify events in your analytics dashboard (may take 24-48 hours for GA4)

### Testing Without Provider

Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=none` to disable analytics while still seeing console logs in development.

## Troubleshooting

### Events Not Appearing

1. **Check consent**: Visit `/cookies` and ensure analytics cookies are enabled
2. **Check environment variables**: Verify provider and credentials are set
3. **Check browser console**: Look for `[Analytics]` logs or errors
4. **Check ad blockers**: Some ad blockers prevent analytics scripts from loading
5. **Wait for processing**: GA4 can take 24-48 hours to show events

### PII Leaking

If you notice PII in your analytics:

1. Check the `PII_PATTERNS` array in `analytics.ts`
2. Add additional patterns if needed
3. Test with `analytics.trackEvent()` and check console output

### Provider Not Loading

1. Verify the provider script is loading (check Network tab)
2. Check for CSP (Content Security Policy) blocking the script
3. Ensure the measurement ID/domain is correct

## Best Practices

1. **Track meaningful events**: Focus on user actions that provide business insights
2. **Use consistent naming**: Follow a naming convention (e.g., `snake_case`)
3. **Include context**: Add relevant properties to events
4. **Respect privacy**: Never manually send PII
5. **Test thoroughly**: Verify events in development before deploying

## Future Enhancements

- [ ] Add support for Mixpanel
- [ ] Add support for Amplitude
- [ ] Add A/B testing integration
- [ ] Add funnel tracking utilities
- [ ] Add session replay integration
- [ ] Add performance monitoring

## Support

For issues or questions:

1. Check this documentation
2. Review the code in `app/lib/analytics.ts`
3. Check the browser console for errors
4. Verify your analytics provider dashboard

## License

This analytics implementation is part of the ClipCash AI project.
