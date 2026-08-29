"use client";

import React, { createContext, useContext, useLayoutEffect, useRef, useSyncExternalStore } from "react";

type Listener = () => void;

interface Store<T> {
  getState: () => T;
  subscribe: (listener: Listener) => () => void;
}

export interface SelectableContext<T> {
  Provider: (props: { value: T; children: React.ReactNode }) => React.ReactElement;
  /**
   * Subscribes to a derived slice of the provider's value, re-rendering only
   * when `selector(state)` actually changes (by `isEqual`, default
   * `Object.is`) — not on every Provider re-render the way a plain
   * `useContext` consumer does.
   */
  useSelector: <S>(selector: (state: T) => S, isEqual?: (a: S, b: S) => boolean) => S;
}

/**
 * Splits a context's *distribution* from its *subscription granularity*.
 * A plain `useContext` consumer re-renders whenever the Provider's value
 * changes at all, even if the parts it reads didn't. `useSelector` here
 * subscribes directly to a derived value via `useSyncExternalStore`, so a
 * consumer that only reads e.g. `state.isConnecting` skips re-rendering when
 * `state.error` changes.
 *
 * This only helps for a *single* context value that changes as a whole
 * (e.g. one state object). For genuinely independent pieces of data (state
 * vs. stable action callbacks), splitting into separate contexts — as
 * `WalletProvider` does for state vs. actions — is the simpler fix and
 * composes with this.
 */
export function createSelectableContext<T>(displayName?: string): SelectableContext<T> {
  const StoreContext = createContext<Store<T> | null>(null);
  if (displayName) StoreContext.displayName = `${displayName}Store`;

  function Provider({ value, children }: { value: T; children: React.ReactNode }) {
    const valueRef = useRef(value);
    // Always current during render (a ref write during render is safe — it
    // doesn't schedule anything and isn't observed by anyone until read).
    valueRef.current = value;

    const listenersRef = useRef<Set<Listener>>(new Set());
    const store = useRef<Store<T>>({
      getState: () => valueRef.current,
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
      },
    }).current;

    // Notify subscribers only after commit, so a value change doesn't
    // trigger other components' re-renders mid-render.
    useLayoutEffect(() => {
      listenersRef.current.forEach((listener) => listener());
    }, [value]);

    return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
  }

  function useSelector<S>(selector: (state: T) => S, isEqual: (a: S, b: S) => boolean = Object.is): S {
    const store = useContext(StoreContext);
    if (!store) {
      throw new Error(
        `useSelector${displayName ? ` (${displayName})` : ""} must be used within its matching Provider`,
      );
    }

    // Latest selector/isEqual are read through refs so `getSnapshot` itself
    // can stay referentially stable across renders (required for
    // useSyncExternalStore to avoid needless resubscription) while still
    // reflecting a fresh inline selector passed on every render.
    const selectorRef = useRef(selector);
    selectorRef.current = selector;
    const isEqualRef = useRef(isEqual);
    isEqualRef.current = isEqual;

    const cacheRef = useRef<{ hasValue: boolean; value: S }>({ hasValue: false, value: undefined as unknown as S });

    const getSnapshot = useRef(() => {
      const next = selectorRef.current(store.getState());
      if (cacheRef.current.hasValue && isEqualRef.current(cacheRef.current.value, next)) {
        return cacheRef.current.value;
      }
      cacheRef.current = { hasValue: true, value: next };
      return next;
    }).current;

    return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  }

  return { Provider, useSelector };
}

/** Shallow-equality helper for `useSelector`s that return a plain object. */
export function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => Object.is(a[key], b[key]));
}
