/**
 * stringUtils.test.ts
 *
 * Tests for string utility functions
 */

import { truncateAddress, truncateStellarAddress } from "@/app/lib/stringUtils";

describe("truncateAddress", () => {
  it("should truncate long addresses correctly with default parameters", () => {
    const address = "GABC123XYZ789DEF456GHI789JKL012MNO345PQR678STU";
    const truncated = truncateAddress(address);
    expect(truncated).toBe("GABC12...678STU");
  });

  it("should truncate Ethereum addresses correctly", () => {
    const address = "0x1234567890123456789012345678901234567890";
    const truncated = truncateAddress(address);
    expect(truncated).toBe("0x1234...7890");
  });

  it("should return short addresses as-is", () => {
    const address = "short";
    const truncated = truncateAddress(address);
    expect(truncated).toBe("short");
  });

  it("should handle addresses exactly at minimum length", () => {
    const address = "123456789012"; // 12 characters
    const truncated = truncateAddress(address);
    expect(truncated).toBe("123456789012");
  });

  it("should use custom start and end lengths", () => {
    const address = "GABC123XYZ789DEF456GHI789JKL012MNO345PQR678STU";
    const truncated = truncateAddress(address, 4, 2);
    expect(truncated).toBe("GABC...STU");
  });

  it("should use custom minimum length", () => {
    const address = "1234567890"; // 10 characters
    const truncated = truncateAddress(address, 6, 4, 10);
    expect(truncated).toBe("1234567890");
  });

  it("should handle empty string", () => {
    const truncated = truncateAddress("");
    expect(truncated).toBe("");
  });
});

describe("truncateStellarAddress", () => {
  it("should truncate Stellar addresses correctly", () => {
    const publicKey = "GABC123XYZ789DEF456GHI789JKL012MNO345PQR678STU";
    const truncated = truncateStellarAddress(publicKey);
    expect(truncated).toBe("GABC12...678STU");
  });

  it("should return short Stellar addresses as-is", () => {
    const publicKey = "GABC123"; // 7 characters
    const truncated = truncateStellarAddress(publicKey);
    expect(truncated).toBe("GABC123");
  });

  it("should handle addresses exactly at minimum length (10 chars)", () => {
    const publicKey = "GABC123XYZ"; // 10 characters
    const truncated = truncateStellarAddress(publicKey);
    expect(truncated).toBe("GABC123XYZ");
  });

  it("should handle empty string", () => {
    const truncated = truncateStellarAddress("");
    expect(truncated).toBe("");
  });

  it("should handle standard Stellar address length (56 chars)", () => {
    const publicKey = "G" + "A".repeat(55);
    const truncated = truncateStellarAddress(publicKey);
    expect(truncated).toBe("GAAAAA...AAAAA");
  });
});
