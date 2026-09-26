/**
 * Unit tests for sanitize utility
 */

import { sanitize } from './sanitize';

describe('sanitize', () => {
  it('should remove XSS attack vectors', () => {
    const malicious = '<img src=x onerror="alert(\'XSS\')">';
    const result = sanitize(malicious);
    
    expect(result).not.toContain('onerror');
  });

  it('should preserve safe HTML tags', () => {
    const safe = '<p>Hello <strong>World</strong></p>';
    const result = sanitize(safe);
    
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('should handle null input', () => {
    const result = sanitize(null as any);
    
    expect(result).toBe('');
  });

  it('should handle undefined input', () => {
    const result = sanitize(undefined as any);
    
    expect(result).toBe('');
  });

  it('should remove script tags', () => {
    const withScript = '<p>Text</p><script>alert("bad")</script>';
    const result = sanitize(withScript);
    
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
  });

  it('should remove event handlers', () => {
    const withHandlers = '<div onclick="alert(1)">Click</div>';
    const result = sanitize(withHandlers);
    
    expect(result).not.toContain('onclick');
  });

  it('should preserve URLs in safe contexts', () => {
    const withUrl = '<a href="https://example.com">Link</a>';
    const result = sanitize(withUrl);
    
    expect(result).toContain('example.com');
  });
});
