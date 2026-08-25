import { renderHook, act, waitFor } from "@testing-library/react";
import { useProcessingStatus } from "./useProcessingStatus";
import {
  useProcessStore,
  defaultProcessState,
} from "@/app/store/processStore";

jest.mock("@/app/lib/secureStorage", () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

type JobStatusMessage = {
  progress: number;
  status: "idle" | "processing" | "complete" | "error";
  momentsFound: number;
  estimatedSecondsRemaining: number | null;
};

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn(() => {
    MockEventSource.instances = MockEventSource.instances.filter(
      (instance) => instance !== this
    );
  });

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
}

function emitMessage(
  source: MockEventSource,
  payload: Partial<JobStatusMessage> = {}
) {
  const data: JobStatusMessage = {
    progress: 40,
    status: "processing",
    momentsFound: 1,
    estimatedSecondsRemaining: 90,
    ...payload,
  };
  act(() => {
    source.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  });
}

describe("useProcessingStatus", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockEventSource.instances = [];
    global.EventSource =
      MockEventSource as unknown as typeof EventSource;
    useProcessStore.setState({ ...defaultProcessState, hasHydrated: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        progress: 10,
        status: "processing",
        momentsFound: 0,
        estimatedSecondsRemaining: 60,
      }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("opens SSE for the job and updates the store when messages arrive", () => {
    renderHook(() => useProcessingStatus("job-alpha"));

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe(
      "/api/jobs/job-alpha/stream"
    );

    emitMessage(MockEventSource.instances[0], {
      progress: 72,
      momentsFound: 4,
    });

    const state = useProcessStore.getState();
    expect(state.progress).toBe(72);
    expect(state.momentsFound).toBe(4);
    expect(state.status).toBe("processing");
  });

  it("falls back to polling after SSE errors exhaust reconnect attempts", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    renderHook(() => useProcessingStatus("job-poll", true, 1));

    const source = MockEventSource.instances[0];
    act(() => {
      source.onerror?.();
    });

    expect(source.close).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
  });

  it("closes SSE and sets completedAt when status is complete", () => {
    const { unmount } = renderHook(() => useProcessingStatus("job-done"));

    const source = MockEventSource.instances[0];
    emitMessage(source, { progress: 100, status: "complete" });

    expect(source.close).toHaveBeenCalled();
    expect(useProcessStore.getState().status).toBe("complete");
    expect(useProcessStore.getState().completedAt).not.toBeNull();

    unmount();
  });

  it("closes SSE and sets store status to error when status is error", () => {
    renderHook(() => useProcessingStatus("job-fail"));

    const source = MockEventSource.instances[0];
    emitMessage(source, { status: "error", progress: 0 });

    expect(source.close).toHaveBeenCalled();
    expect(useProcessStore.getState().status).toBe("error");
  });

  it("clears the polling interval when unmounted during polling fallback", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    const { unmount } = renderHook(() =>
      useProcessingStatus("job-unmount", true, 1)
    );

    act(() => {
      MockEventSource.instances[0].onerror?.();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("closes the previous SSE connection when jobId changes", async () => {
    const { rerender } = renderHook(
      ({ jobId }: { jobId: string }) => useProcessingStatus(jobId),
      { initialProps: { jobId: "job-first" } }
    );

    const firstSource = MockEventSource.instances[0];
    expect(firstSource.url).toBe("/api/jobs/job-first/stream");

    rerender({ jobId: "job-second" });

    await waitFor(() => {
      expect(firstSource.close).toHaveBeenCalled();
      expect(MockEventSource.instances.some((s) => s.url.includes("job-second"))).toBe(
        true
      );
    });
  });

  it("does not connect until the process store has hydrated", () => {
    useProcessStore.setState({ ...defaultProcessState, hasHydrated: false });

    renderHook(() => useProcessingStatus("job-wait"));

    expect(MockEventSource.instances).toHaveLength(0);
  });
});
