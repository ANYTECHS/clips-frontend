import { act, renderHook } from '@testing-library/react';
import { useProcessStore, defaultProcessState, selectProcess, selectProcessStatus, selectProcessProgress, selectHasHydrated } from './processStore';

// Mock secureStorage so tests run without real crypto
jest.mock('@/app/lib/secureStorage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('processStore', () => {
  beforeEach(() => {
    // Reset to default state (but preserve persist API by patching only state fields)
    useProcessStore.setState({ ...defaultProcessState });
    jest.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useProcessStore.getState();
    expect(state).toMatchObject(defaultProcessState);
  });

  it('startProcess updates state correctly', () => {
    const { result } = renderHook(() => useProcessStore());

    act(() => {
      result.current.startProcess('p_123', 'My Video');
    });

    expect(result.current.id).toBe('p_123');
    expect(result.current.label).toBe('My Video');
    expect(result.current.progress).toBe(0);
    expect(result.current.status).toBe('processing');
    expect(result.current.startedAt).toBeGreaterThan(0);
    expect(result.current.completedAt).toBeNull();
    expect(result.current.momentsFound).toBe(0);
    expect(result.current.estimatedSecondsRemaining).toBeNull();
  });

  it('update works with object patch', () => {
    const { result } = renderHook(() => useProcessStore());

    act(() => {
      result.current.update({ progress: 50, status: 'processing' });
    });

    expect(result.current.progress).toBe(50);
    expect(result.current.status).toBe('processing');
  });

  it('update works with function patch', () => {
    const { result } = renderHook(() => useProcessStore());

    useProcessStore.setState({ momentsFound: 2 });

    act(() => {
      result.current.update((prev) => ({ momentsFound: prev.momentsFound + 1 }));
    });

    expect(result.current.momentsFound).toBe(3);
  });

  it('resetProcess restores default state and keeps hasHydrated=true', () => {
    const { result } = renderHook(() => useProcessStore());

    useProcessStore.setState({ hasHydrated: true });

    act(() => {
      result.current.startProcess('test', 'test label');
    });

    expect(result.current.id).toBe('test');

    act(() => {
      result.current.resetProcess();
    });

    expect(result.current.id).toBe(defaultProcessState.id);
    expect(result.current.label).toBe(defaultProcessState.label);
    expect(result.current.status).toBe(defaultProcessState.status);
    // After reset hasHydrated stays true — store is already hydrated
    expect(result.current.hasHydrated).toBe(true);
  });

  it('selectors return correct values', () => {
    useProcessStore.setState({
      id: 'test_id',
      label: 'test_label',
      progress: 75,
      status: 'processing',
      startedAt: 100,
      completedAt: null,
      momentsFound: 5,
      estimatedSecondsRemaining: 10,
      hasHydrated: true,
    });

    const state = useProcessStore.getState();

    expect(selectProcess(state)).toEqual({
      id: 'test_id',
      label: 'test_label',
      progress: 75,
      status: 'processing',
      startedAt: 100,
      completedAt: null,
      momentsFound: 5,
      estimatedSecondsRemaining: 10,
      hasHydrated: true,
    });

    expect(selectProcessStatus(state)).toBe('processing');
    expect(selectProcessProgress(state)).toBe(75);
    expect(selectHasHydrated(state)).toBe(true);
  });
});

// ─── hasHydrated lifecycle ────────────────────────────────────────────────────

describe('processStore — hasHydrated lifecycle (issue #520)', () => {
  const { secureStorage } = require('@/app/lib/secureStorage');

  beforeEach(() => {
    useProcessStore.setState({ ...defaultProcessState });
    jest.clearAllMocks();
  });

  it('starts with hasHydrated = false', () => {
    // defaultProcessState has hasHydrated: false
    expect(useProcessStore.getState().hasHydrated).toBe(false);
    expect(selectHasHydrated(useProcessStore.getState())).toBe(false);
  });

  it('becomes true after async rehydration resolves', async () => {
    const storedState = {
      state: { id: 'restored', label: 'Restored', progress: 42, status: 'processing',
                startedAt: 1000, completedAt: null, momentsFound: 3, estimatedSecondsRemaining: 60 },
      version: 0,
    };
    secureStorage.getItem.mockResolvedValue(JSON.stringify(storedState));

    // Reset hasHydrated to false before rehydrating
    useProcessStore.setState({ hasHydrated: false });
    expect(useProcessStore.getState().hasHydrated).toBe(false);

    // Trigger rehydration and wait for the async getItem to resolve
    await act(async () => {
      await useProcessStore.persist.rehydrate();
    });

    expect(useProcessStore.getState().hasHydrated).toBe(true);
  });

  it('becomes true even when storage returns null (no persisted data)', async () => {
    secureStorage.getItem.mockResolvedValue(null);

    useProcessStore.setState({ hasHydrated: false });

    await act(async () => {
      await useProcessStore.persist.rehydrate();
    });

    expect(useProcessStore.getState().hasHydrated).toBe(true);
  });

  it('restores persisted state alongside setting hasHydrated', async () => {
    const storedState = {
      state: { id: 'job_abc', label: 'My Video', progress: 55, status: 'processing',
                startedAt: 500, completedAt: null, momentsFound: 7, estimatedSecondsRemaining: 30 },
      version: 0,
    };
    secureStorage.getItem.mockResolvedValue(JSON.stringify(storedState));

    useProcessStore.setState({ ...defaultProcessState });

    await act(async () => {
      await useProcessStore.persist.rehydrate();
    });

    const state = useProcessStore.getState();
    expect(state.hasHydrated).toBe(true);
    expect(state.id).toBe('job_abc');
    expect(state.progress).toBe(55);
    expect(state.momentsFound).toBe(7);
  });
});
