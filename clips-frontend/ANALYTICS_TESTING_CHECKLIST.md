# Analytics Testing Checklist

Use this checklist to verify the analytics implementation is working correctly.

## Pre-Testing Setup

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env.local`
- [ ] Set `NEXT_PUBLIC_ANALYTICS_PROVIDER` to your choice (`ga4`, `plausible`, `custom`, or `none`)
- [ ] Configure provider-specific variables:
  - **GA4**: Set `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  - **Plausible**: Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`
  - **Custom**: Set `NEXT_PUBLIC_ANALYTICS_ENDPOINT`

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open Browser Console
- Open DevTools (F12)
- Go to Console tab
- Look for `[Analytics]` logs

---

## Testing Checklist

### ✅ Cookie Consent Integration

#### Test 1: No Consent (Default State)
- [ ] Navigate to any page
- [ ] Check console for: `[Analytics] Page view not tracked - no consent: /path`
- [ ] Verify no events are sent to analytics provider

#### Test 2: Grant Consent
- [ ] Navigate to `/cookies`
- [ ] Toggle "Analytics Cookies" to ON
- [ ] Check console for: `[Analytics] Analytics initialized: [provider]`
- [ ] Navigate to another page
- [ ] Check console for: `[Analytics] Page view: /path`

#### Test 3: Revoke Consent
- [ ] Navigate to `/cookies`
- [ ] Toggle "Analytics Cookies" to OFF
- [ ] Navigate to another page
- [ ] Verify no tracking occurs

---

### ✅ Automatic Page View Tracking

#### Test 4: Page Navigation
- [ ] Enable analytics consent
- [ ] Navigate to `/dashboard`
- [ ] Check console: `[Analytics] Page view: /dashboard`
- [ ] Navigate to `/earnings`
- [ ] Check console: `[Analytics] Page view: /earnings`
- [ ] Navigate to `/settings`
- [ ] Check console: `[Analytics] Page view: /settings`

#### Test 5: Query Parameters
- [ ] Navigate to `/dashboard?tab=overview`
- [ ] Check console includes query params in path
- [ ] Verify no PII in query params is logged

---

### ✅ User Signup Tracking

#### Test 6: Email Signup
- [ ] Go to `/login`
- [ ] Fill in signup form with email
- [ ] Click "Create Account"
- [ ] Check console: `[Analytics] Event: user_signup { method: 'email' }`

#### Test 7: OAuth Signup Attempt
- [ ] Go to `/login`
- [ ] Click "Continue with Google"
- [ ] Check console: `[Analytics] Event: signup_attempt { method: 'google' }`
- [ ] Click "Continue with Apple"
- [ ] Check console: `[Analytics] Event: signup_attempt { method: 'apple' }`

---

### ✅ Video Upload Tracking

#### Test 8: Video Upload
- [ ] Go to `/dashboard`
- [ ] Click "Quick Upload" button
- [ ] Select a video file
- [ ] Wait for upload to complete
- [ ] Check console: `[Analytics] Event: video_upload { file_size: [number], duration: [number] }`
- [ ] Verify file_size is in bytes

---

### ✅ NFT Minting Tracking

#### Test 9: NFT Mint
- [ ] Go to `/nft-demo` (or any page with NFT cards)
- [ ] Hover over an NFT card with "Ready to Mint" status
- [ ] Click "Mint Now" button
- [ ] Check console: `[Analytics] Event: nft_mint { clip_id: '[id]' }`

---

### ✅ Earnings Export Tracking

#### Test 10: CSV Export
- [ ] Go to `/earnings`
- [ ] Click "Export" dropdown
- [ ] Select "CSV"
- [ ] Check console: `[Analytics] Event: earnings_export { format: 'csv' }`

#### Test 11: JSON Export
- [ ] Click "Export" dropdown
- [ ] Select "JSON"
- [ ] Check console: `[Analytics] Event: earnings_export { format: 'json' }`

#### Test 12: PDF Export
- [ ] Click "Export" dropdown
- [ ] Select "PDF"
- [ ] Check console: `[Analytics] Event: earnings_export { format: 'pdf' }`

---

### ✅ Wallet Connection Tracking

#### Test 13: MetaMask Connection
- [ ] Ensure MetaMask is installed
- [ ] Click "Connect Wallet" button
- [ ] Approve connection in MetaMask
- [ ] Check console: `[Analytics] Event: wallet_connect { wallet_type: 'metamask' }`

#### Test 14: Wallet Disconnection
- [ ] Click disconnect button
- [ ] Check console: `[Analytics] Event: wallet_disconnect { wallet_type: 'metamask' }`

#### Test 15: Phantom Connection (if available)
- [ ] Ensure Phantom is installed
- [ ] Click "Connect Wallet" button
- [ ] Approve connection in Phantom
- [ ] Check console: `[Analytics] Event: wallet_connect { wallet_type: 'phantom' }`

---

### ✅ PII Sanitization

#### Test 16: Email Redaction
- [ ] Open browser console
- [ ] Run: `analytics.trackEvent('test', { email: 'user@example.com' })`
- [ ] Check console output shows: `email: '[REDACTED]'`

#### Test 17: Wallet Address Redaction
- [ ] Run: `analytics.trackEvent('test', { wallet: 'GA7XXXXXXXXX' })`
- [ ] Check console output shows: `wallet: '[REDACTED]'`

#### Test 18: Nested Object Sanitization
- [ ] Run: `analytics.trackEvent('test', { user: { email: 'test@test.com', name: 'John' } })`
- [ ] Check console shows: `user: { email: '[REDACTED]', name: 'John' }`

---

### ✅ Provider Integration

#### Test 19: Google Analytics 4 (if configured)
- [ ] Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4`
- [ ] Set valid `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- [ ] Enable analytics consent
- [ ] Perform tracked actions
- [ ] Check Network tab for requests to `google-analytics.com`
- [ ] Wait 24-48 hours and check GA4 dashboard for events

#### Test 20: Plausible (if configured)
- [ ] Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=plausible`
- [ ] Set valid `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`
- [ ] Enable analytics consent
- [ ] Perform tracked actions
- [ ] Check Network tab for requests to `plausible.io`
- [ ] Check Plausible dashboard for events (usually real-time)

#### Test 21: Custom Endpoint (if configured)
- [ ] Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=custom`
- [ ] Set valid `NEXT_PUBLIC_ANALYTICS_ENDPOINT`
- [ ] Enable analytics consent
- [ ] Perform tracked actions
- [ ] Check Network tab for POST requests to your endpoint
- [ ] Verify payload structure matches documentation

---

### ✅ Error Handling

#### Test 22: No Provider Configured
- [ ] Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=none`
- [ ] Enable analytics consent
- [ ] Perform tracked actions
- [ ] Verify events are logged to console but not sent anywhere

#### Test 23: Invalid Provider
- [ ] Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=invalid`
- [ ] Enable analytics consent
- [ ] Verify no errors in console
- [ ] Verify events are logged but not sent

#### Test 24: Missing Credentials
- [ ] Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4`
- [ ] Don't set `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- [ ] Enable analytics consent
- [ ] Check console for warning: `GA4 measurement ID not configured`

---

### ✅ Edge Cases

#### Test 25: Rapid Page Navigation
- [ ] Enable analytics consent
- [ ] Quickly navigate between multiple pages
- [ ] Verify each page view is tracked
- [ ] Verify no duplicate events

#### Test 26: Multiple Events in Quick Succession
- [ ] Trigger multiple events quickly (e.g., multiple button clicks)
- [ ] Verify all events are tracked
- [ ] Verify no events are lost

#### Test 27: Large Event Properties
- [ ] Track event with large property values
- [ ] Verify event is tracked successfully
- [ ] Verify no truncation or errors

---

## Production Testing

### Test 28: Production Build
- [ ] Build the application: `npm run build`
- [ ] Start production server: `npm start`
- [ ] Verify analytics works in production mode
- [ ] Verify no `[Analytics]` logs in console (production)

### Test 29: Analytics Dashboard Verification
- [ ] Wait 24-48 hours after testing (for GA4)
- [ ] Log into analytics dashboard
- [ ] Verify events appear correctly
- [ ] Verify event properties are correct
- [ ] Verify no PII is present

---

## Performance Testing

### Test 30: Page Load Performance
- [ ] Open DevTools Performance tab
- [ ] Record page load
- [ ] Verify analytics doesn't significantly impact load time
- [ ] Verify analytics scripts load asynchronously

### Test 31: Memory Leaks
- [ ] Navigate between pages multiple times
- [ ] Check Memory tab in DevTools
- [ ] Verify no memory leaks from analytics

---

## Accessibility Testing

### Test 32: Keyboard Navigation
- [ ] Navigate site using only keyboard
- [ ] Verify tracked events still fire
- [ ] Verify no accessibility issues introduced

### Test 33: Screen Reader
- [ ] Use screen reader
- [ ] Verify analytics doesn't interfere with screen reader
- [ ] Verify no analytics-related announcements

---

## Cross-Browser Testing

### Test 34: Chrome
- [ ] Test all features in Chrome
- [ ] Verify all events track correctly

### Test 35: Firefox
- [ ] Test all features in Firefox
- [ ] Verify all events track correctly

### Test 36: Safari
- [ ] Test all features in Safari
- [ ] Verify all events track correctly
- [ ] Check for ITP (Intelligent Tracking Prevention) issues

### Test 37: Edge
- [ ] Test all features in Edge
- [ ] Verify all events track correctly

---

## Mobile Testing

### Test 38: Mobile Chrome
- [ ] Test on mobile Chrome
- [ ] Verify touch events are tracked
- [ ] Verify page views work correctly

### Test 39: Mobile Safari
- [ ] Test on mobile Safari
- [ ] Verify all features work
- [ ] Check for iOS-specific issues

---

## Security Testing

### Test 40: XSS Prevention
- [ ] Try injecting script tags in event properties
- [ ] Verify scripts are not executed
- [ ] Verify data is properly sanitized

### Test 41: CSRF Protection
- [ ] Verify analytics requests don't expose sensitive tokens
- [ ] Verify no authentication tokens in analytics data

---

## Documentation Testing

### Test 42: Quick Reference
- [ ] Follow examples in `ANALYTICS_QUICK_REFERENCE.md`
- [ ] Verify all examples work as documented

### Test 43: Full Documentation
- [ ] Follow setup guide in `ANALYTICS.md`
- [ ] Verify all instructions are accurate
- [ ] Test all code examples

---

## Sign-Off

### Development Testing
- [ ] All tests passed in development
- [ ] No console errors
- [ ] All events tracking correctly
- [ ] PII sanitization working
- [ ] Consent management working

### Production Testing
- [ ] Production build successful
- [ ] Analytics working in production
- [ ] Events appearing in dashboard
- [ ] No performance issues

### Documentation
- [ ] All documentation accurate
- [ ] Examples working
- [ ] Setup guide complete

---

## Test Results

**Tested By**: _______________  
**Date**: _______________  
**Environment**: Development / Production  
**Provider**: GA4 / Plausible / Custom / None  
**Browser**: _______________  
**Result**: Pass / Fail  

**Notes**:
```
[Add any notes or issues found during testing]
```

---

## Issues Found

| Test # | Issue Description | Severity | Status |
|--------|------------------|----------|--------|
|        |                  |          |        |

---

**Testing Complete**: ☐ Yes ☐ No  
**Ready for Production**: ☐ Yes ☐ No
