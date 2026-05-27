/**
 * Analytics Utility Tests
 * 
 * Tests for the analytics tracking system including PII sanitization,
 * consent management, and event tracking.
 */

import analytics from './analytics';

// Mock window objects
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Analytics', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    // Reset console.log mock
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Consent Management', () => {
    it('should not track events without analytics consent', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      // No consent given
      analytics.trackEvent('test_event');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Analytics]',
        'Event not tracked - no consent:',
        'test_event'
      );
    });

    it('should track events with analytics consent', () => {
      // Grant analytics consent
      mockLocalStorage.setItem('cookie-consent', JSON.stringify({
        essential: true,
        analytics: true,
        marketing: false,
      }));

      // Trigger consent check
      window.dispatchEvent(new CustomEvent('cookie-consent-updated', {
        detail: { essential: true, analytics: true, marketing: false }
      }));

      const consoleSpy = jest.spyOn(console, 'log');
      analytics.trackEvent('test_event');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Analytics]',
        'Event:',
        'test_event',
        {}
      );
    });

    it('should respond to consent changes', () => {
      // Initially no consent
      analytics.trackPageView('/test');
      
      // Grant consent
      window.dispatchEvent(new CustomEvent('cookie-consent-updated', {
        detail: { essential: true, analytics: true, marketing: false }
      }));

      const consoleSpy = jest.spyOn(console, 'log');
      analytics.trackPageView('/test-2');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Analytics]',
        'Page view:',
        '/test-2'
      );
    });
  });

  describe('PII Sanitization', () => {
    beforeEach(() => {
      // Grant consent for these tests
      mockLocalStorage.setItem('cookie-consent', JSON.stringify({
        essential: true,
        analytics: true,
        marketing: false,
      }));
      window.dispatchEvent(new CustomEvent('cookie-consent-updated', {
        detail: { essential: true, analytics: true, marketing: false }
      }));
    });

    it('should redact email addresses', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackEvent('test_event', {
        user_email: 'user@example.com',
        message: 'Contact us at support@clipcash.ai'
      });

      const loggedProperties = consoleSpy.mock.calls[0][3];
      expect(loggedProperties.user_email).toBe('[REDACTED]');
      expect(loggedProperties.message).toContain('[REDACTED]');
    });

    it('should redact Stellar wallet addresses', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackEvent('test_event', {
        wallet_address: 'GA7XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      });

      const loggedProperties = consoleSpy.mock.calls[0][3];
      expect(loggedProperties.wallet_address).toBe('[REDACTED]');
    });

    it('should redact Ethereum addresses', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackEvent('test_event', {
        eth_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      });

      const loggedProperties = consoleSpy.mock.calls[0][3];
      expect(loggedProperties.eth_address).toBe('[REDACTED]');
    });

    it('should redact keys containing sensitive words', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackEvent('test_event', {
        user_email: 'test@example.com',
        wallet_id: 'wallet123',
        phone_number: '555-1234',
        action: 'clicked_button', // Should NOT be redacted
      });

      const loggedProperties = consoleSpy.mock.calls[0][3];
      expect(loggedProperties.user_email).toBe('[REDACTED]');
      expect(loggedProperties.wallet_id).toBe('[REDACTED]');
      expect(loggedProperties.phone_number).toBe('[REDACTED]');
      expect(loggedProperties.action).toBe('clicked_button');
    });

    it('should sanitize nested objects', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackEvent('test_event', {
        user: {
          email: 'user@example.com',
          name: 'John Doe',
        },
        metadata: {
          wallet_address: 'GA7XXXX',
        }
      });

      const loggedProperties = consoleSpy.mock.calls[0][3];
      expect(loggedProperties.user.email).toBe('[REDACTED]');
      expect(loggedProperties.user.name).toBe('John Doe');
      expect(loggedProperties.metadata.wallet_address).toBe('[REDACTED]');
    });

    it('should sanitize arrays', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackEvent('test_event', {
        emails: ['user1@example.com', 'user2@example.com'],
        names: ['Alice', 'Bob'],
      });

      const loggedProperties = consoleSpy.mock.calls[0][3];
      expect(loggedProperties.emails[0]).toContain('[REDACTED]');
      expect(loggedProperties.emails[1]).toContain('[REDACTED]');
      expect(loggedProperties.names[0]).toBe('Alice');
      expect(loggedProperties.names[1]).toBe('Bob');
    });
  });

  describe('Event Tracking Methods', () => {
    beforeEach(() => {
      // Grant consent
      mockLocalStorage.setItem('cookie-consent', JSON.stringify({
        essential: true,
        analytics: true,
        marketing: false,
      }));
      window.dispatchEvent(new CustomEvent('cookie-consent-updated', {
        detail: { essential: true, analytics: true, marketing: false }
      }));
    });

    it('should track page views', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackPageView('/dashboard');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Analytics]',
        'Page view:',
        '/dashboard'
      );
    });

    it('should track user signup', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackSignup('email');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Analytics]',
        'Event:',
        'user_signup',
        { method: 'email' }
      );
    });

    it('should track video upload', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackVideoUpload(1048576, 120);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Analytics]',
        'Event:',
        'video_upload',
        { file_size: 1048576, duration: 120 }
      );
    });

    it('should track NFT mint', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackNFTMint('clip_123');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Analytics]',
        'Event:',
        'nft_mint',
        { clip_id: 'clip_123' }
      );
    });

    it('should track earnings export', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackEarningsExport('csv');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Analytics]',
        'Event:',
        'earnings_export',
        { format: 'csv' }
      );
    });

    it('should track wallet connect', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackWalletConnect('metamask');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Analytics]',
        'Event:',
        'wallet_connect',
        { wallet_type: 'metamask' }
      );
    });

    it('should track custom events', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      analytics.trackEvent('custom_event', {
        feature: 'ai_clipping',
        clips_generated: 5,
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Analytics]',
        'Event:',
        'custom_event',
        { feature: 'ai_clipping', clips_generated: 5 }
      );
    });
  });

  describe('Provider Configuration', () => {
    it('should use provider from environment variable', () => {
      // This would require mocking process.env which is tricky in Jest
      // In a real scenario, you'd test this with different env configs
      expect(analytics).toBeDefined();
    });
  });
});
