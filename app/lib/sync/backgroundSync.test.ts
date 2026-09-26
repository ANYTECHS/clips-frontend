import { scheduleBackgroundSync, withSyncErrorHandling, SyncError } from "@/app/lib/sync/backgroundSync";

describe("background sync", () => {
  it("deduplicates concurrent syncs for the same resource", async () => {
    const sync = jest.fn().mockResolvedValue("fresh");

    const first = scheduleBackgroundSync("dashboard", sync);
    const second = scheduleBackgroundSync("dashboard", sync);

    await expect(Promise.all([first, second])).resolves.toEqual(["fresh", "fresh"]);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("surfaces sync errors with structured metadata", async () => {
    const sync = jest.fn().mockRejectedValue(new Error("network down"));

    await expect(scheduleBackgroundSync("earnings", sync)).rejects.toMatchObject({
      resource: "earnings",
      message: "network down",
      code: "NETWORK_ERROR",
    });
  });

  it("wraps task failures in a SyncError while preserving the fallback value", async () => {
    const fallback = { ok: true };
    const sync = jest.fn().mockRejectedValue(new Error("boom"));

    await expect(
      withSyncErrorHandling(
        "wallet",
        sync,
        { fallbackValue: fallback, onError: jest.fn() },
      ),
    ).resolves.toEqual(fallback);
  });

  it("records a sync retry after a rejection", async () => {
    const sync = jest.fn().mockRejectedValueOnce(new Error("transient"));
    const retry = jest.fn().mockResolvedValue("ok");

    const result = await withSyncErrorHandling("projects", sync, {
      retries: 1,
      onRetry: retry,
      fallbackValue: "fallback",
    });

    expect(result).toBe("ok");
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
