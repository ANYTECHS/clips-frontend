/**
 * Sentry Error Monitoring Configuration
 * 
 * Integrates Sentry for production error tracking and monitoring.
 * Captures wallet operation errors, user context, and performance metrics.
 */

import * as Sentry from "@sentry/nextjs";
import { useAuth } from "@/components/AuthProvider";

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
 * Redact email for logging
 */
function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "[REDACTED]";
  return `${local[0]}***@${domain}`;
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
  const breadcrumbData: any = { ...data };

  // Redact sensitive data
  if (data?.walletAddress) {
    breadcrumbData.walletAddress = redactAddress(data.walletAddress);
  }
  if (data?.publicKey) {
    breadcrumbData.publicKey = redactAddress(data.publicKey);
  }

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
