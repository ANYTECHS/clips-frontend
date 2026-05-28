/**
 * Sentry Client Configuration
 * 
 * This file configures Sentry for client-side error tracking.
 * It's automatically loaded by Next.js when the app runs in the browser.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || "development",
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Session replay
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  
  // Filter out PII from events
  beforeSend(event, hint) {
    // Filter out sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }
    
    // Sanitize wallet addresses and keys
    if (event.contexts) {
      sanitizeContext(event.contexts);
    }
    
    return event;
  },
  
  // Ignore specific errors
  ignoreErrors: [
    // Ignore network errors that are expected
    "Network request failed",
    "Failed to fetch",
    // Ignore user cancellation errors
    "User rejected the request",
    "User cancelled the request",
    // Ignore browser extension errors
    "Extension context invalidated",
  ],
  
  // Integrations
  integrations: [
    new Sentry.BrowserTracing({
      tracingOrigins: ["localhost", "clips-frontend.vercel.app", /^\//],
    }),
    new Sentry.Replay({
      maskAllText: false,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
  
  // Before send transaction
  beforeSendTransaction(transaction) {
    // Filter out health check transactions
    if (transaction.name === "/health" || transaction.name === "/api/health") {
      return null;
    }
    return transaction;
  },
});

/**
 * Sanitize context to remove PII
 */
function sanitizeContext(contexts: any) {
  for (const key in contexts) {
    if (typeof contexts[key] === "object" && contexts[key] !== null) {
      const obj = contexts[key];
      
      // Redact wallet addresses
      if (obj.wallet_address) {
        obj.wallet_address = redactAddress(obj.wallet_address);
      }
      if (obj.public_key) {
        obj.public_key = redactAddress(obj.public_key);
      }
      if (obj.address) {
        obj.address = redactAddress(obj.address);
      }
      
      // Redact secret keys
      if (obj.secret_key) {
        obj.secret_key = "[REDACTED]";
      }
      if (obj.private_key) {
        obj.private_key = "[REDACTED]";
      }
      if (obj.mnemonic) {
        obj.mnemonic = "[REDACTED]";
      }
    }
  }
}

/**
 * Redact wallet address for logging (show first 6 and last 4 characters)
 */
function redactAddress(address: string): string {
  if (!address || typeof address !== "string") return "[REDACTED]";
  if (address.length < 10) return "[REDACTED]";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
