/**
 * Tests for the performance monitoring pipeline (#882).
 *
 * These pin the parts that decide what an on-call engineer actually sees:
 * how a value is rated against its budget, which vitals are forwarded, that
 * every sink receives the sample, that a budget breach is raised loudly, and
 * that a broken sink can never take a render down with it.
 */

import * as Sentry from "@sentry/nextjs";
import analytics from "@/app/lib/analytics";
import {
  rateMetric,
  reportMetric,
  reportWebVital,
  measure,
  startMeasure,
  WEB_VITAL_THRESHOLDS,
} from "@/app/lib/performanceMonitoring";

jest.mock("@sentry/nextjs", () => ({
  setMeasurement: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock("@/app/lib/analytics", () => ({
  __esModule: true,
  default: { trackEvent: jest.fn() },
}));

// The failing-sink test deliberately makes a transport throw; the logger is
// mocked so that expected warning does not look like a broken suite.
jest.mock("@/app/lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const trackEvent = analytics.trackEvent as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("rateMetric", () => {
  it.each([
    ["LCP", 2000, "good"],
    ["LCP", 2500, "good"],
    ["LCP", 3000, "needs-improvement"],
    ["LCP", 4000, "needs-improvement"],
    ["LCP", 4001, "poor"],
    ["CLS", 0.05, "good"],
    ["CLS", 0.2, "needs-improvement"],
    ["CLS", 0.4, "poor"],
    ["INP", 150, "good"],
    ["TTFB", 2000, "poor"],
  ])("rates %s of %p as %s", (name, value, expected) => {
    expect(rateMetric(name as string, value as number)).toBe(expected);
  });

  it("treats a threshold boundary as the better of the two ratings", () => {
    const [good, needsImprovement] = WEB_VITAL_THRESHOLDS.LCP;
    expect(rateMetric("LCP", good)).toBe("good");
    expect(rateMetric("LCP", needsImprovement)).toBe("needs-improvement");
  });

  it("rates a custom metric against its own budget", () => {
    expect(rateMetric("dashboard.load", 500)).toBe("good");
    expect(rateMetric("dashboard.load", 2000)).toBe("needs-improvement");
    expect(rateMetric("dashboard.load", 5000)).toBe("poor");
  });

  it("defaults an unbudgeted metric to good rather than guessing a threshold", () => {
    expect(rateMetric("something.unbudgeted", 999_999)).toBe("good");
  });
});

describe("reportMetric", () => {
  it("sends the sample to Sentry and to analytics", () => {
    const metric = reportMetric("LCP", 1800, { path: "/dashboard" });

    expect(metric).toMatchObject({
      name: "LCP",
      value: 1800,
      rating: "good",
      unit: "millisecond",
    });

    expect(Sentry.setMeasurement).toHaveBeenCalledWith("LCP", 1800, "millisecond");
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: "performance", level: "info" }),
    );
    expect(trackEvent).toHaveBeenCalledWith(
      "performance_metric",
      expect.objectContaining({
        metric: "LCP",
        value: 1800,
        rating: "good",
        path: "/dashboard",
      }),
    );
  });

  it("reports CLS as a unitless score, keeping its decimals", () => {
    const metric = reportMetric("CLS", 0.045);

    expect(metric?.unit).toBe("none");
    expect(Sentry.setMeasurement).toHaveBeenCalledWith("CLS", 0.045, "none");
    expect(trackEvent).toHaveBeenCalledWith(
      "performance_metric",
      expect.objectContaining({ value: 0.045 }),
    );
  });

  it("raises a budget breach for a poor sample", () => {
    reportMetric("LCP", 9000, { path: "/upload" });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Performance budget exceeded: LCP",
      expect.objectContaining({ level: "warning" }),
    );
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("does not raise a breach for a sample inside budget", () => {
    reportMetric("LCP", 1000);

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("keeps reporting to the other sinks when one throws", () => {
    (Sentry.setMeasurement as jest.Mock).mockImplementationOnce(() => {
      throw new Error("transport down");
    });

    expect(() => reportMetric("FCP", 1200)).not.toThrow();
    expect(trackEvent).toHaveBeenCalledWith(
      "performance_metric",
      expect.objectContaining({ metric: "FCP" }),
    );
  });
});

describe("reportWebVital", () => {
  it("forwards a tracked vital with its id and path", () => {
    const metric = reportWebVital({ name: "INP", value: 120, id: "v3-1" });

    expect(metric).toMatchObject({ name: "INP", value: 120, rating: "good" });
    expect(trackEvent).toHaveBeenCalledWith(
      "performance_metric",
      expect.objectContaining({ metric: "INP", id: "v3-1" }),
    );
  });

  it("ignores entries Next reports that have no budget", () => {
    // Next also emits Next.js-specific entries such as "Next.js-hydration".
    expect(reportWebVital({ name: "Next.js-hydration", value: 42 })).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(Sentry.setMeasurement).not.toHaveBeenCalled();
  });
});

describe("measure", () => {
  it("reports the duration and returns the operation's value", async () => {
    const result = await measure("dashboard.load", async () => "done");

    expect(result).toBe("done");
    expect(trackEvent).toHaveBeenCalledWith(
      "performance_metric",
      expect.objectContaining({ metric: "dashboard.load" }),
    );
  });

  it("still reports when the operation throws, and rethrows untouched", async () => {
    const boom = new Error("boom");

    await expect(
      measure("dashboard.load", () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    expect(trackEvent).toHaveBeenCalledWith(
      "performance_metric",
      expect.objectContaining({ metric: "dashboard.load" }),
    );
  });
});

describe("startMeasure", () => {
  it("reports once, merging attributes from both ends of the measurement", () => {
    const end = startMeasure("upload.total", { files: 2 });
    end({ outcome: "success" });

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith(
      "performance_metric",
      expect.objectContaining({
        metric: "upload.total",
        files: 2,
        outcome: "success",
      }),
    );
  });

  it("ignores a second end call rather than double-counting", () => {
    const end = startMeasure("upload.chunk");
    end();
    end();

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});
