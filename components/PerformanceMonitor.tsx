"use client";

/**
 * Subscribes to Next.js's Web Vitals stream and to periodic heap sampling,
 * forwarding both to the performance monitoring pipeline (#882).
 *
 * Rendered once from the root layout. It draws nothing — `useReportWebVitals`
 * and `useMemoryMonitor` are subscriptions, and the reporting itself happens
 * in `app/lib/performanceMonitoring.ts`.
 */

import { useReportWebVitals } from "next/web-vitals";
import { reportWebVital } from "@/app/lib/performanceMonitoring";
import { useMemoryMonitor } from "@/app/hooks/useMemoryMonitor";

export default function PerformanceMonitor() {
  useReportWebVitals((metric) => {
    reportWebVital(metric);
  });

  useMemoryMonitor();

  return null;
}
