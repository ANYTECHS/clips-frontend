/**
 * Sentry Error Monitoring Configuration
 * 
 * Integrates Sentry for production error tracking and monitoring.
 * Captures wallet operation errors, user context, and performance metrics.
 */

import * as Sentry from "@sentry/nextjs";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  redactAddress,
  redactEmail,
  sanitizeBreadcrumbPayload,
  sanitizeSentryContexts,
} from "@/app/lib/sentryRedaction";
import {
  INVOKE_CONTRACT_NOT_SUPPORTED_CODE,
  INVOKE_CONTRACT_USER_MESSAGE,
} from "@/app/lib/stellarOperations";

// Sentry DSN from environment variables
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV;
const SENTRY_RELEASE = process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || "development";

/**
 * Initialize Sentry for client-side error tracking
 */
export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn("Sentry DSN not configured - error monitoring disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    
    // Performance monitoring
    tracesSampleRate: SENTRY_ENVIRONMENT === "production" ? 0.1 : 1.0,
    
    // Session replay
    replaysSessionSampleRate: SENTRY_ENVIRONMENT === "production" ? 0.1 : 1.0,
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
        sanitizeSentryContexts(event.contexts);
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
        // Set custom transaction names based on route
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
}

export function captureSorobanNotSupportedWarning(context?: Record<string, unknown>) {
  Sentry.captureMessage(INVOKE_CONTRACT_USER_MESSAGE, {
    level: "warning",
    tags: {
      stellar_operation: "invoke_contract",
      error_code: INVOKE_CONTRACT_NOT_SUPPORTED_CODE,
    },
    extra: context,
  });
}

/**
 * Set user context for Sentry
 */
export function setSentryUser(user: { id: string; email?: string } | null) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email ? redactEmail(user.email) : undefined,
  });
}

/**
 * Capture wallet operation error with context
 */
export function captureWalletError(
  error: Error | unknown,
  operation: string,
  context?: {
    walletType?: string;
    walletAddress?: string;
    network?: string;
    userId?: string;
    [key: string]: any;
  }
) {
  const errorContext: any = {
    operation,
    category: "wallet",
    ...context,
  };

  // Redact sensitive data
  if (context?.walletAddress) {
    errorContext.walletAddress = redactAddress(context.walletAddress);
  }
  if (context?.publicKey) {
    errorContext.publicKey = redactAddress(context.publicKey);
  }
  if (context?.secretKey) {
    errorContext.secretKey = "[REDACTED]";
  }

  Sentry.captureException(error, {
    tags: {
      wallet_operation: operation,
      wallet_type: context?.walletType,
      network: context?.network,
    },
    extra: errorContext,
    level: "error",
  });
}

/**
 * Capture wallet operation success for monitoring
 */
export function captureWalletEvent(
  event: string,
  context?: {
    walletType?: string;
    walletAddress?: string;
    network?: string;
    [key: string]: any;
  }
) {
  const eventContext: any = {
    category: "wallet",
    ...context,
  };

  // Redact sensitive data
  if (context?.walletAddress) {
    eventContext.walletAddress = redactAddress(context.walletAddress);
  }
  if (context?.publicKey) {
    eventContext.publicKey = redactAddress(context.publicKey);
  }

  Sentry.captureMessage(event, {
    level: "info",
    tags: {
      wallet_event: event,
      wallet_type: context?.walletType,
      network: context?.network,
    },
    extra: eventContext,
  });
}

/**
 * Add wallet context breadcrumb
 */
export function addWalletBreadcrumb(
  message: string,
  category: string = "wallet",
  data?: any
) {
  const breadcrumbData = sanitizeBreadcrumbPayload(data);

  Sentry.addBreadcrumb({
    message,
    category,
    level: "info",
    data: breadcrumbData,
  });
}

/**
 * Create a wallet operation transaction for performance monitoring
 */
export function startWalletTransaction(operation: string): Sentry.Transaction {
  const transaction = Sentry.startTransaction({
    op: "wallet",
    name: operation,
  });

  return transaction;
}

/**
 * Log wallet operation with structured data
 */
export function logWalletOperation(
  operation: string,
  status: "success" | "error" | "warning",
  data?: any
) {
  const logData: any = { ...data };

  // Redact sensitive data
  if (data?.walletAddress) {
    logData.walletAddress = redactAddress(data.walletAddress);
  }
  if (data?.publicKey) {
    logData.publicKey = redactAddress(data.publicKey);
  }

  console.log(`[Wallet ${status.toUpperCase()}]`, operation, logData);

  // Also add as breadcrumb for Sentry
  addWalletBreadcrumb(`${operation} - ${status}`, "wallet", logData);
}

/**
 * React hook to set Sentry user context
 */
export function useSentryUser() {
  const { user } = useAuth();

  useEffect(() => {
    setSentryUser(user);
  }, [user]);
}
