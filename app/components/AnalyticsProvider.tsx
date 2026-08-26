'use client'

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import analytics from '@/app/lib/analytics';

/**
 * AnalyticsProvider Component
 * 
 * Automatically tracks page views when the route changes.
 * Should be placed in the root layout to track all navigation.
 */
export default function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      analytics.initialize();
      initialized.current = true;
    }
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
