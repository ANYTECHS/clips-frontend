import robots from "../app/robots";
import sitemap from "../app/sitemap";

describe("SEO Verification (robots.ts & sitemap.ts)", () => {
  describe("robots()", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;

    it("should allow root path for all user agents", () => {
      expect(rules.allow).toBe("/");
    });

    it("should disallow all dashboard routes including new ones", () => {
      const disallowList = rules.disallow;
      const expectedProtected = [
        "/dashboard",
        "/analytics",
        "/billing",
        "/referral",
        "/settings",
        "/earnings",
        "/vault",
        "/projects",
        "/activity",
        "/wallet",
        "/platforms",
        "/multisig",
        "/transform",
      ];

      expectedProtected.forEach((route) => {
        expect(disallowList).toContain(route);
      });
    });

    it("should disallow onboarding, recovery, and auth routes", () => {
      const disallowList = rules.disallow;
      expect(disallowList).toContain("/onboarding");
      expect(disallowList).toContain("/recovery");
      expect(disallowList).toContain("/forgot-password");
      expect(disallowList).toContain("/reset-password");
    });

    it("should disallow API endpoints", () => {
      const disallowList = rules.disallow;
      expect(disallowList).toContain("/api/*");
      expect(disallowList).toContain("/api");
    });

    it("should specify valid sitemap URL", () => {
      expect(config.sitemap).toBe("https://clipcash.ai/sitemap.xml");
    });
  });

  describe("sitemap()", () => {
    const entries = sitemap();

    it("should contain root homepage entry", () => {
      const home = entries.find((e) => e.url === "https://clipcash.ai");
      expect(home).toBeDefined();
      expect(home?.priority).toBe(1);
    });

    it("should contain standard legal pages", () => {
      const urls = entries.map((e) => e.url);
      expect(urls).toContain("https://clipcash.ai/privacy");
      expect(urls).toContain("https://clipcash.ai/terms");
      expect(urls).toContain("https://clipcash.ai/cookies");
    });

    it("should contain public share route", () => {
      const urls = entries.map((e) => e.url);
      expect(urls).toContain("https://clipcash.ai/share");
    });
  });
});
