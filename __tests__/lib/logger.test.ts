/**
 * Tests for the structured logger (Issue #1113).
 *
 * The logger reads `NODE_ENV` and `LOG_DRAIN_URL` into module-level constants
 * at import time, so any test that cares about either has to load a fresh copy
 * of the module with the environment already set — hence `loadLogger`.
 *
 * The Sentry mock is a single shared object rather than an inline factory.
 * `jest.resetModules()` re-runs mock factories, so an inline factory would
 * hand the reloaded logger brand-new `jest.fn()`s while the file still held
 * the originals, and every assertion would see zero calls. Returning one
 * stable object keeps the spies valid across reloads.
 */

const mockSentry = {
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
};

jest.mock("@sentry/nextjs", () => mockSentry);

type LoggerModule = typeof import("@/app/lib/logger");

const ENV_KEYS = ["NODE_ENV", "LOG_DRAIN_URL"] as const;

/**
 * Import the logger with `env` in place. The environment is restored straight
 * after import: the module has already copied the values it needs into
 * constants, so leaving the process environment mutated would only leak into
 * the next test.
 */
async function loadLogger(
  env: Partial<Record<(typeof ENV_KEYS)[number], string>>
): Promise<LoggerModule> {
  const saved = ENV_KEYS.map((key) => [key, process.env[key]] as const);

  for (const key of ENV_KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }

  jest.resetModules();
  const mod = await import("@/app/lib/logger");

  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  return mod;
}

/** Silence a console method and hand back the spy. */
function spyOnConsole(method: "debug" | "info" | "warn" | "error") {
  return jest.spyOn(console, method).mockImplementation(() => {});
}

/** jsdom's Blob has no `.text()`, so go through FileReader. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Capture whatever the drain sends, keyed by sendBeacon. */
function stubSendBeacon() {
  const sendBeacon = jest.fn();
  Object.defineProperty(navigator, "sendBeacon", {
    value: sendBeacon,
    configurable: true,
  });
  return sendBeacon;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("development", () => {
  it("mirrors debug to the console and never reaches Sentry", async () => {
    const { logger } = await loadLogger({ NODE_ENV: "development" });
    const debug = spyOnConsole("debug");

    logger.debug("retrying upload", { attempt: 2 });

    expect(debug).toHaveBeenCalledWith("retrying upload", { attempt: 2 });
    expect(mockSentry.captureException).not.toHaveBeenCalled();
    expect(mockSentry.captureMessage).not.toHaveBeenCalled();
    expect(mockSentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  it.each(["info", "warn"] as const)(
    "mirrors %s to the console and never reaches Sentry",
    async (level) => {
      const { logger } = await loadLogger({ NODE_ENV: "development" });
      const spy = spyOnConsole(level);

      logger[level]("something happened");

      expect(spy).toHaveBeenCalledWith("something happened");
      expect(mockSentry.captureMessage).not.toHaveBeenCalled();
      expect(mockSentry.addBreadcrumb).not.toHaveBeenCalled();
    }
  );

  it("logs an error string to the console without capturing it", async () => {
    const { logger } = await loadLogger({ NODE_ENV: "development" });
    const error = spyOnConsole("error");

    logger.error("checkout failed");

    expect(error).toHaveBeenCalledWith("checkout failed");
    // No Error instance was passed, so there is nothing to attach a stack to.
    expect(mockSentry.captureException).not.toHaveBeenCalled();
  });

  it("forwards a passed Error to Sentry even outside production", async () => {
    const { logger } = await loadLogger({ NODE_ENV: "development" });
    spyOnConsole("error");
    const boom = new Error("boom");

    logger.error("wallet failed", boom);

    expect(mockSentry.captureException).toHaveBeenCalledWith(boom);
  });
});

describe("production", () => {
  it("drops debug entirely", async () => {
    const { logger } = await loadLogger({ NODE_ENV: "production" });
    const debug = spyOnConsole("debug");
    const info = spyOnConsole("info");

    logger.debug("noisy trace");

    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(mockSentry.captureMessage).not.toHaveBeenCalled();
    expect(mockSentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  it("sends info as a breadcrumb only, not as a standalone event", async () => {
    const { logger } = await loadLogger({ NODE_ENV: "production" });
    const info = spyOnConsole("info");

    logger.info("user opened project");

    expect(info).not.toHaveBeenCalled();
    expect(mockSentry.captureMessage).not.toHaveBeenCalled();
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ level: "info" })
    );
  });

  it("sends warn as an event and a breadcrumb", async () => {
    const { logger } = await loadLogger({ NODE_ENV: "production" });

    logger.warn("slow response");

    expect(mockSentry.captureMessage).toHaveBeenCalledWith("slow response", {
      level: "warning",
    });
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warning" })
    );
  });

  it("captures a non-Error error message as an event", async () => {
    const { logger } = await loadLogger({ NODE_ENV: "production" });

    logger.error("checkout failed");

    expect(mockSentry.captureMessage).toHaveBeenCalledWith("checkout failed", {
      level: "error",
    });
    expect(mockSentry.captureException).not.toHaveBeenCalled();
  });

  it("captures a passed Error exactly once", async () => {
    const { logger } = await loadLogger({ NODE_ENV: "production" });
    const boom = new Error("boom");

    logger.error("wallet failed", boom);

    // Regression guard: this previously filed two events for one fault —
    // `logger.error` forwarded the Error and `sendToSentry` captured it again.
    expect(mockSentry.captureException).toHaveBeenCalledTimes(1);
    expect(mockSentry.captureException).toHaveBeenCalledWith(boom);
    expect(mockSentry.captureMessage).not.toHaveBeenCalled();
    // The breadcrumb trail is still recorded, so a later crash keeps context.
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error" })
    );
  });
});

describe("message serialization", () => {
  it("joins strings as-is and JSON-encodes everything else", async () => {
    const { logger } = await loadLogger({ NODE_ENV: "production" });

    logger.warn("upload failed", { clipId: "abc", bytes: 12 });

    expect(mockSentry.captureMessage).toHaveBeenCalledWith(
      'upload failed {"clipId":"abc","bytes":12}',
      { level: "warning" }
    );
  });

  it("captures the Error itself, not a stringified copy", async () => {
    const { logger } = await loadLogger({ NODE_ENV: "production" });
    const boom = new Error("boom");

    logger.error(boom);

    // Passing the object through is what lets Sentry attach a real stack;
    // stringifying would flatten it to "{}".
    expect(mockSentry.captureException).toHaveBeenCalledWith(boom);
    expect(boom.stack).toBeDefined();
  });
});

describe("drain batching", () => {
  it("sends nothing when no drain URL is configured", async () => {
    const sendBeacon = stubSendBeacon();
    const { logger } = await loadLogger({ NODE_ENV: "development" });
    spyOnConsole("info");

    logger.info("dropped");

    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("batches entries and flushes them after the delay", async () => {
    jest.useFakeTimers();
    const sendBeacon = stubSendBeacon();
    const { logger } = await loadLogger({
      NODE_ENV: "development",
      LOG_DRAIN_URL: "https://logs.example.com/ingest",
    });
    spyOnConsole("info");
    spyOnConsole("warn");

    logger.info("first");
    logger.warn("second");
    // Not yet — the batch waits for either the delay or the size threshold.
    expect(sendBeacon).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toBe("https://logs.example.com/ingest");

    const entries = JSON.parse(await readBlob(blob));
    expect(entries).toHaveLength(2);
    expect(entries.map((entry: { level: string }) => entry.level)).toEqual(["info", "warn"]);
    expect(entries[0]).toMatchObject({
      service: "clipcash-frontend",
      message: "first",
    });
  });

  it("flushes immediately once the batch is full", async () => {
    jest.useFakeTimers();
    const sendBeacon = stubSendBeacon();
    const { logger } = await loadLogger({
      NODE_ENV: "development",
      LOG_DRAIN_URL: "https://logs.example.com/ingest",
    });
    spyOnConsole("info");

    // MAX_BATCH_SIZE is 50; the 50th entry must not wait for the timer.
    for (let i = 0; i < 50; i += 1) {
      logger.info(`entry ${i}`);
    }

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const entries = JSON.parse(await readBlob(sendBeacon.mock.calls[0][1] as Blob));
    expect(entries).toHaveLength(50);
  });
});
