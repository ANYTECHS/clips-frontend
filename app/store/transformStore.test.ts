jest.mock("@/app/lib/secureStorage", () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import { secureStorage } from "@/app/lib/secureStorage";
import {
  selectActiveJob,
  selectAllJobs,
  selectJobById,
  selectTransformHasHydrated,
  useTransformStore,
  type TransformJob,
} from "./transformStore";

function job(id: string, createdAt = "2026-01-01T00:00:00.000Z"): TransformJob {
  return {
    id,
    sourceClipId: `clip-${id}`,
    style: "cinematic",
    status: "queued",
    progress: 0,
    resultUrl: null,
    createdAt,
    previewUrl: null,
  };
}

describe("transformStore", () => {
  beforeEach(() => {
    useTransformStore.setState({ jobs: {}, activeJobId: null, hasHydrated: false });
    jest.clearAllMocks();
  });

  it("starts empty and unhydrated", () => {
    const state = useTransformStore.getState();
    expect(state.jobs).toEqual({});
    expect(state.activeJobId).toBeNull();
    expect(selectTransformHasHydrated(state)).toBe(false);
    expect(selectAllJobs(state)).toEqual([]);
    expect(selectActiveJob(state)).toBeUndefined();
  });

  it("adds jobs and selects one by id", () => {
    useTransformStore.getState().addJob(job("one"));
    expect(selectJobById("one")(useTransformStore.getState())).toMatchObject({ id: "one" });
    expect(selectJobById("missing")(useTransformStore.getState())).toBeUndefined();
  });

  it("applies partial transform updates without creating missing jobs", () => {
    useTransformStore.getState().addJob(job("one"));
    useTransformStore.getState().updateJob("one", {
      status: "processing",
      progress: 64,
      previewUrl: "/preview.jpg",
    });
    useTransformStore.getState().updateJob("missing", { progress: 99 });

    expect(useTransformStore.getState().jobs.one).toMatchObject({
      status: "processing",
      progress: 64,
      previewUrl: "/preview.jpg",
    });
    expect(useTransformStore.getState().jobs.missing).toBeUndefined();
  });

  it("tracks completion and errors, and removes reset jobs", () => {
    useTransformStore.getState().addJob(job("complete"));
    useTransformStore.getState().addJob(job("failed"));
    useTransformStore.getState().updateJob("complete", {
      status: "complete",
      progress: 100,
      resultUrl: "/result.mp4",
    });
    useTransformStore.getState().updateJob("failed", {
      status: "error",
      errorMessage: "backend unavailable",
    });
    useTransformStore.getState().setActiveJobId("complete");

    expect(selectActiveJob(useTransformStore.getState())?.resultUrl).toBe("/result.mp4");
    expect(useTransformStore.getState().jobs.failed.errorMessage).toBe("backend unavailable");
    useTransformStore.getState().removeJob("complete");
    useTransformStore.getState().setActiveJobId(null);
    expect(useTransformStore.getState().jobs.complete).toBeUndefined();
    expect(useTransformStore.getState().activeJobId).toBeNull();
  });

  it("removes unknown jobs without affecting the remaining jobs", () => {
    useTransformStore.getState().addJob(job("keep"));
    useTransformStore.getState().removeJob("missing");
    expect(Object.keys(useTransformStore.getState().jobs)).toEqual(["keep"]);
  });

  it("rehydrates persisted transform jobs and marks hydration complete", async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        state: { jobs: { restored: job("restored") }, activeJobId: "restored" },
        version: 0,
      }),
    );

    await useTransformStore.persist.rehydrate();
    expect(useTransformStore.getState().jobs.restored).toMatchObject({ id: "restored" });
    expect(useTransformStore.getState().activeJobId).toBe("restored");
    expect(selectTransformHasHydrated(useTransformStore.getState())).toBe(true);
  });

  it("does not mark hydration complete when secure storage rejects", async () => {
    (secureStorage.getItem as jest.Mock).mockRejectedValue(new Error("decrypt failed"));
    useTransformStore.setState({ hasHydrated: false });

    await useTransformStore.persist.rehydrate();
    expect(selectTransformHasHydrated(useTransformStore.getState())).toBe(false);
  });

  it("supports multiple concurrent transform jobs and sorts them newest-first", async () => {
    await Promise.all([
      Promise.resolve().then(() => useTransformStore.getState().addJob(job("old", "2026-01-01T00:00:00.000Z"))),
      Promise.resolve().then(() => useTransformStore.getState().addJob(job("new", "2026-02-01T00:00:00.000Z"))),
    ]);
    expect(selectAllJobs(useTransformStore.getState()).map((entry) => entry.id)).toEqual(["new", "old"]);
  });
});
