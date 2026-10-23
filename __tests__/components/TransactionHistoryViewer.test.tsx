/**
 * Tests for components/wallet/TransactionHistoryViewer.tsx
 *
 * Covers the loading skeleton, row rendering, explorer links and the
 * infinite-scroll trigger.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import * as txHistoryLib from "@/app/lib/txHistory";
import type { StellarTxPage } from "@/app/lib/txHistory";
import TransactionHistoryViewer from "@/components/wallet/TransactionHistoryViewer";

const ADDRESS = "GA" + "A".repeat(54);
let mockNetwork: "testnet" | "mainnet" = "testnet";

jest.mock("@/components/wallet/WalletProvider", () => ({
  useWallet: () => ({ address: ADDRESS, isConnected: true }),
}));

jest.mock("@/app/context/NetworkContext", () => ({
  useOptionalNetworkContext: () => ({ network: mockNetwork, setNetwork: jest.fn() }),
}));

jest.mock("@/app/hooks/useRenderTiming", () => ({ useRenderTiming: () => {} }));

// Capture IntersectionObserver callbacks so tests can simulate scrolling.
type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let ioCallbacks: IOCallback[] = [];

beforeAll(() => {
  class MockIntersectionObserver {
    constructor(cb: IOCallback) {
      ioCallbacks.push(cb);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    MockIntersectionObserver;
});

function makePage(ids: string[], nextCursor: string | null): StellarTxPage {
  return {
    transactions: ids.map((id) => ({
      id,
      hash: `hash${id}`,
      type: "payment" as const,
      createdAt: "2026-10-01T12:00:00Z",
      amount: "5.0000000",
      asset: "XLM",
      counterparty: "GB" + "B".repeat(54),
      status: "success" as const,
      pagingToken: id,
    })),
    nextCursor,
  };
}

let mockFetch: jest.SpiedFunction<typeof txHistoryLib.fetchStellarTransactions>;

beforeEach(() => {
  ioCallbacks = [];
  mockNetwork = "testnet";
  mockFetch = jest.spyOn(txHistoryLib, "fetchStellarTransactions");
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("TransactionHistoryViewer", () => {
  it("shows the skeleton table while the first page loads", async () => {
    let resolve!: (p: StellarTxPage) => void;
    mockFetch.mockImplementationOnce(() => new Promise((r) => (resolve = r)));

    render(<TransactionHistoryViewer />);
    expect(screen.getByLabelText("Loading table data")).toBeInTheDocument();

    await act(async () => resolve(makePage(["1"], null)));
    expect(screen.queryByLabelText("Loading table data")).not.toBeInTheDocument();
  });

  it("renders each row with date, type, amount, asset, counterparty, status and explorer link", async () => {
    mockFetch.mockResolvedValueOnce(makePage(["1"], null));
    render(<TransactionHistoryViewer />);

    await waitFor(() => expect(screen.getAllByTestId("tx-row")).toHaveLength(1));
    const row = screen.getByTestId("tx-row");
    expect(row).toHaveTextContent("Payment");
    expect(row).toHaveTextContent("5.0000000");
    expect(row).toHaveTextContent("XLM");
    expect(row).toHaveTextContent("GBBBBB");
    expect(row).toHaveTextContent("Success");
    expect(row.querySelector("time")).not.toBeNull();
    expect(screen.getByRole("link", { name: /stellar explorer/i })).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/hash1"
    );
  });

  it("links to the public explorer on mainnet", async () => {
    mockNetwork = "mainnet";
    mockFetch.mockResolvedValueOnce(makePage(["1"], null));
    render(<TransactionHistoryViewer />);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /stellar explorer/i })).toHaveAttribute(
        "href",
        "https://stellar.expert/explorer/public/tx/hash1"
      )
    );
  });

  it("loads the next page when the scroll sentinel intersects", async () => {
    mockFetch
      .mockResolvedValueOnce(makePage(["1", "2"], "2"))
      .mockResolvedValueOnce(makePage(["3"], null));

    render(<TransactionHistoryViewer />);
    await waitFor(() => expect(screen.getAllByTestId("tx-row")).toHaveLength(2));
    await waitFor(() => expect(ioCallbacks.length).toBeGreaterThan(0));

    act(() => {
      ioCallbacks[ioCallbacks.length - 1]([{ isIntersecting: true }]);
    });

    await waitFor(() => expect(screen.getAllByTestId("tx-row")).toHaveLength(3));
    expect(mockFetch.mock.calls[1][0].cursor).toBe("2");
  });

  it("refetches with the selected type filter", async () => {
    mockFetch.mockResolvedValue(makePage(["1"], null));
    render(<TransactionHistoryViewer />);
    await waitFor(() => expect(screen.getAllByTestId("tx-row")).toHaveLength(1));

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "trustline" } });

    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: expect.objectContaining({ type: "trustline" }) })
      )
    );
  });
});
