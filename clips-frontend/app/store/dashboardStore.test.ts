import { act, renderHook } from '@testing-library/react';
import { useDashboardStore, selectStats, selectRevenueTrend, selectRecentProjects, selectDashboardMeta } from './dashboardStore';
import * as api from './api';

jest.mock('./api');

describe('dashboardStore', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      stats: null,
      revenueTrend: [],
      recentProjects: [],
      lastFetchedAt: null,
      loading: false,
      error: null,
    });
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('has correct initial state', () => {
    const state = useDashboardStore.getState();
    expect(state.stats).toBeNull();
    expect(state.revenueTrend).toEqual([]);
    expect(state.recentProjects).toEqual([]);
    expect(state.lastFetchedAt).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetchDashboard works and updates state', async () => {
    const mockData = {
      stats: { earnings: { total: '$1', trend: 1, trendLabel: '' }, clips: { total: 1, trend: 1, trendLabel: '' }, platforms: { total: 1, trend: 1, trendLabel: '' } },
      revenueTrend: [{ date: '2024', amount: 100 }],
      recentProjects: [{ id: '1', title: 'T', clipsGenerated: 1, status: 'completed' as const, accent: '' }],
    };
    (api.fetchDashboardFromAPI as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboardStore());

    act(() => {
      result.current.fetchDashboard();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      // Allow promises to resolve
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.stats).toEqual(mockData.stats);
    expect(result.current.revenueTrend).toEqual(mockData.revenueTrend);
    expect(result.current.recentProjects).toEqual(mockData.recentProjects);
    expect(result.current.lastFetchedAt).not.toBeNull();
  });

  it('fetchDashboard uses cache if TTL is valid', async () => {
    const { result } = renderHook(() => useDashboardStore());
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    (api.fetchDashboardFromAPI as jest.Mock).mockResolvedValue({
      stats: {}, revenueTrend: [], recentProjects: []
    });

    await act(async () => {
      await result.current.fetchDashboard();
    });

    expect(api.fetchDashboardFromAPI).toHaveBeenCalledTimes(1);

    const firstFetchTime = result.current.lastFetchedAt;

    // Advance time by 1 minute (less than 5 min TTL)
    jest.setSystemTime(new Date('2024-01-01T00:01:00Z'));

    await act(async () => {
      await result.current.fetchDashboard();
    });

    expect(api.fetchDashboardFromAPI).toHaveBeenCalledTimes(1); // Not called again
    expect(result.current.lastFetchedAt).toBe(firstFetchTime);
  });

  it('fetchDashboard handles errors', async () => {
    (api.fetchDashboardFromAPI as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDashboardStore());

    await act(async () => {
      await result.current.fetchDashboard();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Network error');
  });
  
  it('fetchDashboard handles unknown errors', async () => {
    (api.fetchDashboardFromAPI as jest.Mock).mockRejectedValue('String error');

    const { result } = renderHook(() => useDashboardStore());

    await act(async () => {
      await result.current.fetchDashboard();
    });

    expect(result.current.error).toBe('Failed to fetch dashboard data');
  });

  it('fetchDashboard ignores call if already loading', async () => {
    const { result } = renderHook(() => useDashboardStore());
    useDashboardStore.setState({ loading: true });

    await act(async () => {
      await result.current.fetchDashboard();
    });

    expect(api.fetchDashboardFromAPI).not.toHaveBeenCalled();
  });

  it('invalidateCache clears lastFetchedAt', () => {
    useDashboardStore.setState({ lastFetchedAt: 1234567890 });
    const { result } = renderHook(() => useDashboardStore());

    act(() => {
      result.current.invalidateCache();
    });

    expect(result.current.lastFetchedAt).toBeNull();
  });

  it('setRecentProjects updates projects', () => {
    const { result } = renderHook(() => useDashboardStore());
    const newProjects = [{ id: '99', title: 'Test', clipsGenerated: 0, status: 'completed' as const, accent: '' }];

    act(() => {
      result.current.setRecentProjects(newProjects);
    });

    expect(result.current.recentProjects).toEqual(newProjects);
  });

  it('selectors return correct slices', () => {
    useDashboardStore.setState({
      stats: { earnings: { total: '$0', trend: 0, trendLabel: '' }, clips: { total: 0, trend: 0, trendLabel: '' }, platforms: { total: 0, trend: 0, trendLabel: '' } },
      revenueTrend: [{ date: '2024-01-01', amount: 100 }],
      recentProjects: [{ id: '1', title: 'A', clipsGenerated: 1, status: 'completed', accent: '' }],
      loading: true,
      error: 'err',
      lastFetchedAt: 123,
    });

    const state = useDashboardStore.getState();
    expect(selectStats(state)).toEqual(state.stats);
    expect(selectRevenueTrend(state)).toEqual(state.revenueTrend);
    expect(selectRecentProjects(state)).toEqual(state.recentProjects);
    expect(selectDashboardMeta(state)).toEqual({ loading: true, error: 'err', lastFetchedAt: 123 });
  });
});
