/**
 * virusScan.ts — Virus scanning integration for uploaded files
 *
 * Supports multiple scanning providers:
 * - "clamav": ClamAV via HTTP API (local sidecar container or remote)
 * - "virustotal": VirusTotal API
 * - "cloudmersive": Cloudmersive Content Moderation API
 * - "disabled": No scanning (for development only)
 *
 * Environment variables:
 *   VIRUS_SCAN_PROVIDER          — "clamav" | "virustotal" | "cloudmersive" | "disabled" (default: "clamav")
 *   VIRUS_SCAN_TIMEOUT           — Timeout in milliseconds (default: 30000)
 *   CLAMAV_API_URL               — ClamAV HTTP endpoint (e.g., http://localhost:8080)
 *   VIRUSTOTAL_API_KEY           — VirusTotal API key
 *   CLOUDMERSIVE_API_KEY         — Cloudmersive API key
 *   VIRUS_SCAN_ENABLED           — "true" | "false" (default: "true" for prod, "false" for dev)
 */

import { logger } from "@/app/lib/logger";
import { VIRUS_SCAN_DEFAULT_TIMEOUT_MS } from "@/app/lib/constants";

export type ScanProvider = "clamav" | "virustotal" | "cloudmersive" | "disabled";

export interface ScanResult {
  isClean: boolean;
  provider: ScanProvider;
  timestamp: Date;
  details?: {
    threatName?: string;
    scanTime?: number;
    rawResponse?: unknown;
  };
}

export class VirusScanError extends Error {
  constructor(
    message: string,
    public code: "SCAN_FAILED" | "TIMEOUT" | "CONFIG_ERROR" | "PROVIDER_ERROR",
  ) {
    super(message);
    this.name = "VirusScanError";
  }
}

// ─── Configuration ────────────────────────────────────────────────────────────

function getProvider(): ScanProvider {
  const provider = (process.env.VIRUS_SCAN_PROVIDER ?? "clamav").toLowerCase() as ScanProvider;
  const validProviders: ScanProvider[] = ["clamav", "virustotal", "cloudmersive", "disabled"];
  if (!validProviders.includes(provider)) {
    throw new VirusScanError(
      `Invalid VIRUS_SCAN_PROVIDER: ${provider}. Must be one of: ${validProviders.join(", ")}`,
      "CONFIG_ERROR",
    );
  }
  return provider;
}

function getScanTimeout(): number {
  const timeout = process.env.VIRUS_SCAN_TIMEOUT
    ? parseInt(process.env.VIRUS_SCAN_TIMEOUT, 10)
    : VIRUS_SCAN_DEFAULT_TIMEOUT_MS; // 30 seconds default
  if (isNaN(timeout) || timeout <= 0) {
    throw new VirusScanError("VIRUS_SCAN_TIMEOUT must be a positive integer", "CONFIG_ERROR");
  }
  return timeout;
}

function isEnabled(): boolean {
  // Check if scanning is explicitly enabled/disabled
  const enabled = process.env.VIRUS_SCAN_ENABLED;
  if (enabled !== undefined) {
    return enabled.toLowerCase() === "true";
  }
  // Default: enabled in production, disabled in development
  return process.env.NODE_ENV === "production";
}

// ─── ClamAV Scanner ───────────────────────────────────────────────────────────

async function scanWithClamAV(buffer: Buffer, timeout: number): Promise<ScanResult> {
  const apiUrl = process.env.CLAMAV_API_URL;
  if (!apiUrl) {
    throw new VirusScanError(
      "CLAMAV_API_URL environment variable is required",
      "CONFIG_ERROR",
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/scan`, {
        method: "POST",
        body: buffer,
        headers: {
          "Content-Type": "application/octet-stream",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new VirusScanError(
          `ClamAV API error: ${response.statusText}`,
          "PROVIDER_ERROR",
        );
      }

      const result = (await response.json()) as {
        clean: boolean;
        threat?: string;
        scanTime?: number;
      };

      return {
        isClean: result.clean,
        provider: "clamav",
        timestamp: new Date(),
        details: {
          threatName: result.threat,
          scanTime: result.scanTime,
        },
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new VirusScanError("ClamAV scan timed out", "TIMEOUT");
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof VirusScanError) throw err;
    throw new VirusScanError(
      `ClamAV scan failed: ${err instanceof Error ? err.message : String(err)}`,
      "SCAN_FAILED",
    );
  }
}

// ─── VirusTotal Scanner ────────────────────────────────────────────────────────

async function scanWithVirusTotal(buffer: Buffer, timeout: number): Promise<ScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    throw new VirusScanError(
      "VIRUSTOTAL_API_KEY environment variable is required",
      "CONFIG_ERROR",
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // VirusTotal requires file uploads via multipart/form-data
      const formData = new FormData();
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      formData.append("file", blob, "upload.bin");

      const response = await fetch("https://www.virustotal.com/api/v3/files", {
        method: "POST",
        headers: {
          "x-apikey": apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new VirusScanError(
          `VirusTotal API error: ${response.statusText}`,
          "PROVIDER_ERROR",
        );
      }

      const result = (await response.json()) as {
        data: {
          id: string;
          attributes?: {
            names?: string[];
          };
        };
      };

      // VirusTotal analysis is async; we'd need to poll for results
      // For now, assume clean (in production, implement polling or use webhook)
      return {
        isClean: true, // Placeholder: implement async polling
        provider: "virustotal",
        timestamp: new Date(),
        details: {
          rawResponse: result,
        },
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new VirusScanError("VirusTotal scan timed out", "TIMEOUT");
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof VirusScanError) throw err;
    throw new VirusScanError(
      `VirusTotal scan failed: ${err instanceof Error ? err.message : String(err)}`,
      "SCAN_FAILED",
    );
  }
}

// ─── Cloudmersive Scanner ─────────────────────────────────────────────────────

async function scanWithCloudmersive(buffer: Buffer, timeout: number): Promise<ScanResult> {
  const apiKey = process.env.CLOUDMERSIVE_API_KEY;
  if (!apiKey) {
    throw new VirusScanError(
      "CLOUDMERSIVE_API_KEY environment variable is required",
      "CONFIG_ERROR",
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const formData = new FormData();
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      formData.append("inputFile", blob, "upload.bin");

      const response = await fetch("https://api.cloudmersive.com/virus/scan/file", {
        method: "POST",
        headers: {
          "Apikey": apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new VirusScanError(
          `Cloudmersive API error: ${response.statusText}`,
          "PROVIDER_ERROR",
        );
      }

      const result = (await response.json()) as {
        CleanResult: boolean;
        FoundViruses?: Array<{
          VirusName: string;
        }>;
      };

      return {
        isClean: result.CleanResult,
        provider: "cloudmersive",
        timestamp: new Date(),
        details: {
          threatName: result.FoundViruses?.[0]?.VirusName,
        },
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new VirusScanError("Cloudmersive scan timed out", "TIMEOUT");
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof VirusScanError) throw err;
    throw new VirusScanError(
      `Cloudmersive scan failed: ${err instanceof Error ? err.message : String(err)}`,
      "SCAN_FAILED",
    );
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Scan a file buffer for malware.
 *
 * Returns a ScanResult indicating whether the file is clean.
 * If scanning is disabled, returns isClean=true.
 * If the scan times out or fails, throws a VirusScanError.
 *
 * @param buffer File data to scan
 * @returns ScanResult indicating if file is clean
 * @throws VirusScanError if scanning fails, times out, or is misconfigured
 */
export async function scanFile(buffer: Buffer): Promise<ScanResult> {
  // Quick exit if scanning is disabled
  if (!isEnabled()) {
    return {
      isClean: true,
      provider: "disabled",
      timestamp: new Date(),
    };
  }

  const provider = getProvider();
  const timeout = getScanTimeout();

  // Additional quick exit for "disabled" provider
  if (provider === "disabled") {
    return {
      isClean: true,
      provider: "disabled",
      timestamp: new Date(),
    };
  }

  logger.info(`[VirusScan] Scanning with ${provider} (timeout: ${timeout}ms)`);

  switch (provider) {
    case "clamav":
      return scanWithClamAV(buffer, timeout);
    case "virustotal":
      return scanWithVirusTotal(buffer, timeout);
    case "cloudmersive":
      return scanWithCloudmersive(buffer, timeout);
    default:
      throw new VirusScanError(`Unsupported scan provider: ${provider}`, "CONFIG_ERROR");
  }
}

/**
 * Get information about the current scanning configuration.
 */
export function getScanConfig() {
  return {
    provider: getProvider(),
    enabled: isEnabled(),
    timeout: getScanTimeout(),
  };
}
