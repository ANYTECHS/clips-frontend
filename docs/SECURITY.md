# Security

## Content Security Policy (CSP)

When deploying to production, the following Content Security Policy directives must include the analytics and resource domains listed below. Without these entries, analytics providers will be silently blocked by the browser.

### script-src

The following domains load JavaScript from external analytics providers and must be present in `script-src`:

- `https://www.googletagmanager.com` — Google Tag Manager (GA4 script loader)
- `https://plausible.io` — Plausible Analytics script

### connect-src

The following domains receive beacon / fetch requests for analytics data collection:

- `https://www.google-analytics.com` — GA4 data sends
- `https://plausible.io` — Plausible event API

### Additional Domains

These additional domains are used by the application and must appear in the appropriate CSP directives:

| Directive   | Domain                     | Purpose                          |
|------------|----------------------------|----------------------------------|
| `img-src`  | `https://api.dicebear.com` | Avatar generation                |
| `img-src`  | `https://images.unsplash.com` | Stock photography               |
| `connect-src` | `https://api.coingecko.com` | XLM / Stellar price data        |

### Example CSP Header (Production)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://www.googletagmanager.com https://plausible.io;
  connect-src 'self' https://www.google-analytics.com https://plausible.io https://api.coingecko.com;
  img-src 'self' data: https://api.dicebear.com https://images.unsplash.com;
  style-src 'self' 'unsafe-inline';
  frame-ancestors 'none';
```

### Testing

After configuring CSP headers, verify that no console violations appear when each analytics provider is enabled. Use the following procedure:

1. Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4` and verify GA4 events appear in the network tab with no CSP errors.
2. Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=plausible` and verify Plausible events appear in the network tab with no CSP errors.
3. Confirm that `cookie-consent` changes trigger and revoke analytics tracking without CSP violations.
