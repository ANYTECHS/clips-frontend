/**
 * Unit tests for batchTransformStore
 *
 * We use renderHook + act (from @testing-library/react) to drive state
 * changes, exactly as the other store tests in this project do.
 *
 * Simulated progress timers are controlled via jest.useFakeTimers() so we
 * never have to wait for real wall-clock time.
 */

import { act, renderHook } from "@testing-library/react";
import {
  useBatchTransformStore,
  selectJobs,
  selectIsQueueOpen,
  selectJobCounts,
} from "./batchTransformStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLIP_IDS = ["clip_1", "clip_2", "clip_3"];
const CLIP_TITLES: Record<string, string> = {
  clip_1: "Clip #01 - The Big Reveal",
  clip_2: "Clip #02 - Deep Dive",
  clip_3: "Clip #03 - Audience Reaction",
};
const STYLE = "Bold & Dynamic";

/** Reset store to a clean slate before every test */
function resetStore() {
  useBatchTransformStore.setState({ jobs: [], isQueueOpen: false });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("batchTransformStore", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ── Initial state ────────────────────────────────────────────────────────

  it("initialises with empty jobs and closed queue", () => {
    const state = useBatchTransformStore.getState();
    expect(state.jobs).toEqual([]);
    expect(state.isQueueOpen).toBe(false);
  });

  // ── startBatch ───────────────────────────────────────────────────────────

  it("startBatch creates one job per clipId", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    expect(result.current.jobs).toHaveLength(CLIP_IDS.length);
  });

  it("startBatch sets all jobs to queued with 0 progress", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    result.current.jobs.forEach((job) => {
      expect(job.status).toBe("queued");
      expect(job.progress).toBe(0);
    });
  });

  it("startBatch assigns the correct style to each job", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    result.current.jobs.forEach((job) => {
      expect(job.style).toBe(STYLE);
    });
  });

  it("startBatch maps clipId to the correct clipTitle", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    result.current.jobs.forEach((job) => {
      expect(job.clipTitle).toBe(CLIP_TITLES[job.clipId]);
    });
  });

  it("startBatch opens the queue panel", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    expect(result.current.isQueueOpen).toBe(true);
  });

  it("startBatch passes TransformOptions to each job", () => {
    const { result } = renderHook(() => useBatchTransformStore());
    const options = { aspectRatio: "9:16", burnSubtitles: true };

    act(() => {
      result.current.startBatch(["clip_1"], { clip_1: "Clip 1" }, STYLE, options);
    });

    expect(result.current.jobs[0].options).toEqual(options);
  });

  it("startBatch replaces a previous batch", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(["clip_1"], { clip_1: "Clip 1" }, STYLE);
    });

    act(() => {
      result.current.startBatch(["clip_2", "clip_3"], CLIP_TITLES, STYLE);
    });

    expect(result.current.jobs).toHaveLength(2);
    expect(result.current.jobs.map((j) => j.clipId)).toEqual([
      "clip_2",
      "clip_3",
    ]);
  });

  it("startBatch falls back to a generic title for unknown clipIds", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(["unknown_clip"], {}, STYLE);
    });

    expect(result.current.jobs[0].clipTitle).toBe("Clip unknown_clip");
  });

  it("each job receives a unique jobId", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    const ids = result.current.jobs.map((j) => j.jobId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  // ── updateJob ────────────────────────────────────────────────────────────

  it("updateJob patches the target job without affecting others", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    const targetId = result.current.jobs[1].jobId;

    act(() => {
      result.current.updateJob(targetId, { progress: 55, status: "processing" });
    });

    const target = result.current.jobs.find((j) => j.jobId === targetId)!;
    expect(target.progress).toBe(55);
    expect(target.status).toBe("processing");

    // Other jobs should be untouched
    result.current.jobs
      .filter((j) => j.jobId !== targetId)
      .forEach((j) => {
        expect(j.progress).toBe(0);
        expect(j.status).toBe("queued");
      });
  });

  it("updateJob is a no-op for an unknown jobId", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    act(() => {
      result.current.updateJob("does_not_exist", { progress: 99 });
    });

    result.current.jobs.forEach((j) => expect(j.progress).toBe(0));
  });

  // ── cancelJob ────────────────────────────────────────────────────────────

  it("cancelJob transitions queued job to cancelled", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    const targetId = result.current.jobs[0].jobId;

    act(() => {
      result.current.cancelJob(targetId);
    });

    const target = result.current.jobs.find((j) => j.jobId === targetId)!;
    expect(target.status).toBe("cancelled");
  });

  it("cancelJob transitions processing job to cancelled", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    const targetId = result.current.jobs[0].jobId;

    // Manually move to processing
    act(() => {
      result.current.updateJob(targetId, { status: "processing", progress: 40 });
    });

    act(() => {
      result.current.cancelJob(targetId);
    });

    expect(result.current.jobs.find((j) => j.jobId === targetId)!.status).toBe(
      "cancelled"
    );
  });

  it("cancelJob does not affect completed jobs", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(["clip_1"], CLIP_TITLES, STYLE);
    });

    const targetId = result.current.jobs[0].jobId;

    act(() => {
      result.current.updateJob(targetId, { status: "complete", progress: 100 });
    });

    act(() => {
      result.current.cancelJob(targetId);
    });

    // complete is a terminal state — should not revert to cancelled
    expect(result.current.jobs[0].status).toBe("complete");
  });

  it("cancelJob only affects the targeted job", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    const targetId = result.current.jobs[0].jobId;

    act(() => {
      result.current.cancelJob(targetId);
    });

    result.current.jobs
      .filter((j) => j.jobId !== targetId)
      .forEach((j) => {
        expect(j.status).toBe("queued");
      });
  });

  // ── cancelAll ────────────────────────────────────────────────────────────

  it("cancelAll cancels every active job", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    act(() => {
      result.current.cancelAll();
    });

    result.current.jobs.forEach((j) => {
      expect(j.status).toBe("cancelled");
    });
  });

  it("cancelAll preserves completed and errored jobs", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    // Mark first job as complete, second as error
    act(() => {
      result.current.updateJob(result.current.jobs[0].jobId, {
        status: "complete",
        progress: 100,
      });
      result.current.updateJob(result.current.jobs[1].jobId, {
        status: "error",
        error: "Unexpected failure",
      });
    });

    act(() => {
      result.current.cancelAll();
    });

    expect(result.current.jobs[0].status).toBe("complete");
    expect(result.current.jobs[1].status).toBe("error");
    expect(result.current.jobs[2].status).toBe("cancelled");
  });

  // ── clearFinished ────────────────────────────────────────────────────────

  it("clearFinished removes complete, error, and cancelled jobs", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    act(() => {
      result.current.updateJob(result.current.jobs[0].jobId, { status: "complete", progress: 100 });
      result.current.updateJob(result.current.jobs[1].jobId, { status: "error" });
      result.current.updateJob(result.current.jobs[2].jobId, { status: "cancelled" });
    });

    act(() => {
      result.current.clearFinished();
    });

    expect(result.current.jobs).toHaveLength(0);
  });

  it("clearFinished keeps active (queued/processing) jobs", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(CLIP_IDS, CLIP_TITLES, STYLE);
    });

    const processingId = result.current.jobs[0].jobId;
    const queuedId = result.current.jobs[1].jobId;

    act(() => {
      result.current.updateJob(processingId, { status: "processing", progress: 50 });
      result.current.updateJob(result.current.jobs[2].jobId, { status: "complete", progress: 100 });
    });

    act(() => {
      result.current.clearFinished();
    });

    expect(result.current.jobs).toHaveLength(2);
    expect(result.current.jobs.map((j) => j.jobId)).toContain(processingId);
    expect(result.current.jobs.map((j) => j.jobId)).toContain(queuedId);
  });

  // ── toggleQueue ──────────────────────────────────────────────────────────

  it("toggleQueue flips isQueueOpen", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    expect(result.current.isQueueOpen).toBe(false);

    act(() => {
      result.current.toggleQueue();
    });
    expect(result.current.isQueueOpen).toBe(true);

    act(() => {
      result.current.toggleQueue();
    });
    expect(result.current.isQueueOpen).toBe(false);
  });

  it("toggleQueue accepts an explicit boolean to force state", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.toggleQueue(true);
    });
    expect(result.current.isQueueOpen).toBe(true);

    act(() => {
      result.current.toggleQueue(true);
    });
    expect(result.current.isQueueOpen).toBe(true); // no flip

    act(() => {
      result.current.toggleQueue(false);
    });
    expect(result.current.isQueueOpen).toBe(false);
  });

  // ── selectJobCounts ──────────────────────────────────────────────────────

  it("selectJobCounts returns zeroes on empty store", () => {
    const state = useBatchTransformStore.getState();
    const counts = selectJobCounts(state);
    expect(counts).toMatchObject({
      total: 0,
      complete: 0,
      processing: 0,
      queued: 0,
      cancelled: 0,
      error: 0,
      active: 0,
      isDone: false,
    });
  });

  it("selectJobCounts reflects current status distribution", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(
        ["c1", "c2", "c3", "c4", "c5"],
        { c1: "C1", c2: "C2", c3: "C3", c4: "C4", c5: "C5" },
        STYLE
      );
    });

    const [j0, j1, j2, j3, j4] = result.current.jobs;

    act(() => {
      result.current.updateJob(j0.jobId, { status: "complete", progress: 100 });
      result.current.updateJob(j1.jobId, { status: "complete", progress: 100 });
      result.current.updateJob(j2.jobId, { status: "processing", progress: 40 });
      result.current.updateJob(j3.jobId, { status: "cancelled" });
      result.current.updateJob(j4.jobId, { status: "error" });
    });

    const counts = selectJobCounts(useBatchTransformStore.getState());
    expect(counts.total).toBe(5);
    expect(counts.complete).toBe(2);
    expect(counts.processing).toBe(1);
    expect(counts.queued).toBe(0);
    expect(counts.cancelled).toBe(1);
    expect(counts.error).toBe(1);
    expect(counts.active).toBe(1); // processing only
    expect(counts.isDone).toBe(false); // still one processing
  });

  it("selectJobCounts.isDone is true when no active jobs remain", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(["c1", "c2"], { c1: "C1", c2: "C2" }, STYLE);
    });

    act(() => {
      result.current.updateJob(result.current.jobs[0].jobId, {
        status: "complete",
        progress: 100,
      });
      result.current.updateJob(result.current.jobs[1].jobId, {
        status: "cancelled",
      });
    });

    const counts = selectJobCounts(useBatchTransformStore.getState());
    expect(counts.isDone).toBe(true);
  });

  // ── selectJobs / selectIsQueueOpen ───────────────────────────────────────

  it("selectJobs returns the jobs array", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.startBatch(["c1"], { c1: "C1" }, STYLE);
    });

    const state = useBatchTransformStore.getState();
    expect(selectJobs(state)).toHaveLength(1);
    expect(selectJobs(state)[0].clipId).toBe("c1");
  });

  it("selectIsQueueOpen returns isQueueOpen", () => {
    const { result } = renderHook(() => useBatchTransformStore());

    act(() => {
      result.current.toggleQueue(true);
    });

    expect(selectIsQueueOpen(useBatchTransformStore.getState())).toBe(true);
  });
});
