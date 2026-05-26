import { renderHook, act, waitFor } from '@testing-library/react';
import { useFilterQueryState } from '@/hooks/useFilterQueryState';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));

describe('useFilterQueryState', () => {
  let mockPush: jest.Mock;
  let mockSearchParams: URLSearchParams;

  beforeEach(() => {
    mockPush = jest.fn();
    mockSearchParams = new URLSearchParams();

    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });

    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    (usePathname as jest.Mock).mockReturnValue('/test-page');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should return default values when no query params exist', () => {
      const defaultValues = {
        search: '',
        style: 'All Styles',
        virality: ['high', 'medium', 'low'],
      };

      const { result } = renderHook(() => useFilterQueryState(defaultValues));

      expect(result.current.filters).toEqual(defaultValues);
    });

    it('should parse string values from URL', () => {
      mockSearchParams.set('search', 'test query');
      mockSearchParams.set('style', 'Cinematic');

      const { result } = renderHook(() =>
        useFilterQueryState({
          search: '',
          style: 'All Styles',
        })
      );

      expect(result.current.filters.search).toBe('test query');
      expect(result.current.filters.style).toBe('Cinematic');
    });

    it('should parse array values from URL (comma-separated)', () => {
      mockSearchParams.set('virality', 'high,medium');

      const { result } = renderHook(() =>
        useFilterQueryState({
          virality: ['high', 'medium', 'low'],
        })
      );

      expect(result.current.filters.virality).toEqual(['high', 'medium']);
    });

    it('should parse array values from URL (JSON format)', () => {
      mockSearchParams.set('virality', JSON.stringify(['high']));

      const { result } = renderHook(() =>
        useFilterQueryState({
          virality: ['high', 'medium', 'low'],
        })
      );

      expect(result.current.filters.virality).toEqual(['high']);
    });

    it('should parse number values from URL', () => {
      mockSearchParams.set('page', '5');
      mockSearchParams.set('limit', '20');

      const { result } = renderHook(() =>
        useFilterQueryState({
          page: 1,
          limit: 10,
        })
      );

      expect(result.current.filters.page).toBe(5);
      expect(result.current.filters.limit).toBe(20);
    });

    it('should parse boolean values from URL', () => {
      mockSearchParams.set('active', 'true');
      mockSearchParams.set('archived', 'false');

      const { result } = renderHook(() =>
        useFilterQueryState({
          active: false,
          archived: false,
        })
      );

      expect(result.current.filters.active).toBe(true);
      expect(result.current.filters.archived).toBe(false);
    });

    it('should handle invalid array JSON gracefully', () => {
      mockSearchParams.set('virality', 'invalid-json');

      const { result } = renderHook(() =>
        useFilterQueryState({
          virality: ['high', 'medium', 'low'],
        })
      );

      // Should fall back to comma-separated parsing
      expect(result.current.filters.virality).toEqual(['invalid-json']);
    });
  });

  describe('updateFilters', () => {
    it('should update URL with new filter values', () => {
      const { result } = renderHook(() =>
        useFilterQueryState({
          search: '',
          style: 'All Styles',
        })
      );

      act(() => {
        result.current.updateFilters({ search: 'new search' });
      });

      expect(mockPush).toHaveBeenCalledWith('/test-page?search=new+search', {
        scroll: false,
      });
    });

    it('should update multiple filters at once', () => {
      const { result } = renderHook(() =>
        useFilterQueryState({
          search: '',
          style: 'All Styles',
          vault: 'pending',
        })
      );

      act(() => {
        result.current.updateFilters({
          search: 'test',
          style: 'Cinematic',
        });
      });

      const callArg = mockPush.mock.calls[0][0];
      expect(callArg).toContain('search=test');
      expect(callArg).toContain('style=Cinematic');
    });

    it('should remove param when value matches default', () => {
      mockSearchParams.set('style', 'Cinematic');

      const { result } = renderHook(() =>
        useFilterQueryState({
          style: 'All Styles',
        })
      );

      act(() => {
        result.current.updateFilters({ style: 'All Styles' });
      });

      expect(mockPush).toHaveBeenCalledWith('/test-page', { scroll: false });
    });

    it('should handle array values correctly', () => {
      const { result } = renderHook(() =>
        useFilterQueryState({
          virality: ['high', 'medium', 'low'],
        })
      );

      act(() => {
        result.current.updateFilters({ virality: ['high', 'medium'] });
      });

      expect(mockPush).toHaveBeenCalledWith('/test-page?virality=high%2Cmedium', {
        scroll: false,
      });
    });

    it('should remove param when array is empty', () => {
      mockSearchParams.set('virality', 'high,medium');

      const { result } = renderHook(() =>
        useFilterQueryState({
          virality: ['high', 'medium', 'low'],
        })
      );

      act(() => {
        result.current.updateFilters({ virality: [] });
      });

      expect(mockPush).toHaveBeenCalledWith('/test-page', { scroll: false });
    });

    it('should remove param when value is null or undefined', () => {
      mockSearchParams.set('search', 'test');

      const { result } = renderHook(() =>
        useFilterQueryState({
          search: '',
        })
      );

      act(() => {
        result.current.updateFilters({ search: null as any });
      });

      expect(mockPush).toHaveBeenCalledWith('/test-page', { scroll: false });
    });

    it('should preserve existing params when updating', () => {
      mockSearchParams.set('search', 'existing');
      mockSearchParams.set('style', 'Cinematic');

      const { result } = renderHook(() =>
        useFilterQueryState({
          search: '',
          style: 'All Styles',
          vault: 'pending',
        })
      );

      act(() => {
        result.current.updateFilters({ vault: 'listed' });
      });

      const callArg = mockPush.mock.calls[0][0];
      expect(callArg).toContain('search=existing');
      expect(callArg).toContain('style=Cinematic');
      expect(callArg).toContain('vault=listed');
    });
  });

  describe('resetFilters', () => {
    it('should clear all query params and navigate to base path', () => {
      mockSearchParams.set('search', 'test');
      mockSearchParams.set('style', 'Cinematic');
      mockSearchParams.set('vault', 'listed');

      const { result } = renderHook(() =>
        useFilterQueryState({
          search: '',
          style: 'All Styles',
          vault: 'pending',
        })
      );

      act(() => {
        result.current.resetFilters();
      });

      expect(mockPush).toHaveBeenCalledWith('/test-page', { scroll: false });
    });
  });

  describe('URL shareability', () => {
    it('should load filters from shared URL', () => {
      mockSearchParams.set('style', 'Cinematic');
      mockSearchParams.set('virality', 'high,medium');
      mockSearchParams.set('vault', 'listed');

      const { result } = renderHook(() =>
        useFilterQueryState({
          style: 'All Styles',
          virality: ['high', 'medium', 'low'],
          vault: 'pending',
        })
      );

      expect(result.current.filters).toEqual({
        style: 'Cinematic',
        virality: ['high', 'medium'],
        vault: 'listed',
      });
    });
  });

  describe('browser navigation', () => {
    it('should work with browser back/forward by using router.push', () => {
      const { result } = renderHook(() =>
        useFilterQueryState({
          search: '',
        })
      );

      act(() => {
        result.current.updateFilters({ search: 'first' });
      });

      act(() => {
        result.current.updateFilters({ search: 'second' });
      });

      // Verify router.push was called (which enables back/forward)
      expect(mockPush).toHaveBeenCalledTimes(2);
      expect(mockPush).toHaveBeenNthCalledWith(1, '/test-page?search=first', {
        scroll: false,
      });
      expect(mockPush).toHaveBeenNthCalledWith(2, '/test-page?search=second', {
        scroll: false,
      });
    });
  });
});
