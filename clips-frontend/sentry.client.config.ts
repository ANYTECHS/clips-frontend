/**
 * Sentry Client Configuration
 *
 * This file configures Sentry for client-side error tracking.
 * It's automatically loaded by Next.js when the app runs in the browser.
 *
 * Breadcrumb audit (addBreadcrumb call sites):
 * - app/lib/sentry.ts addWalletBreadcrumb — wallet context; sanitized via sanitizeBreadcrumbPayload
 * - app/lib/walletErrorTracking.ts addWalletBreadcrumb — wallet ops; sanitized before addBreadcrumb
 * Breadcrumbs bypass beforeSend; beforeBreadcrumb below mirrors beforeSend PII redaction.
 */

import * as Sentry from "@sentry/nextjs";
import {
  sanitizeBreadcrumb,
  sanitizeSentryContexts,
} from "@/app/lib/sentryRedaction";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || "development",

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,

  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }

    if (event.contexts) {
      sanitizeSentryContexts(event.contexts);
    }

    return event;
  },

  beforeBreadcrumb(breadcrumb) {
    return sanitizeBreadcrumb(breadcrumb);
  },

  ignoreErrors: [
    "Network request failed",
    "Failed to fetch",
    "User rejected the request",
    "User cancelled the request",
    "Extension context invalidated",
  ],

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

  beforeSendTransaction(transaction) {
    if (transaction.name === "/health" || transaction.name === "/api/health") {
      return null;
    }
    return transaction;
  },
});
