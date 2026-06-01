/**
 * Analytics Tracking Utility
 * 
 * Provides a unified interface for tracking page views and events across different analytics providers.
 * Respects user cookie consent preferences and filters out PII.
 */

type AnalyticsProvider = 'ga4' | 'plausible' | 'custom' | 'none';

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

// PII patterns to filter out
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b[G][A-Z0-9]{55}\b/g, // Stellar public key
  /\b0x[a-fA-F0-9]{40}\b/g, // Ethereum address
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{16}\b/g, // Credit card
];

class Analytics {
  private provider: AnalyticsProvider;
  private isInitialized: boolean = false;
  private consentGiven: boolean = false;
  private debugMode: boolean = false;

  constructor() {
    this.provider = this.getProvider();
    this.debugMode = process.env.NODE_ENV === 'development';
    
    // Listen for consent changes
    if (typeof window !== 'undefined') {
      this.checkConsent();
      window.addEventListener('cookie-consent-updated', this.handleConsentUpdate.bind(this));
    }
  }

  /**
   * Get the analytics provider from environment variable
   */
  private getProvider(): AnalyticsProvider {
    const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER?.toLowerCase();
    
    switch (provider) {
      case 'ga4':
      case 'plausible':
      case 'custom':
        return provider;
      default:
        return 'none';
    }
  }

  /**
   * Check if user has given analytics consent
   */
  private checkConsent(): void {
    if (typeof window === 'undefined') return;

    try {
      const savedConsent = localStorage.getItem('cookie-consent');
      if (savedConsent) {
        const consent: CookieConsent = JSON.parse(savedConsent);
        this.consentGiven = consent.analytics === true;
      }
    } catch (error) {
      console.error('Failed to check analytics consent:', error);
      this.consentGiven = false;
    }
  }

  /**
   * Handle consent update events
   */
  private handleConsentUpdate(event: Event): void {
    const customEvent = event as CustomEvent<CookieConsent>;
    this.consentGiven = customEvent.detail.analytics === true;
    
    if (this.consentGiven && !this.isInitialized) {
      this.initialize();
    }
  }

  /**
   * Initialize the analytics provider
   */
  public initialize(): void {
    if (this.isInitialized || !this.consentGiven) return;
    if (this.provider === 'none') return;

    try {
      switch (this.provider) {
        case 'ga4':
          this.initializeGA4();
          break;
        case 'plausible':
          this.initializePlausible();
          break;
        case 'custom':
          this.initializeCustom();
          break;
      }
      
      this.isInitialized = true;
      this.log('Analytics initialized:', this.provider);
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }

  /**
   * Initialize Google Analytics 4
   */
  private initializeGA4(): void {
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    
    if (!measurementId) {
      console.warn('GA4 measurement ID not configured');
      return;
    }

    // Load gtag script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer.push(args);
    }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', measurementId, {
      anonymize_ip: true,
      cookie_flags: 'SameSite=None;Secure',
    });
  }

  /**
   * Initialize Plausible Analytics
   */
  private initializePlausible(): void {
    const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || window.location.hostname;
    
    const script = document.createElement('script');
    script.defer = true;
    script.setAttribute('data-domain', domain);
    script.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(script);
  }

  /**
   * Initialize custom analytics (logs to console or custom endpoint)
   */
  private initializeCustom(): void {
    this.log('Custom analytics initialized');
  }

  /**
   * Sanitize data to remove PII
   */
  private sanitize(data: any): any {
    if (typeof data === 'string') {
      let sanitized = data;
      PII_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      });
      return sanitized;
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {};
      
      for (const key in data) {
        // Skip keys that likely contain PII
        if (/email|wallet|address|phone|ssn|card/i.test(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitize(data[key]);
        }
      }
      
      return sanitized;
    }

    return data;
  }

  /**
   * Log debug messages in development
   */
  private log(...args: any[]): void {
    if (this.debugMode) {
      console.log('[Analytics]', ...args);
    }
  }

  /**
   * Track a page view
   */
  public trackPageView(path: string): void {
    if (!this.consentGiven) {
      this.log('Page view not tracked - no consent:', path);
      return;
    }

    const sanitizedPath = this.sanitize(path);
    this.log('Page view:', sanitizedPath);

    try {
      switch (this.provider) {
        case 'ga4':
          if (window.gtag) {
            window.gtag('event', 'page_view', {
              page_path: sanitizedPath,
            });
          }
          break;

        case 'plausible':
          if (window.plausible) {
            window.plausible('pageview', { props: { path: sanitizedPath } });
          }
          break;

        case 'custom':
          this.sendCustomEvent('page_view', { path: sanitizedPath });
          break;
      }
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  }

  /**
   * Track a custom event
   */
  public trackEvent(name: string, properties?: EventProperties): void {
    if (!this.consentGiven) {
      this.log('Event not tracked - no consent:', name);
      return;
    }

    const sanitizedProperties = properties ? this.sanitize(properties) : {};
    this.log('Event:', name, sanitizedProperties);

    try {
      switch (this.provider) {
        case 'ga4':
          if (window.gtag) {
            window.gtag('event', name, sanitizedProperties);
          }
          break;

        case 'plausible':
          if (window.plausible) {
            window.plausible(name, { props: sanitizedProperties });
          }
          break;

        case 'custom':
          this.sendCustomEvent(name, sanitizedProperties);
          break;
      }
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  /**
   * Send event to custom analytics endpoint
   */
  private sendCustomEvent(name: string, properties: any): void {
    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    
    if (!endpoint) {
      this.log('Custom event (no endpoint):', name, properties);
      return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: name,
        properties,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        referrer: document.referrer,
      }),
    }).catch(error => {
      console.error('Failed to send custom event:', error);
    });
  }

  /**
   * Track user signup
   */
  public trackSignup(method?: string): void {
    this.trackEvent('user_signup', { method });
  }

  /**
   * Track video upload
   */
  public trackVideoUpload(fileSize?: number, duration?: number): void {
    this.trackEvent('video_upload', {
      file_size: fileSize,
      duration,
    });
  }

  /**
   * Track NFT minting
   */
  public trackNFTMint(clipId?: string): void {
    this.trackEvent('nft_mint', {
      clip_id: clipId,
    });
  }

  /**
   * Track earnings report export
   */
  public trackEarningsExport(format?: string): void {
    this.trackEvent('earnings_export', { format });
  }

  /**
   * Track wallet connection
   */
  public trackWalletConnect(walletType?: string): void {
    this.trackEvent('wallet_connect', {
      wallet_type: walletType,
    });
  }

  /**
   * Track wallet disconnection
   */
  public trackWalletDisconnect(walletType?: string): void {
    this.trackEvent('wallet_disconnect', {
      wallet_type: walletType,
    });
  }

  /**
   * Track wallet creation (embedded/auto-generated wallet)
   */
  public trackWalletCreated(walletType?: string): void {
    this.trackEvent('wallet_created', {
      wallet_type: walletType,
    });
  }

  /**
   * Track secret key import
   */
  public trackWalletImport(walletType?: string): void {
    this.trackEvent('wallet_import', {
      wallet_type: walletType,
    });
  }

  /**
   * Track Friendbot funding (testnet only)
   */
  public trackWalletFunded(walletType?: string): void {
    this.trackEvent('wallet_funded', {
      wallet_type: walletType,
    });
  }

  /**
   * Track an on-chain payment transaction.
   * Amount is bucketed to avoid storing precise financial data.
   */
  public trackTransaction(params: {
    walletType?: string;
    assetCode?: string;
    /** Bucketed amount range, e.g. "0-1", "1-10", "10-100", "100+" */
    amountBucket?: string;
    network?: string;
  }): void {
    this.trackEvent('wallet_transaction', {
      wallet_type: params.walletType,
      asset_code: params.assetCode ?? 'XLM',
      amount_bucket: params.amountBucket,
      network: params.network,
    });
  }

  /**
   * Track a trustline change (add or remove).
   */
  public trackTrustlineChange(params: {
    action: 'add' | 'remove';
    assetCode: string;
    walletType?: string;
    network?: string;
  }): void {
    this.trackEvent('trustline_change', {
      action: params.action,
      asset_code: params.assetCode,
      wallet_type: params.walletType,
      network: params.network,
    });
  }
}

// Singleton instance
const analytics = new Analytics();

// Export the instance and types
export default analytics;
export type { EventProperties, AnalyticsProvider };

/**
 * Bucket a numeric amount into a range string for privacy-safe analytics.
 * e.g. 0.5 → "0-1", 5 → "1-10", 50 → "10-100", 500 → "100+"
 */
export function bucketAmount(amount: number): string {
  if (amount <= 0) return "0";
  if (amount < 1) return "0-1";
  if (amount < 10) return "1-10";
  if (amount < 100) return "10-100";
  if (amount < 1000) return "100-1000";
  return "1000+";
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    plausible: (event: string, options?: { props?: any }) => void;
  }
}
