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

export function redactSensitiveValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (SENSITIVE_KEY_PATTERNS.test(key)) {
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
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeContextObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = redactSensitiveValue(key, value);
    }
  }

  return sanitized;
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
