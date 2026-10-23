/**
 * @jest-environment node
 */

import { SseEventLog, formatSseEvent, parseLastEventId } from "./eventLog";

describe("SseEventLog", () => {
  it("assigns monotonically increasing ids", () => {
    const log = new SseEventLog(100, () => 1_000);

    const a = log.append("job", '{"progress":10}').event;
    const b = log.append("job", '{"progress":20}').event;
    const c = log.append("job", '{"progress":30}').event;

    expect(b.id).toBeGreaterThan(a.id);
    expect(c.id).toBeGreaterThan(b.id);
  });

  it("does not record unchanged data twice", () => {
    const log = new SseEventLog();

    const first = log.append("job", "{}");
    const second = log.append("job", "{}");

    expect(second.isNew).toBe(false);
    expect(second.event.id).toBe(first.event.id);
  });

  it("returns only the frames after the given id", () => {
    const log = new SseEventLog();
    const a = log.append("job", "1").event;
    const b = log.append("job", "2").event;
    const c = log.append("job", "3").event;

    expect(log.since("job", a.id)).toEqual([b, c]);
    expect(log.since("job", c.id)).toEqual([]);
  });

  it("keeps ids increasing past a clock that goes backwards", () => {
    let now = 5_000;
    const log = new SseEventLog(100, () => now);
    const a = log.append("job", "1").event;
    now = 1_000;
    const b = log.append("job", "2").event;

    expect(b.id).toBeGreaterThan(a.id);
  });

  it("caps the number of retained frames", () => {
    const log = new SseEventLog(2);
    log.append("job", "1");
    log.append("job", "2");
    log.append("job", "3");

    expect(log.since("job", 0).map((e) => e.data)).toEqual(["2", "3"]);
  });

  it("keeps streams independent", () => {
    const log = new SseEventLog();
    log.append("a", "1");

    expect(log.since("b", 0)).toEqual([]);
  });
});

describe("formatSseEvent", () => {
  it("writes the id before the data", () => {
    expect(formatSseEvent({ id: 3, data: '{"ok":true}' })).toBe('id: 3\ndata: {"ok":true}\n\n');
  });

  it("includes a named event and splits multi-line data", () => {
    expect(formatSseEvent({ id: 1, event: "error", data: "a\nb" })).toBe(
      "id: 1\nevent: error\ndata: a\ndata: b\n\n"
    );
  });
});

describe("parseLastEventId", () => {
  it("reads the Last-Event-ID header", () => {
    const request = new Request("http://localhost/api/jobs/1/stream", {
      headers: { "Last-Event-ID": "42" },
    });
    expect(parseLastEventId(request)).toBe(42);
  });

  it("falls back to the lastEventId query parameter", () => {
    const request = new Request("http://localhost/api/jobs/1/stream?lastEventId=7");
    expect(parseLastEventId(request)).toBe(7);
  });

  it("returns null when absent or malformed", () => {
    expect(parseLastEventId(new Request("http://localhost/x"))).toBeNull();
    expect(parseLastEventId(new Request("http://localhost/x?lastEventId=abc"))).toBeNull();
  });
});
