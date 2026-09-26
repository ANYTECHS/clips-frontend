import {
  CRITICAL_RESOURCE_HINTS,
  getCriticalResourceHints,
  getResourcePriorityPlan,
  RESOURCE_PRIORITY_RANK,
} from "@/app/lib/resourcePriority";

describe("resource prioritization", () => {
  it("identifies the landing-critical resource set", () => {
    expect(CRITICAL_RESOURCE_HINTS.some((hint) => hint.href.includes("api.dicebear.com"))).toBe(true);
    expect(getCriticalResourceHints().some((hint) => hint.href.includes("api.dicebear.com"))).toBe(true);
  });

  it("orders hints by priority before low-value work", () => {
    const plan = getResourcePriorityPlan();
    expect(plan[0].priority).toBe("high");
    expect(plan.every((hint) => RESOURCE_PRIORITY_RANK[hint.priority] >= RESOURCE_PRIORITY_RANK["high"])).toBe(true);
  });

  it("keeps the priority metadata explicit for HTML hints", () => {
    const heroHint = CRITICAL_RESOURCE_HINTS.find((hint) => hint.href.includes("api.dicebear.com"));
    expect(heroHint).toMatchObject({
      rel: "preconnect",
      priority: "high",
      fetchPriority: "high",
    });
  });
});
