/**
 * Tests for chunked bulk execution and progress (Issue #1059).
 */

import { act, renderHook } from "@testing-library/react";

import {
  chunkResultFromResponse,
  useBulkOperation,
} from "@/app/hooks/useBulkOperation";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `clip-${i}`);

describe("useBulkOperation", () => {
  it("splits the work into chunks of the configured size", async () => {
    const { result } = renderHook(() => useBulkOperation(10));
    const seen: string[][] = [];

    await act(async () => {
      await result.current.run(ids(25), async (chunk) => {
        seen.push(chunk);
        return { succeeded: chunk.length };
      });
    });

    expect(seen.map((c) => c.length)).toEqual([10, 10, 5]);
    expect(result.current.progress.percent).toBe(100);
    expect(result.current.progress.succeeded).toBe(25);
  });

  it("reports progress as it advances", async () => {
    const { result } = renderHook(() => useBulkOperation(10));
    const percents: number[] = [];

    await act(async () => {
      await result.current.run(ids(30), async (chunk) => {
        percents.push(result.current.progress.percent);
        return { succeeded: chunk.length };
      });
    });

    // Observed before each chunk: 0, then 33, then 67.
    expect(percents).toEqual([0, 33, 67]);
    expect(result.current.progress.isComplete).toBe(true);
    expect(result.current.progress.isRunning).toBe(false);
  });

  it("keeps successes when individual ids fail", async () => {
    // Bulk posting talks to external APIs that reject some clips; throwing
    // away the ones that worked would be the wrong trade.
    const { result } = renderHook(() => useBulkOperation(10));

    await act(async () => {
      await result.current.run(ids(20), async (chunk) => ({
        succeeded: chunk.length - 1,
        failures: [{ clipId: chunk[0]!, error: "Rate limited" }],
      }));
    });

    expect(result.current.progress.succeeded).toBe(18);
    expect(result.current.progress.failures).toHaveLength(2);
    expect(result.current.progress.error).toBeNull();
  });

  it("marks every id in a chunk failed when the request itself throws", async () => {
    // A transport failure gives no way to tell which ids landed, so
    // overreporting beats claiming a success we cannot see.
    const { result } = renderHook(() => useBulkOperation(10));

    await act(async () => {
      await result.current.run(ids(10), async () => {
        throw new Error("Network down");
      });
    });

    expect(result.current.progress.failures).toHaveLength(10);
    expect(result.current.progress.failures[0]!.error).toBe("Network down");
    expect(result.current.progress.succeeded).toBe(0);
  });

  it("keeps going after a failing chunk", async () => {
    const { result } = renderHook(() => useBulkOperation(10));
    let call = 0;

    await act(async () => {
      await result.current.run(ids(30), async (chunk) => {
        call += 1;
        if (call === 2) throw new Error("boom");
        return { succeeded: chunk.length };
      });
    });

    expect(result.current.progress.succeeded).toBe(20);
    expect(result.current.progress.failures).toHaveLength(10);
    expect(result.current.progress.processed).toBe(30);
  });

  it("stops after the in-flight chunk when cancelled", async () => {
    const { result } = renderHook(() => useBulkOperation(10));

    await act(async () => {
      await result.current.run(ids(50), async (chunk) => {
        result.current.cancel();
        return { succeeded: chunk.length };
      });
    });

    expect(result.current.progress.processed).toBe(10);
    expect(result.current.progress.error).toBe("Cancelled");
    expect(result.current.progress.isComplete).toBe(true);
  });

  it("completes immediately on an empty selection", async () => {
    const { result } = renderHook(() => useBulkOperation(10));
    const runner = jest.fn();

    await act(async () => {
      await result.current.run([], runner as never);
    });

    expect(runner).not.toHaveBeenCalled();
    expect(result.current.progress.isComplete).toBe(true);
    expect(result.current.progress.percent).toBe(0);
  });

  it("resets back to idle", async () => {
    const { result } = renderHook(() => useBulkOperation(10));

    await act(async () => {
      await result.current.run(ids(10), async (chunk) => ({ succeeded: chunk.length }));
    });
    act(() => result.current.reset());

    expect(result.current.progress.processed).toBe(0);
    expect(result.current.progress.isComplete).toBe(false);
  });
});

describe("chunkResultFromResponse", () => {
  const jsonResponse = (status: number, body: unknown): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as Response;

  it("reads updatedCount and per-id errors", async () => {
    const result = await chunkResultFromResponse(
      jsonResponse(200, {
        data: { updatedCount: 3, errors: [{ clipId: "clip-4", error: "Locked" }] },
      }),
      ids(4),
    );

    expect(result.succeeded).toBe(3);
    expect(result.failures).toHaveLength(1);
  });

  it("reads deletedCount for the delete endpoint", async () => {
    const result = await chunkResultFromResponse(
      jsonResponse(200, { data: { deletedCount: 2 } }),
      ids(2),
    );

    expect(result.succeeded).toBe(2);
  });

  it("turns a non-2xx into a failure for every id in the chunk", async () => {
    const result = await chunkResultFromResponse(
      jsonResponse(403, { error: "One or more clips do not belong to you" }),
      ids(3),
    );

    expect(result.succeeded).toBe(0);
    expect(result.failures).toHaveLength(3);
    expect(result.failures![0]!.error).toBe("One or more clips do not belong to you");
  });

  it("falls back to the status code when the error body is not JSON", async () => {
    const broken = {
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response;

    const result = await chunkResultFromResponse(broken, ids(1));
    expect(result.failures![0]!.error).toContain("502");
  });
});
