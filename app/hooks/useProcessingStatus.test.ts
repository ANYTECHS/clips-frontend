/**
 * Unit tests for useProcessingStatus hook
 */

import { renderHook, act } from '@testing-library/react';
import { useProcessingStatus } from './useProcessingStatus';

describe('useProcessingStatus', () => {
  it('should initialize with idle status', () => {
    const { result } = renderHook(() => useProcessingStatus());
    
    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
  });

  it('should transition to processing', () => {
    const { result } = renderHook(() => useProcessingStatus());
    
    act(() => {
      result.current.start();
    });
    
    expect(result.current.status).toBe('processing');
  });

  it('should handle progress updates', () => {
    const { result } = renderHook(() => useProcessingStatus());
    
    act(() => {
      result.current.setProgress(50);
    });
    
    expect(result.current.progress).toBe(50);
  });

  it('should complete processing', () => {
    const { result } = renderHook(() => useProcessingStatus());
    
    act(() => {
      result.current.start();
      result.current.complete();
    });
    
    expect(result.current.status).toBe('completed');
  });

  it('should handle errors', () => {
    const { result } = renderHook(() => useProcessingStatus());
    
    act(() => {
      result.current.start();
      result.current.error('Test error');
    });
    
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('Test error');
  });

  it('should reset state', () => {
    const { result } = renderHook(() => useProcessingStatus());
    
    act(() => {
      result.current.start();
      result.current.setProgress(75);
      result.current.reset();
    });
    
    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
  });

  it('should not exceed max progress', () => {
    const { result } = renderHook(() => useProcessingStatus());
    
    act(() => {
      result.current.setProgress(150);
    });
    
    expect(result.current.progress).toBeLessThanOrEqual(100);
  });

  it('should not go below min progress', () => {
    const { result } = renderHook(() => useProcessingStatus());
    
    act(() => {
      result.current.setProgress(-50);
    });
    
    expect(result.current.progress).toBeGreaterThanOrEqual(0);
  });
});
