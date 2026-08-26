import {
  DEFERRED_PRECONNECT_ORIGINS,
  DICEBEAR_ORIGIN,
  LANDING_HERO_PRIMARY_AVATAR_SRC,
  landingHeroAvatarSrc,
} from "@/app/lib/resourceHints";

describe("resourceHints", () => {
  it("defines the primary landing avatar on Dicebear", () => {
    expect(LANDING_HERO_PRIMARY_AVATAR_SRC).toBe(
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    );
    expect(landingHeroAvatarSrc("Felix")).toBe(LANDING_HERO_PRIMARY_AVATAR_SRC);
  });

  it("keeps deferred origins off the landing critical path", () => {
    expect(DICEBEAR_ORIGIN).not.toBe("");
    for (const origin of DEFERRED_PRECONNECT_ORIGINS) {
      expect(origin).not.toBe(DICEBEAR_ORIGIN);
    }
  });
});
