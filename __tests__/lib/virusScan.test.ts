/**
 * @jest-environment node
 */
import { scanFile, VirusScanError } from "@/app/lib/virusScan";

describe("virusScan - VirusTotal Provider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      VIRUS_SCAN_ENABLED: "true",
      VIRUS_SCAN_PROVIDER: "virustotal",
      VIRUSTOTAL_API_KEY: "test-vt-key",
      VIRUS_SCAN_TIMEOUT: "30000",
      VIRUSTOTAL_POLL_INTERVAL_MS: "1",
    };
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("throws CONFIG_ERROR if VIRUSTOTAL_API_KEY is missing", async () => {
    delete process.env.VIRUSTOTAL_API_KEY;
    const buffer = Buffer.from("dummy video content");
    await expect(scanFile(buffer)).rejects.toThrow(
      "VIRUSTOTAL_API_KEY environment variable is required"
    );
  });

  it("returns isClean: true when VirusTotal scan completes with zero malicious detections", async () => {
    const mockFetch = global.fetch as jest.Mock;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          id: "analysis-12345",
          type: "analysis",
        },
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            status: "completed",
            stats: {
              malicious: 0,
              harmless: 65,
              suspicious: 0,
              undetected: 5,
            },
            results: {},
          },
        },
      }),
    });

    const buffer = Buffer.from("clean file data");
    const result = await scanFile(buffer);

    expect(result.isClean).toBe(true);
    expect(result.provider).toBe("virustotal");
    expect(result.details?.threatName).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe("https://www.virustotal.com/api/v3/files");
    expect(mockFetch.mock.calls[1][0]).toBe(
      "https://www.virustotal.com/api/v3/analyses/analysis-12345"
    );
  });

  it("returns isClean: false with threatName when VirusTotal detects malicious content", async () => {
    const mockFetch = global.fetch as jest.Mock;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          id: "analysis-infected-6789",
          type: "analysis",
        },
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            status: "completed",
            stats: {
              malicious: 3,
              harmless: 50,
              suspicious: 1,
              undetected: 10,
            },
            results: {
              EngineA: { category: "malicious", result: "Eicar-Test-Signature" },
              EngineB: { category: "malicious", result: "Trojan.Generic" },
            },
          },
        },
      }),
    });

    const buffer = Buffer.from("infected file data");
    const result = await scanFile(buffer);

    expect(result.isClean).toBe(false);
    expect(result.provider).toBe("virustotal");
    expect(result.details?.threatName).toBe("Eicar-Test-Signature");
  });

  it("polls until completed status and succeeds on subsequent attempt", async () => {
    const mockFetch = global.fetch as jest.Mock;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { id: "analysis-multi-attempt", type: "analysis" },
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            status: "in-progress",
            stats: { malicious: 0 },
          },
        },
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            status: "completed",
            stats: { malicious: 0 },
          },
        },
      }),
    });

    const buffer = Buffer.from("some data");
    const result = await scanFile(buffer);

    expect(result.isClean).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws VirusScanError with TIMEOUT when max polling attempts are reached without completion", async () => {
    const mockFetch = global.fetch as jest.Mock;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { id: "analysis-timeout-test", type: "analysis" },
      }),
    });

    const inProgressResp = {
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            status: "in-progress",
            stats: { malicious: 0 },
          },
        },
      }),
    };

    mockFetch.mockResolvedValueOnce(inProgressResp);
    mockFetch.mockResolvedValueOnce(inProgressResp);
    mockFetch.mockResolvedValueOnce(inProgressResp);

    const buffer = Buffer.from("slow file data");
    await expect(scanFile(buffer)).rejects.toThrow("VirusTotal scan timed out");
  });
});
