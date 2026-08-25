"use client";

/**
 * Subscribes to Next.js's Web Vitals stream and forwards it to the
 * performance monitoring pipeline (#882).
 *
 * Rendered once from the root layout. It draws nothing — `useReportWebVitals`
 * is a subscription, and the reporting itself happens in
 * `app/lib/performanceMonitoring.ts`.
 */

import { useReportWebVitals } from "next/web-vitals";
import { reportWebVital } from "@/app/lib/performanceMonitoring";

export default function PerformanceMonitor() {
  useReportWebVitals((metric) => {
    reportWebVital(metric);
  });

  return null;
}
