import { act, renderHook } from '@testing-library/react';
import { useProcessStore, defaultProcessState, selectProcess, selectProcessStatus, selectProcessProgress } from './processStore';

describe('processStore', () => {
  beforeEach(() => {
    useProcessStore.setState(defaultProcessState);
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

  it('resetProcess restores default state', () => {
    const { result } = renderHook(() => useProcessStore());

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
    });

    expect(selectProcessStatus(state)).toBe('processing');
    expect(selectProcessProgress(state)).toBe(75);
  });
});
