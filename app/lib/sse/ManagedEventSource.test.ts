import {
  ManagedEventSource,
  ConnectionPoolExhaustedError,
  DEFAULT_MAX_CONNECTIONS,
  closeAllConnections,
  getMaxConnections,
  openConnectionCount,
  openManagedEventSource,
  setMaxConnections,
} from "./ManagedEventSource";

/** Minimal EventSource stand-in that lets tests drive messages and errors. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];

  url: string;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Set<EventListener>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data } as unknown as Event);
    }
  }

  fail() {
    this.onerror?.();
  }

  open() {
    this.onopen?.();
  }

  static reset() {
    FakeEventSource.instances = [];
  }

  static get latest() {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1];
  }
}

const factory = (url: string) => new FakeEventSource(url) as unknown as EventSource;

/** No jitter, so backoff delays are exact and assertable. */
const noJitter = () => 0;

function create(overrides: Partial<Parameters<typeof openManagedEventSource>[0]> = {}) {
  return new ManagedEventSource({
    url: "/api/stream",
    eventSourceFactory: factory,
    random: noJitter,
    ...overrides,
  });
}

describe("ManagedEventSource", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    FakeEventSource.reset();
    closeAllConnections();
    setMaxConnections(DEFAULT_MAX_CONNECTIONS);
  });

  afterEach(() => {
    closeAllConnections();
    jest.useRealTimers();
  });

  describe("connection lifecycle", () => {
    it("opens a connection to the given url", () => {
      create();
      expect(FakeEventSource.instances).toHaveLength(1);
      expect(FakeEventSource.latest.url).toBe("/api/stream");
    });

    it("delivers named events to their listener", () => {
      const stats = jest.fn();
      create({ listeners: { stats } });

      FakeEventSource.latest.emit("stats", '{"ok":true}');

      expect(stats).toHaveBeenCalledWith('{"ok":true}', expect.anything());
    });

    it("reports open events", () => {
      const onOpen = jest.fn();
      create({ onOpen });

      FakeEventSource.latest.open();

      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("closes the underlying socket on close()", () => {
      const connection = create();
      const socket = FakeEventSource.latest;

      connection.close();

      expect(socket.closed).toBe(true);
      expect(connection.isClosed).toBe(true);
    });

    it("is safe to close more than once", () => {
      const connection = create();
      connection.close();
      expect(() => connection.close()).not.toThrow();
      expect(openConnectionCount()).toBe(0);
    });

    it("stops delivering events after close", () => {
      const stats = jest.fn();
      const connection = create({ listeners: { stats } });
      const socket = FakeEventSource.latest;

      connection.close();
      socket.emit("stats", "{}");

      expect(stats).not.toHaveBeenCalled();
    });

    it("cancels a pending reconnect when closed mid-backoff", () => {
      const connection = create();
      FakeEventSource.latest.fail();
      expect(FakeEventSource.instances).toHaveLength(1);

      connection.close();
      jest.advanceTimersByTime(60_000);

      // No reconnect was attempted after close.
      expect(FakeEventSource.instances).toHaveLength(1);
    });
  });

  describe("error handling and reconnection", () => {
    it("closes the socket on error so the native retry never starts", () => {
      create();
      const socket = FakeEventSource.latest;

      socket.fail();

      expect(socket.closed).toBe(true);
    });

    it("reconnects after an exponentially growing delay", () => {
      create({ initialRetryDelayMs: 1_000, maxRetries: 5 });

      FakeEventSource.latest.fail();
      jest.advanceTimersByTime(999);
      expect(FakeEventSource.instances).toHaveLength(1);
      jest.advanceTimersByTime(1);
      expect(FakeEventSource.instances).toHaveLength(2);

      FakeEventSource.latest.fail();
      jest.advanceTimersByTime(1_999);
      expect(FakeEventSource.instances).toHaveLength(2);
      jest.advanceTimersByTime(1);
      expect(FakeEventSource.instances).toHaveLength(3);

      FakeEventSource.latest.fail();
      jest.advanceTimersByTime(4_000);
      expect(FakeEventSource.instances).toHaveLength(4);
    });

    it("caps the backoff delay", () => {
      create({ initialRetryDelayMs: 1_000, maxRetryDelayMs: 3_000, maxRetries: 10 });

      for (let i = 0; i < 4; i += 1) {
        FakeEventSource.latest.fail();
        jest.advanceTimersByTime(3_000);
      }

      expect(FakeEventSource.instances).toHaveLength(5);
    });

    it("applies jitter below the nominal delay", () => {
      // random() === 1 would subtract the full 25%.
      create({ initialRetryDelayMs: 1_000, random: () => 0.999, maxRetries: 3 });

      FakeEventSource.latest.fail();
      jest.advanceTimersByTime(760);

      expect(FakeEventSource.instances).toHaveLength(2);
    });

    it("gives up after maxRetries and reports it once", () => {
      const onGiveUp = jest.fn();
      const connection = create({ initialRetryDelayMs: 10, maxRetries: 2, onGiveUp });

      FakeEventSource.latest.fail();
      jest.advanceTimersByTime(10);
      FakeEventSource.latest.fail();
      jest.advanceTimersByTime(20);
      expect(FakeEventSource.instances).toHaveLength(3);

      FakeEventSource.latest.fail();

      expect(onGiveUp).toHaveBeenCalledTimes(1);
      expect(connection.isClosed).toBe(true);

      jest.advanceTimersByTime(60_000);
      expect(FakeEventSource.instances).toHaveLength(3);
    });

    it("reports each failure with its attempt number and whether it will retry", () => {
      const onError = jest.fn();
      create({ initialRetryDelayMs: 10, maxRetries: 1, onError });

      FakeEventSource.latest.fail();
      expect(onError).toHaveBeenLastCalledWith(1, true);

      jest.advanceTimersByTime(10);
      FakeEventSource.latest.fail();
      expect(onError).toHaveBeenLastCalledWith(2, false);
    });

    it("resets the backoff ladder once a message arrives", () => {
      const connection = create({ initialRetryDelayMs: 1_000, maxRetries: 5, listeners: { message: jest.fn() } });

      FakeEventSource.latest.fail();
      jest.advanceTimersByTime(1_000);
      FakeEventSource.latest.fail();
      jest.advanceTimersByTime(2_000);
      expect(connection.retryCount).toBe(2);

      // A healthy frame means the next blip starts from the bottom again.
      FakeEventSource.latest.emit("message", "{}");
      expect(connection.retryCount).toBe(0);

      const before = FakeEventSource.instances.length;
      FakeEventSource.latest.fail();
      jest.advanceTimersByTime(1_000);
      expect(FakeEventSource.instances).toHaveLength(before + 1);
    });
  });

  describe("connection pool limits", () => {
    it("defaults to a limit below the browser's per-origin cap", () => {
      expect(getMaxConnections()).toBe(DEFAULT_MAX_CONNECTIONS);
      expect(DEFAULT_MAX_CONNECTIONS).toBeLessThan(6);
    });

    it("tracks open connections", () => {
      expect(openConnectionCount()).toBe(0);
      const a = create();
      const b = create();
      expect(openConnectionCount()).toBe(2);

      a.close();
      expect(openConnectionCount()).toBe(1);
      b.close();
      expect(openConnectionCount()).toBe(0);
    });

    it("refuses to open more connections than the limit", () => {
      setMaxConnections(2);
      create();
      create();

      expect(() => create()).toThrow(ConnectionPoolExhaustedError);
      expect(FakeEventSource.instances).toHaveLength(2);
    });

    it("frees a slot when a connection is closed", () => {
      setMaxConnections(1);
      const first = create();
      expect(() => create()).toThrow(ConnectionPoolExhaustedError);

      first.close();
      expect(() => create()).not.toThrow();
    });

    it("frees a slot when a connection gives up on its own", () => {
      setMaxConnections(1);
      create({ initialRetryDelayMs: 10, maxRetries: 0 });

      FakeEventSource.latest.fail();

      expect(openConnectionCount()).toBe(0);
      expect(() => create()).not.toThrow();
    });

    it("rejects a nonsensical limit", () => {
      expect(() => setMaxConnections(0)).toThrow();
    });
  });

  describe("openManagedEventSource", () => {
    it("returns null when EventSource is unavailable", () => {
      const original = globalThis.EventSource;
      // @ts-expect-error deliberately removing the global for this test
      delete globalThis.EventSource;

      expect(openManagedEventSource({ url: "/api/stream" })).toBeNull();

      globalThis.EventSource = original;
    });

    it("returns a connection when a factory is supplied", () => {
      const connection = openManagedEventSource({
        url: "/api/stream",
        eventSourceFactory: factory,
      });

      expect(connection).not.toBeNull();
      connection?.close();
    });
  });
});
