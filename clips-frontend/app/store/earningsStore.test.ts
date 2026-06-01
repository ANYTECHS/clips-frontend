import { act, renderHook } from '@testing-library/react';
import { useEarningsStore, selectEarningsTotals, selectEarningsBreakdown, selectEarningsMeta } from './earningsStore';
import * as api from './api';

jest.mock('./api');

describe('earningsStore', () => {
  beforeEach(() => {
    useEarningsStore.setState({
      totalEarnings: "$0.00",
      totalTrend: 0,
      trendLabel: "",
      totalFiat: { value: "$0.00", change: 0 },
      cryptoRevenue: { value: "0.00 ETH", change: 0 },
      pendingPayouts: { value: "$0.00", change: 0 },
      breakdown: [],
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
    const state = useEarningsStore.getState();
    expect(state.totalEarnings).toBe("$0.00");
    expect(state.totalTrend).toBe(0);
    expect(state.trendLabel).toBe("");
    expect(state.totalFiat).toEqual({ value: "$0.00", change: 0 });
    expect(state.cryptoRevenue).toEqual({ value: "0.00 ETH", change: 0 });
    expect(state.pendingPayouts).toEqual({ value: "$0.00", change: 0 });
    expect(state.breakdown).toEqual([]);
    expect(state.lastFetchedAt).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetchEarnings works and updates state', async () => {
    const mockData = {
      totalEarnings: "$100.00",
      totalTrend: 10,
      trendLabel: "+10%",
      totalFiat: { value: "$100.00", change: 10 },
      cryptoRevenue: { value: "0.5 ETH", change: 5 },
      pendingPayouts: { value: "$10.00", change: 0 },
      breakdown: [{ id: "1", label: "Clip", amount: 10, date: "2024-01-01", platform: "youtube" as const }],
    };
    (api.fetchEarningsFromAPI as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useEarningsStore());

    act(() => {
      result.current.fetchEarnings();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.totalEarnings).toBe(mockData.totalEarnings);
    expect(result.current.totalTrend).toBe(mockData.totalTrend);
    expect(result.current.trendLabel).toBe(mockData.trendLabel);
    expect(result.current.totalFiat).toEqual(mockData.totalFiat);
    expect(result.current.cryptoRevenue).toEqual(mockData.cryptoRevenue);
    expect(result.current.pendingPayouts).toEqual(mockData.pendingPayouts);
    expect(result.current.breakdown).toEqual(mockData.breakdown);
    expect(result.current.lastFetchedAt).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('fetchEarnings uses cache if TTL is valid', async () => {
    const { result } = renderHook(() => useEarningsStore());
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    (api.fetchEarningsFromAPI as jest.Mock).mockResolvedValue({
      totalEarnings: "", totalTrend: 0, trendLabel: "", totalFiat: { value: "", change: 0 }, cryptoRevenue: { value: "", change: 0 }, pendingPayouts: { value: "", change: 0 }, breakdown: []
    });

    await act(async () => {
      await result.current.fetchEarnings();
    });

    expect(api.fetchEarningsFromAPI).toHaveBeenCalledTimes(1);
    const firstFetchTime = result.current.lastFetchedAt;

    jest.setSystemTime(new Date('2024-01-01T00:02:00Z'));

    await act(async () => {
      await result.current.fetchEarnings();
    });

    expect(api.fetchEarningsFromAPI).toHaveBeenCalledTimes(1);
    expect(result.current.lastFetchedAt).toBe(firstFetchTime);
  });

  it('fetchEarnings ignores call if already loading', async () => {
    const { result } = renderHook(() => useEarningsStore());
    useEarningsStore.setState({ loading: true });

    await act(async () => {
      await result.current.fetchEarnings();
    });

    expect(api.fetchEarningsFromAPI).not.toHaveBeenCalled();
  });

  it('fetchEarnings handles errors', async () => {
    (api.fetchEarningsFromAPI as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useEarningsStore());

    await act(async () => {
      await result.current.fetchEarnings();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Network error');
  });

  it('fetchEarnings handles unknown errors', async () => {
    (api.fetchEarningsFromAPI as jest.Mock).mockRejectedValue('String error');

    const { result } = renderHook(() => useEarningsStore());

    await act(async () => {
      await result.current.fetchEarnings();
    });

    expect(result.current.error).toBe('Failed to fetch earnings');
  });

  it('invalidateEarningsCache clears lastFetchedAt', () => {
    useEarningsStore.setState({ lastFetchedAt: 1234567890 });
    const { result } = renderHook(() => useEarningsStore());

    act(() => {
      result.current.invalidateEarningsCache();
    });

    expect(result.current.lastFetchedAt).toBeNull();
  });

  it('selectors return correct slices', () => {
    const mockState = {
      totalEarnings: "$1",
      totalTrend: 1,
      trendLabel: "1",
      totalFiat: { value: "$1", change: 1 },
      cryptoRevenue: { value: "1 ETH", change: 1 },
      pendingPayouts: { value: "$1", change: 1 },
      breakdown: [{ id: "1", label: "Clip", amount: 1, date: "2024-01-01", platform: "youtube" as const }],
      lastFetchedAt: 123,
      loading: true,
      error: "err",
    };
    useEarningsStore.setState(mockState);

    const state = useEarningsStore.getState();
    expect(selectEarningsTotals(state)).toEqual({
      totalEarnings: mockState.totalEarnings,
      totalTrend: mockState.totalTrend,
      trendLabel: mockState.trendLabel,
      totalFiat: mockState.totalFiat,
      cryptoRevenue: mockState.cryptoRevenue,
      pendingPayouts: mockState.pendingPayouts,
    });
    expect(selectEarningsBreakdown(state)).toEqual(mockState.breakdown);
    expect(selectEarningsMeta(state)).toEqual({
      loading: true,
      error: "err",
      lastFetchedAt: 123,
    });
  });
});
