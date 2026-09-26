/**
 * __tests__/components/WalletProvider.contextOptimization.test.tsx
 *
 * Verifies the context-splitting/selector optimization: a consumer that
 * only reads wallet actions, or only a slice of wallet state, should not
 * re-render when an unrelated part of wallet state changes — unlike the
 * combined `useWallet()` hook, which still re-renders on any change.
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { WalletProvider, useWallet, useWalletActions, useWalletSelector } from "@/components/wallet/WalletProvider";

jest.mock("@/app/lib/secureStorage", () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

function ActionsOnlyConsumer({ onRender }: { onRender: () => void }) {
  useWalletActions();
  onRender();
  return null;
}

function AddressSelectorConsumer({ onRender }: { onRender: () => void }) {
  const address = useWalletSelector((s) => s.address);
  onRender();
  return <div data-testid="address">{address ?? "none"}</div>;
}

function FullStateConsumer({ onRender }: { onRender: () => void }) {
  useWallet();
  onRender();
  return null;
}

function ClearErrorButton() {
  const { clearError } = useWalletActions();
  return <button onClick={clearError}>clear error</button>;
}

describe("WalletProvider context optimization", () => {
  it("does not re-render an actions-only or address-selector consumer when an unrelated field (error) changes", () => {
    const actionsRenders = jest.fn();
    const addressRenders = jest.fn();
    const fullStateRenders = jest.fn();

    render(
      <WalletProvider>
        <ActionsOnlyConsumer onRender={actionsRenders} />
        <AddressSelectorConsumer onRender={addressRenders} />
        <FullStateConsumer onRender={fullStateRenders} />
        <ClearErrorButton />
      </WalletProvider>,
    );

    expect(actionsRenders).toHaveBeenCalledTimes(1);
    expect(addressRenders).toHaveBeenCalledTimes(1);
    expect(fullStateRenders).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(screen.getByText("clear error"));
    });

    // `error` changed (to the same `null` it already was, but through a new
    // state object) — the combined hook always re-renders on a new state
    // object; the narrower hooks should not, since the values they actually
    // read didn't change.
    expect(fullStateRenders).toHaveBeenCalledTimes(2);
    expect(actionsRenders).toHaveBeenCalledTimes(1);
    expect(addressRenders).toHaveBeenCalledTimes(1);
  });

  it("useWalletActions() returns a referentially stable object across wallet state changes", () => {
    const capturedActions: unknown[] = [];

    // Also reads full state so this component re-renders on every wallet
    // state change, letting us observe whether the *actions* reference it
    // captures each time actually changes.
    function Capture() {
      useWallet();
      const actions = useWalletActions();
      capturedActions.push(actions);
      return null;
    }

    render(
      <WalletProvider>
        <Capture />
        <ClearErrorButton />
      </WalletProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByText("clear error"));
    });
    act(() => {
      fireEvent.click(screen.getByText("clear error"));
    });

    expect(capturedActions.length).toBeGreaterThanOrEqual(3);
    expect(new Set(capturedActions).size).toBe(1);
  });
});
