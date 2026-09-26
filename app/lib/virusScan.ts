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
import { getCircuitBreaker } from "@/app/lib/circuitBreaker";

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

      const analysisId = result.data?.id;
      if (!analysisId) {
        throw new VirusScanError(
          "VirusTotal upload did not return an analysis ID",
          "PROVIDER_ERROR",
        );
      }

      const maxAttempts = 3;
      const baseIntervalMs = process.env.VIRUSTOTAL_POLL_INTERVAL_MS
        ? parseInt(process.env.VIRUSTOTAL_POLL_INTERVAL_MS, 10)
        : 5000;

      let isClean = true;
      let threatName: string | undefined;
      let completed = false;
      let lastAnalysisResult: unknown = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const delayMs = baseIntervalMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        if (controller.signal.aborted) {
          throw new VirusScanError("VirusTotal scan timed out", "TIMEOUT");
        }

        const pollResponse = await fetch(
          `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
          {
            headers: {
              "x-apikey": apiKey,
            },
            signal: controller.signal,
          }
        );

        if (!pollResponse.ok) {
          throw new VirusScanError(
            `VirusTotal polling API error: ${pollResponse.statusText}`,
            "PROVIDER_ERROR",
          );
        }

        const pollData = (await pollResponse.json()) as {
          data: {
            attributes?: {
              status?: string;
              stats?: {
                malicious?: number;
                suspicious?: number;
                harmless?: number;
                undetected?: number;
              };
              results?: Record<
                string,
                { category?: string; result?: string; engine_name?: string }
              >;
            };
          };
        };

        lastAnalysisResult = pollData;
        const status = pollData.data?.attributes?.status;
        const stats = pollData.data?.attributes?.stats;

        if (status === "completed") {
          completed = true;
          const maliciousCount = stats?.malicious ?? 0;
          if (maliciousCount > 0) {
            isClean = false;
            const results = pollData.data?.attributes?.results ?? {};
            const maliciousEntry = Object.values(results).find(
              (r) => r.category === "malicious" || Boolean(r.result)
            );
            threatName = maliciousEntry?.result ?? "Malware detected";
          } else {
            isClean = true;
          }
          break;
        }
      }

      clearTimeout(timeoutId);

      if (!completed) {
        throw new VirusScanError("VirusTotal scan timed out", "TIMEOUT");
      }

      return {
        isClean,
        provider: "virustotal",
        timestamp: new Date(),
        details: {
          threatName,
          rawResponse: lastAnalysisResult ?? result,
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

// ─── Degraded-mode result ─────────────────────────────────────────────────────

/**
 * Result emitted when the scan service is unavailable and
 * VIRUS_SCAN_ALLOW_ON_FAILURE=true is set.
 *
 * The file is allowed through but the result is clearly flagged as
 * unverified so callers can attach a warning flag to the job record.
 */
export interface DegradedScanResult extends ScanResult {
  degraded: true;
  degradedReason: string;
}

function isDegradedAllowed(): boolean {
  return (
    process.env.VIRUS_SCAN_ALLOW_ON_FAILURE?.toLowerCase() === "true"
  );
}

/**
 * Perform the actual provider scan. Called by scanFile after all guard
 * checks pass. Throws VirusScanError on any failure.
 */
async function doScan(buffer: Buffer): Promise<ScanResult> {
  const provider = getProvider();
  const timeout = getScanTimeout();

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
 * Scan a file buffer for malware.
 *
 * Returns a ScanResult indicating whether the file is clean.
 * If scanning is disabled, returns isClean=true.
 *
 * Graceful degradation behaviour
 * ────────────────────────────────
 * When the scan provider is unreachable or times out the circuit breaker
 * opens after `failureThreshold` consecutive failures.  Subsequent upload
 * requests are handled according to VIRUS_SCAN_ALLOW_ON_FAILURE:
 *
 *  - "true"  — upload proceeds; the returned ScanResult carries
 *              `degraded: true` and `degradedReason` so the upload route
 *              can attach a warning flag to the job record.
 *  - (unset) — upload is rejected with a VirusScanError (existing behaviour,
 *              the safe default).
 *
 * Set VIRUS_SCAN_ALLOW_ON_FAILURE=true only when you have an alternative
 * security control in place (e.g. post-processing re-scan by the AI backend).
 *
 * @param buffer File data to scan
 * @returns ScanResult (may be a DegradedScanResult when scan service is down)
 * @throws VirusScanError if scanning fails and degraded mode is not enabled
 */
export async function scanFile(buffer: Buffer): Promise<ScanResult> {
  // Quick exit if scanning is globally disabled
  if (!isEnabled()) {
    return { isClean: true, provider: "disabled", timestamp: new Date() };
  }

  // Quick exit for "disabled" provider (checked early to avoid circuit-breaker
  // overhead on paths that never reach the network).
  let provider: ScanProvider;
  try {
    provider = getProvider();
  } catch (err) {
    // CONFIG_ERROR — misconfigured provider value; fail hard regardless of
    // degraded mode because we can't know whether to trust the file.
    throw err;
  }

  if (provider === "disabled") {
    return { isClean: true, provider: "disabled", timestamp: new Date() };
  }

  const cb = getCircuitBreaker("virusScan");

  if (isDegradedAllowed()) {
    // Degraded mode: use circuit breaker with a safe fallback instead of
    // throwing so the upload pipeline can continue with a warning flag.
    return cb.execute(
      () => doScan(buffer),
      () => {
        logger.warn(
          "[VirusScan] Scan service unavailable — allowing upload in degraded mode " +
            "(VIRUS_SCAN_ALLOW_ON_FAILURE=true)"
        );
        const degraded: DegradedScanResult = {
          isClean: true,
          provider,
          timestamp: new Date(),
          degraded: true,
          degradedReason:
            cb.currentState === "OPEN"
              ? "Scan service circuit breaker is open"
              : "Scan service unavailable",
        };
        return degraded;
      }
    );
  }

  // Default (safe) mode: use executeOrThrow so any failure propagates and
  // the upload is rejected — same behaviour as before, but the circuit breaker
  // now trips after repeated failures to avoid hammering a downed scanner.
  return cb.executeOrThrow(() => doScan(buffer));
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
