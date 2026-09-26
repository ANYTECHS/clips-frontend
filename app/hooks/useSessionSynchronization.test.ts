import { describe, expect, it } from "@jest/globals";

function winner(a: { lastWriteAt: number; sessionId: string }, b: { lastWriteAt: number; sessionId: string }) {
  return a.lastWriteAt > b.lastWriteAt || (a.lastWriteAt === b.lastWriteAt && a.sessionId > b.sessionId) ? a : b;
}

describe("session last-write-wins ordering", () => {
  it("selects the newest write", () => {
    expect(winner({ lastWriteAt: 2, sessionId: "a" }, { lastWriteAt: 1, sessionId: "z" }).sessionId).toBe("a");
  });

  it("uses a deterministic tie breaker", () => {
    expect(winner({ lastWriteAt: 1, sessionId: "a" }, { lastWriteAt: 1, sessionId: "z" }).sessionId).toBe("z");
  });
});
