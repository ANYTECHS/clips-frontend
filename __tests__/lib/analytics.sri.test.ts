/**
 * SRI/crossOrigin attributes on dynamically-loaded analytics scripts (issue #801).
 */

function setConsent() {
  localStorage.setItem(
    "cookie-consent",
    JSON.stringify({ essential: true, analytics: true, marketing: false }),
  );
}

function loadAnalyticsWithProvider(provider: string) {
  jest.resetModules();
  process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER = provider;
  setConsent();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("@/app/lib/analytics");
  return mod.default;
}

describe("analytics script SRI/crossOrigin (issue #801)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    document.head.innerHTML = "";
    localStorage.clear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("GA4: sets crossOrigin=anonymous and omits integrity when no hash is configured", () => {
    delete process.env.NEXT_PUBLIC_GA4_SCRIPT_SRI_HASH;
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";

    const analytics = loadAnalyticsWithProvider("ga4");
    analytics.initialize();

    const script = document.head.querySelector(
      'script[src*="googletagmanager.com"]',
    ) as HTMLScriptElement;
    expect(script).not.toBeNull();
    expect(script.crossOrigin).toBe("anonymous");
    expect(script.integrity).toBe("");
  });

  it("GA4: applies the configured integrity hash when set", () => {
    process.env.NEXT_PUBLIC_GA4_SCRIPT_SRI_HASH = "sha256-testhash";
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";

    const analytics = loadAnalyticsWithProvider("ga4");
    analytics.initialize();

    const script = document.head.querySelector(
      'script[src*="googletagmanager.com"]',
    ) as HTMLScriptElement;
    expect(script.integrity).toBe("sha256-testhash");
  });

  it("Plausible: sets crossOrigin=anonymous and omits integrity when no hash is configured", () => {
    delete process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRI_HASH;

    const analytics = loadAnalyticsWithProvider("plausible");
    analytics.initialize();

    const script = document.head.querySelector(
      'script[src*="plausible.io"]',
    ) as HTMLScriptElement;
    expect(script).not.toBeNull();
    expect(script.crossOrigin).toBe("anonymous");
    expect(script.integrity).toBe("");
  });

  it("Plausible: applies the configured integrity hash and a pinned URL when set", () => {
    process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRI_HASH = "sha256-testhash";
    process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL = "https://plausible.io/js/script.pinned.js";

    const analytics = loadAnalyticsWithProvider("plausible");
    analytics.initialize();

    const script = document.head.querySelector(
      'script[src*="plausible.io"]',
    ) as HTMLScriptElement;
    expect(script.src).toBe("https://plausible.io/js/script.pinned.js");
    expect(script.integrity).toBe("sha256-testhash");
  });
});
