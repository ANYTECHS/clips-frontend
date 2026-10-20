/**
 * __tests__/performance/cls-test.test.ts
 *
 * Captures CLS values before and after layout shift prevention fixes.
 * This test helps verify that CLS improvements are working as expected.
 */

import { calculateCLS, type LayoutShiftEntry } from "@/app/lib/layoutShiftPrevention";

describe("CLS Measurement and Prevention", () => {
  describe("calculateCLS", () => {
    it("should calculate CLS score from layout shift entries", () => {
      const entries: LayoutShiftEntry[] = [
        {
          value: 0.05,
          hadRecentInput: false,
          startTime: 100,
        },
        {
          value: 0.03,
          hadRecentInput: false,
          startTime: 500,
        },
      ];

      const cls = calculateCLS(entries);
      expect(cls).toBeCloseTo(0.08, 2);
    });

    it("should skip shifts with recent user input", () => {
      const entries: LayoutShiftEntry[] = [
        {
          value: 0.1,
          hadRecentInput: true, // Should be skipped
          startTime: 100,
        },
        {
          value: 0.05,
          hadRecentInput: false,
          startTime: 500,
        },
      ];

      const cls = calculateCLS(entries);
      expect(cls).toBeCloseTo(0.05, 2);
    });

    it("should group shifts into sessions correctly", () => {
      // Create shifts that should be in different sessions
      const entries: LayoutShiftEntry[] = [
        {
          value: 0.05,
          hadRecentInput: false,
          startTime: 100,
        },
        {
          value: 0.03,
          hadRecentInput: false,
          startTime: 600, // 500ms gap - same session
        },
        {
          value: 0.1,
          hadRecentInput: false,
          startTime: 2000, // Large gap - new session
        },
      ];

      const cls = calculateCLS(entries);
      // Should return the max session value (0.1 from the second session)
      expect(cls).toBeCloseTo(0.1, 2);
    });

    it("should return 0 for no shifts", () => {
      const cls = calculateCLS([]);
      expect(cls).toBe(0);
    });

    it("should handle shifts that exceed the good threshold", () => {
      const entries: LayoutShiftEntry[] = [
        {
          value: 0.15, // Exceeds 0.1 threshold
          hadRecentInput: false,
          startTime: 100,
        },
      ];

      const cls = calculateCLS(entries);
      expect(cls).toBeGreaterThan(0.1);
    });
  });

  describe("CLS Threshold Verification", () => {
    it("should identify good CLS scores (< 0.1)", () => {
      const entries: LayoutShiftEntry[] = [
        {
          value: 0.05,
          hadRecentInput: false,
          startTime: 100,
        },
      ];

      const cls = calculateCLS(entries);
      expect(cls).toBeLessThan(0.1);
    });

    it("should identify needs-improvement CLS scores (0.1 - 0.25)", () => {
      const entries: LayoutShiftEntry[] = [
        {
          value: 0.15,
          hadRecentInput: false,
          startTime: 100,
        },
      ];

      const cls = calculateCLS(entries);
      expect(cls).toBeGreaterThanOrEqual(0.1);
      expect(cls).toBeLessThan(0.25);
    });

    it("should identify poor CLS scores (> 0.25)", () => {
      const entries: LayoutShiftEntry[] = [
        {
          value: 0.3,
          hadRecentInput: false,
          startTime: 100,
        },
      ];

      const cls = calculateCLS(entries);
      expect(cls).toBeGreaterThanOrEqual(0.25);
    });
  });
});
