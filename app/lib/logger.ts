import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

const isProduction = process.env.NODE_ENV === "production";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  traceId?: string;
  [key: string]: any;
}

let drainUrl: string | undefined;
let batch: LogEntry[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_BATCH_SIZE = 50;
const MAX_BATCH_DELAY_MS = 100;

function getTraceId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  // Next.js may attach custom request headers to __NEXT_DATA__ at runtime
  const nextData = (window as any).__NEXT_DATA__ as { headers?: Record<string, string> } | undefined;
  return (
    nextData?.headers?.["x-vercel-id"] ||
    nextData?.headers?.["x-request-id"] ||
    undefined
  );
}

function serializeArgs(args: any[]): string {
  return args
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
    .join(" ");
}

function createLogEntry(level: LogLevel, args: any[]): LogEntry {
  const entry: LogEntry = {
    level,
    message: serializeArgs(args),
    timestamp: new Date().toISOString(),
    service: "clipcash-frontend",
    traceId: getTraceId(),
  };

  const error = args.find((arg) => arg instanceof Error);
  if (error && typeof error === "object") {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return entry;
}

function flushBatch() {
  if (!drainUrl || batch.length === 0) return;

  const entries = batch.splice(0, batch.length);
  const payload = JSON.stringify(entries);

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon(drainUrl, blob);
  } else {
    fetch(drainUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // swallow network errors for logging
    });
  }
}

function scheduleFlush() {
  if (batchTimer) return;
  batchTimer = setTimeout(() => {
    batchTimer = null;
    flushBatch();
  }, MAX_BATCH_DELAY_MS);
}

function drain(entry: LogEntry) {
  if (!drainUrl) return;
  batch.push(entry);
  if (batch.length >= MAX_BATCH_SIZE) {
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
    flushBatch();
  } else {
    scheduleFlush();
  }
}

function consoleFallback(level: LogLevel, args: any[]) {
  const method =
    level === "debug" ? console.debug :
    level === "warn" ? console.warn :
    level === "error" ? console.error :
    console.info;
  method(...args);
}

function sendToSentry(level: LogLevel, args: any[]) {
  const message = serializeArgs(args);
  if (level === "error") {
    const error = args.find((arg) => arg instanceof Error);
    if (error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(message, { level: "error" });
    }
    Sentry.addBreadcrumb({ message, level: "error" });
  } else if (level === "warn") {
    Sentry.captureMessage(message, { level: "warning" });
    Sentry.addBreadcrumb({ message, level: "warning" });
  } else {
    Sentry.addBreadcrumb({ message, level: "info" });
  }
}

if (typeof process !== "undefined") {
  drainUrl = process.env.LOG_DRAIN_URL;
}

export const logger = {
  debug: (...args: any[]) => {
    if (!isProduction) {
      consoleFallback("debug", args);
    }
  },
  info: (...args: any[]) => {
    const entry = createLogEntry("info", args);
    if (drainUrl) {
      drain(entry);
    }
    if (isProduction) {
      sendToSentry("info", args);
    } else {
      consoleFallback("info", args);
    }
  },
  warn: (...args: any[]) => {
    const entry = createLogEntry("warn", args);
    if (drainUrl) {
      drain(entry);
    }
    if (isProduction) {
      sendToSentry("warn", args);
    } else {
      consoleFallback("warn", args);
    }
  },
  error: (...args: any[]) => {
    const entry = createLogEntry("error", args);
    const error = args.find((arg) => arg instanceof Error);
    if (error) {
      Sentry.captureException(error);
    }
    if (drainUrl) {
      drain(entry);
    }
    if (isProduction) {
      sendToSentry("error", args);
    } else {
      consoleFallback("error", args);
    }
  },
};