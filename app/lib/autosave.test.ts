import { clearDraft, loadDraft, saveDraft } from "./autosave";

describe("autosave drafts", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips drafts and clears them", () => {
    saveDraft("clip", { value: 42 });
    expect(loadDraft<{ value: number }>("clip")).toEqual({ value: 42 });
    clearDraft("clip");
    expect(loadDraft("clip")).toBeNull();
  });

  it("removes expired drafts", () => {
    window.localStorage.setItem("clip", JSON.stringify({ data: { stale: true }, updatedAt: 1 }));
    expect(loadDraft("clip", 10)).toBeNull();
    expect(window.localStorage.getItem("clip")).toBeNull();
  });
});
