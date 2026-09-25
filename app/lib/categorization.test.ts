import { categorizeClip, categoryCounts } from "./categorization";

describe("clip categorization", () => {
  it("categorizes common clip topics", () => {
    expect(categorizeClip("Ranked gaming highlights")).toBe("gaming");
    expect(categorizeClip("How to build a better workflow", ["business tips"])).toBe("business");
  });

  it("builds category totals", () => {
    expect(categoryCounts([{ title: "gaming montage" }, { title: "morning routine" }])).toMatchObject({ gaming: 1, lifestyle: 1 });
  });
});
