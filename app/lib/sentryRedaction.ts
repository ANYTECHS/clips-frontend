import type { Breadcrumb, Event } from "@sentry/types";

export function redactAddress(address: string): string {
  if (!address || typeof address !== "string") return "[REDACTED]";
  if (address.length < 10) return "[REDACTED]";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "[REDACTED]";
  return `${local[0]}***@${domain}`;
}

const SENSITIVE_KEY_PATTERNS =
  /secret|private|mnemonic|seed|password|passphrase|recovery/i;

/**
 * Wallet key fields that must never reach Sentry, in any casing or
 * snake_case form (#1218). Matched exactly in addition to the pattern above
 * so the guarantee does not depend on the pattern staying broad.
 */
const WALLET_KEY_FIELDS = new Set(["privatekey", "secretkey", "seed"]);

function isWalletKeyField(key: string): boolean {
  return WALLET_KEY_FIELDS.has(key.replace(/[_-]/g, "").toLowerCase());
}

export function redactSensitiveValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (isWalletKeyField(key) || SENSITIVE_KEY_PATTERNS.test(key)) {
    return "[REDACTED]";
  }

  if (
    (key === "wallet_address" || key === "public_key" || key === "address") &&
    typeof value === "string"
  ) {
    return redactAddress(value);
  }

  if (key === "email" && typeof value === "string") {
    return redactEmail(value);
  }

  return value;
}

export function sanitizeContextObject(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...obj };

  for (const key of Object.keys(sanitized)) {
    const value = sanitized[key];
    if (isWalletKeyField(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? sanitizeContextObject(item as Record<string, unknown>)
          : item,
      );
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeContextObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = redactSensitiveValue(key, value);
    }
  }

  return sanitized;
}

/**
 * Redacts sensitive fields (including `privateKey`, `secretKey` and `seed`)
 * from every part of a Sentry event that can carry arbitrary data: contexts,
 * extra, tags, request body and breadcrumbs.
 */
export function sanitizeSentryEvent<T extends Event>(event: T): T {
  if (event.contexts) sanitizeSentryContexts(event.contexts);
  if (event.extra) {
    event.extra = sanitizeContextObject(event.extra as Record<string, unknown>);
  }
  if (event.tags) {
    event.tags = sanitizeContextObject(
      event.tags as Record<string, unknown>,
    ) as Event["tags"];
  }
  if (event.request?.data && typeof event.request.data === "object") {
    event.request.data = sanitizeContextObject(
      event.request.data as Record<string, unknown>,
    );
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(sanitizeBreadcrumb);
  }
  return event;
}

export function sanitizeSentryContexts(contexts: Event["contexts"]): void {
  if (!contexts) return;

  for (const key of Object.keys(contexts)) {
    const ctx = contexts[key];
    if (typeof ctx === "object" && ctx !== null) {
      Object.assign(ctx, sanitizeContextObject(ctx as Record<string, unknown>));
    }
  }
}

export function sanitizeBreadcrumbData(
  data: Breadcrumb["data"] | undefined
): Breadcrumb["data"] | undefined {
  if (!data || typeof data !== "object") return data;
  return sanitizeContextObject(data as Record<string, unknown>);
}

export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    data: sanitizeBreadcrumbData(breadcrumb.data),
  };
}

export function sanitizeBreadcrumbPayload(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data) return data;
  return sanitizeContextObject(data);
}
