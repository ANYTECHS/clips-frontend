/**
 * Wallet Error Tracking Utility
 * 
 * Provides error tracking and logging for wallet operations.
 * Integrates with Sentry when available, falls back to console logging.
 * 
 * This utility is designed to be easily integrated into existing wallet providers
 * without requiring extensive code changes.
 */

// Type definitions for wallet operations
export type WalletOperationType =
  | "connect_metamask"
  | "connect_phantom"
  | "connect_stellar"
  | "import_stellar_key"
  | "disconnect"
  | "switch_wallet"
  | "send_payment"
  | "fund_wallet"
  | "refresh_balance"
  | "create_wallet"
  | "remove_wallet"
  | "add_wallet"
  | "set_primary_wallet"
  | "update_wallet";

export type WalletErrorContext = {
  operation: WalletOperationType;
  walletType?: string;
  walletAddress?: string;
  network?: string;
  userId?: string;
  [key: string]: any;
};

/**
 * Redact wallet address for logging (show first 6 and last 4 characters)
 */
function redactAddress(address: string): string {
  if (!address || typeof address !== "string") return "[REDACTED]";
  if (address.length < 10) return "[REDACTED]";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
 * Sanitize context to remove PII
 */
function sanitizeContext(context: Partial<WalletErrorContext>): Partial<WalletErrorContext> {
  const sanitized: Partial<WalletErrorContext> = { ...context };

  // Redact wallet addresses
  if (sanitized.walletAddress) {
    sanitized.walletAddress = redactAddress(sanitized.walletAddress);
  }
  if (sanitized.publicKey) {
    sanitized.publicKey = redactAddress(sanitized.publicKey);
  }
  if (sanitized.address) {
    sanitized.address = redactAddress(sanitized.address);
  }

  // Redact secret keys
  if (sanitized.secretKey) {
    sanitized.secretKey = "[REDACTED]";
  }
  if (sanitized.privateKey) {
    sanitized.privateKey = "[REDACTED]";
  }
  if (sanitized.mnemonic) {
    sanitized.mnemonic = "[REDACTED]";
  }

  // Redact email
  if (sanitized.email) {
    sanitized.email = redactEmail(sanitized.email);
  }

  return sanitized;
}

/**
 * Check if Sentry is available
 */
function isSentryAvailable(): boolean {
  return typeof window !== "undefined" && (window as any).Sentry !== undefined;
}

/**
 * Capture wallet error with context
 */
export function captureWalletError(
  error: Error | unknown,
  operation: WalletOperationType,
  context?: Partial<WalletErrorContext>
): void {
  const fullContext: Partial<WalletErrorContext> = {
    operation,
    ...context,
  };

  const sanitizedContext = sanitizeContext(fullContext);

  // Log to console
  console.error(`[Wallet Error] ${operation}`, error, sanitizedContext);

  // Send to Sentry if available
  if (isSentryAvailable()) {
    try {
      const Sentry = (window as any).Sentry;
      Sentry.captureException(error, {
        tags: {
          wallet_operation: operation,
          wallet_type: context?.walletType,
          network: context?.network,
        },
        extra: sanitizedContext,
        level: "error",
      });
    } catch (sentryError) {
      console.error("Failed to send error to Sentry:", sentryError);
    }
  }
}

/**
 * Capture wallet operation success for monitoring
 */
export function captureWalletEvent(
  event: string,
  context?: Partial<WalletErrorContext>
): void {
  const sanitizedContext = sanitizeContext(context || {});

  // Log to console
  console.log(`[Wallet Event] ${event}`, sanitizedContext);

  // Send to Sentry if available
  if (isSentryAvailable()) {
    try {
      const Sentry = (window as any).Sentry;
      Sentry.captureMessage(event, {
        level: "info",
        tags: {
          wallet_event: event,
          wallet_type: context?.walletType,
          network: context?.network,
        },
        extra: sanitizedContext,
      });
    } catch (sentryError) {
      console.error("Failed to send event to Sentry:", sentryError);
    }
  }
}

/**
 * Add wallet context breadcrumb
 */
export function addWalletBreadcrumb(
  message: string,
  category: string = "wallet",
  data?: any
): void {
  const breadcrumbData: any = { ...data };

  // Redact sensitive data
  if (data?.walletAddress) {
    breadcrumbData.walletAddress = redactAddress(data.walletAddress);
  }
  if (data?.publicKey) {
    breadcrumbData.publicKey = redactAddress(data.publicKey);
  }

  // Log to console
  console.log(`[Wallet Breadcrumb] ${category}: ${message}`, breadcrumbData);

  // Add to Sentry if available
  if (isSentryAvailable()) {
    try {
      const Sentry = (window as any).Sentry;
      Sentry.addBreadcrumb({
        message,
        category,
        level: "info",
        data: breadcrumbData,
      });
    } catch (sentryError) {
      console.error("Failed to add breadcrumb to Sentry:", sentryError);
    }
  }
}

/**
 * Log wallet operation with structured data
 */
export function logWalletOperation(
  operation: WalletOperationType,
  status: "success" | "error" | "warning",
  data?: Partial<WalletErrorContext>
): void {
  const sanitizedData = sanitizeContext(data || {});

  // Log to console
  console.log(`[Wallet ${status.toUpperCase()}] ${operation}`, sanitizedData);

  // Add as breadcrumb for Sentry
  addWalletBreadcrumb(`${operation} - ${status}`, "wallet", sanitizedData);

  // If error, also capture it
  if (status === "error" && data?.error) {
    captureWalletError(data.error, operation, data);
  }
}

/**
 * Wrap an async function with error tracking
 */
export function withWalletErrorTracking<T extends (...args: any[]) => Promise<any>>(
  operation: WalletOperationType,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      addWalletBreadcrumb(`Starting ${operation}`, "wallet");
      const result = await fn(...args);
      logWalletOperation(operation, "success", { result: typeof result === "object" ? "success" : result });
      return result;
    } catch (error) {
      logWalletOperation(operation, "error", { error });
      throw error;
    }
  }) as T;
}

/**
 * Set user context for error tracking
 */
export function setWalletUserContext(user: { id: string; email?: string } | null): void {
  if (!user) {
    if (isSentryAvailable()) {
      try {
        const Sentry = (window as any).Sentry;
        Sentry.setUser(null);
      } catch (error) {
        console.error("Failed to clear user context:", error);
      }
    }
    return;
  }

  const sanitizedUser = {
    id: user.id,
    email: user.email ? redactEmail(user.email) : undefined,
  };

  console.log("[Wallet User Context]", sanitizedUser);

  if (isSentryAvailable()) {
    try {
      const Sentry = (window as any).Sentry;
      Sentry.setUser(sanitizedUser);
    } catch (error) {
      console.error("Failed to set user context:", error);
    }
  }
}

/**
 * React hook for wallet error tracking
 */
export function useWalletErrorTracking() {
  return {
    captureError: captureWalletError,
    captureEvent: captureWalletEvent,
    addBreadcrumb: addWalletBreadcrumb,
    logOperation: logWalletOperation,
    withErrorTracking: withWalletErrorTracking,
    setUserContext: setWalletUserContext,
  };
}
