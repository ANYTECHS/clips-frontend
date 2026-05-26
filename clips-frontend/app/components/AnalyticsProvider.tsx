'use client'

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import analytics from '@/lib/analytics';

/**
 * AnalyticsProvider Component
 * 
 * Automatically tracks page views when the route changes.
 * Should be placed in the root layout to track all navigation.
 */
export default function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Initialize analytics on mount
    analytics.initialize();
  }, []);

  useEffect(() => {
    // Track page view on route change
    if (pathname) {
      // Build the full path including search params (but sanitized)
      const search = searchParams?.toString();
      const fullPath = search ? `${pathname}?${search}` : pathname;
      
      analytics.trackPageView(fullPath);
    }
  }, [pathname, searchParams]);

  // This component doesn't render anything
  return null;
}
