import * as Sentry from "@sentry/nextjs";
import { sanitizeSentryContexts } from "@/app/lib/sentryRedaction";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || "development",

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

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

  ignoreErrors: [
    "Network request failed",
    "Failed to fetch",
    "User rejected the request",
    "User cancelled the request",
    "Extension context invalidated",
  ],
});
