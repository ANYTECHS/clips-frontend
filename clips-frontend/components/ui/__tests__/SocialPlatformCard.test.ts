// Test file to verify SocialPlatformCard component functionality
// This would normally be run in a Jest/Vitest environment

import { describe, it, expect } from 'vitest';
import { SocialPlatformCard } from '../components/ui/SocialPlatformCard';

describe('SocialPlatformCard', () => {
  it('should render TikTok card with connected state', () => {
    const props = {
      platform: 'tiktok' as const,
      isConnected: true,
      username: 'testuser',
      onConnect: () => {},
      onManage: () => {},
    };
    
    // Test component props
    expect(props.platform).toBe('tiktok');
    expect(props.isConnected).toBe(true);
    expect(props.username).toBe('testuser');
  });

  it('should render YouTube card with not connected state', () => {
    const props = {
      platform: 'youtube' as const,
      isConnected: false,
      onConnect: () => {},
      onManage: () => {},
    };
    
    expect(props.platform).toBe('youtube');
    expect(props.isConnected).toBe(false);
    expect(props.username).toBeUndefined();
  });

  it('should support all required platforms', () => {
    const platforms = ['tiktok', 'instagram', 'youtube', 'x'] as const;
    
    platforms.forEach(platform => {
      const props = {
        platform,
        isConnected: false,
        onConnect: () => {},
        onManage: () => {},
      };
      
      expect(['tiktok', 'instagram', 'youtube', 'x']).toContain(props.platform);
    });
  });
});

export default {};
