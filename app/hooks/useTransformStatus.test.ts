import { renderHook, act, waitFor } from "@testing-library/react";
import { useTransformStatus } from "./useTransformStatus";
import { useTransformStore } from "@/app/store/transformStore";
import type { TransformJob } from "@/app/store/transformStore";

jest.mock("@/app/lib/secureStorage", () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

type TransformStatusMessage = {
  progress: number;
  status: TransformJob["status"];
  previewUrl?: string | null;
  resultUrl?: string | null;
  errorMessage?: string;
};

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn(() => {
    MockEventSource.instances = MockEventSource.instances.filter(
      (instance) => instance !== this,
    );
  });

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
}

function seedJob(id: string, overrides: Partial<TransformJob> = {}) {
  const job: TransformJob = {
    id,
    sourceClipId: "clip-1",
    style: "anime",
    status: "processing",
    progress: 0,
    resultUrl: null,
    createdAt: new Date().toISOString(),
    previewUrl: null,
    ...overrides,
  };
  useTransformStore.setState({
    jobs: { [id]: job },
    activeJobId: id,
    hasHydrated: true,
  });
  return job;
}

function emitMessage(
  source: MockEventSource,
  payload: Partial<TransformStatusMessage> = {},
) {
  const data: TransformStatusMessage = {
    progress: 40,
    status: "processing",
    ...payload,
  };
  act(() => {
    source.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  });
}

describe("useTransformStatus", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockEventSource.instances = [];
    global.EventSource = MockEventSource as unknown as typeof EventSource;
    useTransformStore.setState({
      jobs: {},
      activeJobId: null,
      hasHydrated: true,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        progress: 10,
        status: "processing",
      }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("opens SSE for the job and updates transformStore on messages (happy path)", () => {
    seedJob("transform-alpha");
    renderHook(() => useTransformStatus("transform-alpha"));

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe(
      "/api/transform/transform-alpha/stream",
    );

    emitMessage(MockEventSource.instances[0], {
      progress: 72,
      previewUrl: "https://cdn.example/preview.jpg",
    });

    const job = useTransformStore.getState().jobs["transform-alpha"];
    expect(job.progress).toBe(72);
    expect(job.status).toBe("processing");
    expect(job.previewUrl).toBe("https://cdn.example/preview.jpg");
  });

  it("falls back to polling GET /api/transform/[id] after SSE errors exhaust reconnects", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    seedJob("transform-poll");

    renderHook(() => useTransformStatus("transform-poll", true, 1));

    const source = MockEventSource.instances[0];
    act(() => {
      source.onerror?.();
    });

    expect(source.close).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(global.fetch).toHaveBeenCalledWith("/api/transform/transform-poll");
  });

  it("closes SSE and stops listening when status is complete", () => {
    seedJob("transform-done");
    const { unmount } = renderHook(() => useTransformStatus("transform-done"));

    const source = MockEventSource.instances[0];
    emitMessage(source, {
      progress: 100,
      status: "complete",
      resultUrl: "https://cdn.example/result.mp4",
    });

    expect(source.close).toHaveBeenCalled();
    const job = useTransformStore.getState().jobs["transform-done"];
    expect(job.status).toBe("complete");
    expect(job.resultUrl).toBe("https://cdn.example/result.mp4");

    unmount();
  });

  it("cleans up SSE and polling interval on unmount", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    seedJob("transform-unmount");

    const { unmount } = renderHook(() =>
      useTransformStatus("transform-unmount", true, 1),
    );

    const source = MockEventSource.instances[0];
    act(() => {
      source.onerror?.();
    });

    unmount();

    expect(source.close).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("closes the previous SSE connection when jobId changes", async () => {
    const first: TransformJob = {
      id: "transform-first",
      sourceClipId: "clip-1",
      style: "anime",
      status: "processing",
      progress: 0,
      resultUrl: null,
      createdAt: new Date().toISOString(),
      previewUrl: null,
    };
    const second: TransformJob = { ...first, id: "transform-second" };
    useTransformStore.setState({
      jobs: { "transform-first": first, "transform-second": second },
      activeJobId: "transform-first",
      hasHydrated: true,
    });

    const { rerender } = renderHook(
      ({ jobId }: { jobId: string }) => useTransformStatus(jobId),
      { initialProps: { jobId: "transform-first" } },
    );

    const firstSource = MockEventSource.instances[0];
    expect(firstSource.url).toBe("/api/transform/transform-first/stream");

    rerender({ jobId: "transform-second" });

    await waitFor(() => {
      expect(firstSource.close).toHaveBeenCalled();
      expect(
        MockEventSource.instances.some((s) =>
          s.url.includes("transform-second"),
        ),
      ).toBe(true);
    });
  });

  it("does not connect until the transform store has hydrated", () => {
    useTransformStore.setState({
      jobs: {},
      activeJobId: null,
      hasHydrated: false,
    });

    renderHook(() => useTransformStatus("transform-wait"));

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("does not connect when enabled is false", () => {
    seedJob("transform-disabled");
    renderHook(() => useTransformStatus("transform-disabled", false));

    expect(MockEventSource.instances).toHaveLength(0);
  });
});
