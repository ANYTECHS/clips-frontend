import {
  DICEBEAR_ORIGIN,
  DNS_PREFETCH_ORIGINS,
  EXCLUDED_DNS_PREFETCH_ORIGINS,
} from "@/app/lib/dnsPrefetchOrigins";

describe("dnsPrefetchOrigins", () => {
  it("lists Dicebear as the landing critical-path DNS-prefetch origin", () => {
    expect(DNS_PREFETCH_ORIGINS).toEqual([DICEBEAR_ORIGIN]);
    expect(DNS_PREFETCH_ORIGINS).toHaveLength(1);
  });

  it("does not include server-only, consent-gated, or deferred origins", () => {
    for (const origin of EXCLUDED_DNS_PREFETCH_ORIGINS) {
      expect(DNS_PREFETCH_ORIGINS).not.toContain(origin);
    }
  });
});
