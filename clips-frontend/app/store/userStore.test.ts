import { act, renderHook } from '@testing-library/react';
import { useUserStore, selectUserProfile, selectUserName, selectUserEmail, selectUserAvatar, selectPlanUsage, selectUserLoading } from './userStore';
import * as api from './api';

jest.mock('./api');

describe('userStore', () => {
  beforeEach(() => {
    useUserStore.setState({
      profile: null,
      loading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useUserStore.getState();
    expect(state.profile).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetchUser works and updates state', async () => {
    const mockProfile = { id: '1', name: 'John', email: 'john@example.com', avatarUrl: null, plan: 'free' as const, planUsagePercent: 10 };
    (api.fetchUserFromAPI as jest.Mock).mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUserStore());

    act(() => {
      result.current.fetchUser();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.error).toBeNull();
  });

  it('fetchUser handles errors', async () => {
    (api.fetchUserFromAPI as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUserStore());

    await act(async () => {
      await result.current.fetchUser();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Network error');
  });

  it('fetchUser handles unknown errors', async () => {
    (api.fetchUserFromAPI as jest.Mock).mockRejectedValue('String error');

    const { result } = renderHook(() => useUserStore());

    await act(async () => {
      await result.current.fetchUser();
    });

    expect(result.current.error).toBe('Failed to fetch user profile');
  });

  it('setProfile updates profile', () => {
    const { result } = renderHook(() => useUserStore());
    const mockProfile = { id: '2', name: 'Jane', email: 'jane@example.com', avatarUrl: '/jane.png', plan: 'pro' as const, planUsagePercent: 50 };

    act(() => {
      result.current.setProfile(mockProfile);
    });

    expect(result.current.profile).toEqual(mockProfile);
  });

  it('clearUser resets state', () => {
    useUserStore.setState({
      profile: { id: '1', name: 'John', email: 'john@example.com', avatarUrl: null, plan: 'free', planUsagePercent: 0 },
      loading: true,
      error: 'err',
    });

    const { result } = renderHook(() => useUserStore());

    act(() => {
      result.current.clearUser();
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe('selectors', () => {
    it('return correct values when profile exists', () => {
      const mockProfile = { id: '1', name: 'John Doe', email: 'john@example.com', avatarUrl: '/avatar.png', plan: 'pro' as const, planUsagePercent: 75 };
      useUserStore.setState({ profile: mockProfile, loading: true });

      const state = useUserStore.getState();
      expect(selectUserProfile(state)).toEqual(mockProfile);
      expect(selectUserName(state)).toBe('John Doe');
      expect(selectUserEmail(state)).toBe('john@example.com');
      expect(selectUserAvatar(state)).toBe('/avatar.png');
      expect(selectPlanUsage(state)).toBe(75);
      expect(selectUserLoading(state)).toBe(true);
    });

    it('return correct fallbacks when profile is null', () => {
      const state = useUserStore.getState();
      expect(selectUserName(state)).toBe('there');
      expect(selectUserEmail(state)).toBe('');
      expect(selectUserAvatar(state)).toBeNull();
      expect(selectPlanUsage(state)).toBe(0);
    });
  });
});
