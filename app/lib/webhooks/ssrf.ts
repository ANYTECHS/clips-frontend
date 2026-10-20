import * as dns from "dns/promises";
import * as net from "net";

/**
 * SSRF validation utility for outbound webhook destination URLs — Issue #1251.
 */

export interface SsrValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/**
 * Checks if an IP address is a private, loopback, link-local, multicast, or reserved address.
 */
export function isRestrictedIp(ip: string): boolean {
  if (!net.isIP(ip)) return true;

  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true;

    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private: 172.16.0.0 – 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 224.0.0.0/4 (Multicast)
    if (parts[0] >= 224 && parts[0] <= 239) return true;
    // 240.0.0.0/4 (Reserved) & 255.255.255.255 (Broadcast)
    if (parts[0] >= 240) return true;

    return false;
  }

  // IPv6
  const normalized = ip.toLowerCase();
  // ::1 (Loopback) or :: (Unspecified)
  if (normalized === "::1" || normalized === "::") return true;
  // fe80::/10 (Link-local)
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  // fc00::/7 (Unique local address)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // ff00::/8 (Multicast)
  if (normalized.startsWith("ff")) return true;
  // IPv4-mapped IPv6 ::ffff:127.0.0.1
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.replace("::ffff:", "");
    if (net.isIPv4(v4)) return isRestrictedIp(v4);
  }

  return false;
}

/**
 * Validates a webhook destination URL against SSRF and protocol policies.
 */
export async function validateWebhookUrl(
  rawUrl: string,
  options: { allowLocalInDev?: boolean } = {}
): Promise<SsrValidationResult> {
  const allowLocal = options.allowLocalInDev !== undefined 
    ? options.allowLocalInDev 
    : process.env.NODE_ENV !== "production";

  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "URL is required" };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Enforce protocol: HTTPS required in production, HTTP allowed only in dev/test
  if (parsed.protocol !== "https:") {
    if (parsed.protocol === "http:") {
      if (!allowLocal) {
        return { valid: false, error: "HTTPS is required for webhook URLs in production" };
      }
    } else {
      return { valid: false, error: "Only HTTP and HTTPS protocols are allowed" };
    }
  }

  // Reject embedded credentials (http://user:pass@example.com)
  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs with embedded credentials are not allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Handle localhost exception for development
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    if (allowLocal) {
      return { valid: true, normalizedUrl: parsed.toString() };
    }
    return { valid: false, error: "Localhost and loopback addresses are not permitted" };
  }

  // If hostname is directly an IP address
  if (net.isIP(hostname)) {
    if (isRestrictedIp(hostname)) {
      if (allowLocal && (hostname === "127.0.0.1" || hostname === "::1")) {
        return { valid: true, normalizedUrl: parsed.toString() };
      }
      return { valid: false, error: "Destination IP address is restricted" };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  }

  // Resolve DNS to verify the domain does not resolve to a private/loopback IP
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, error: "Could not resolve webhook domain" };
    }

    for (const record of addresses) {
      if (isRestrictedIp(record.address)) {
        if (allowLocal && (record.address === "127.0.0.1" || record.address === "::1")) {
          continue;
        }
        return {
          valid: false,
          error: `Webhook domain resolves to a restricted IP (${record.address})`,
        };
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "DNS resolution failed";
    return { valid: false, error: `DNS resolution failed: ${message}` };
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}
