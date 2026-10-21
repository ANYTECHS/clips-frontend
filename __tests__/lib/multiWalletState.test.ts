import {
  addConnectedWallet,
  disconnectWallet,
  EMPTY_MULTI_WALLET_STATE,
  getActiveWallet,
  setActiveWallet,
  type MultiWalletState,
} from "@/app/lib/multiWalletState";

function withWallets(): MultiWalletState {
  let state = addConnectedWallet(EMPTY_MULTI_WALLET_STATE, { type: "freighter", publicKey: "GA" }, "w1");
  state = addConnectedWallet(state, { type: "albedo", publicKey: "GB" }, "w2");
  state = addConnectedWallet(state, { type: "xbull", publicKey: "GC" }, "w3");
  return state;
}

describe("multiWalletState — connect", () => {
  it("adds a wallet with id, type, publicKey, label and isConnected", () => {
    const state = addConnectedWallet(
      EMPTY_MULTI_WALLET_STATE,
      { type: "freighter", publicKey: "GA" },
      "w1",
    );
    expect(state.wallets).toEqual([
      { id: "w1", type: "freighter", publicKey: "GA", label: "Freighter", isConnected: true },
    ]);
  });

  it("makes the first connected wallet active and keeps it active afterwards", () => {
    const state = withWallets();
    expect(state.activeWalletId).toBe("w1");
    expect(getActiveWallet(state)?.publicKey).toBe("GA");
  });

  it("is a no-op when the public key is already connected", () => {
    const state = withWallets();
    const next = addConnectedWallet(state, { type: "passkey", publicKey: "GB" }, "dup");
    expect(next).toBe(state);
    expect(next.wallets).toHaveLength(3);
  });
});

describe("multiWalletState — disconnect", () => {
  it("removes a non-active wallet without changing the active wallet", () => {
    const next = disconnectWallet(withWallets(), "w2");
    expect(next.wallets.map((w) => w.id)).toEqual(["w1", "w3"]);
    expect(next.activeWalletId).toBe("w1");
  });

  it("auto-selects the next connected wallet when the active one disconnects", () => {
    const state = setActiveWallet(withWallets(), "w2");
    const next = disconnectWallet(state, "w2");
    expect(next.activeWalletId).toBe("w3");
  });

  it("wraps around to the first wallet when the last active wallet disconnects", () => {
    const state = setActiveWallet(withWallets(), "w3");
    expect(disconnectWallet(state, "w3").activeWalletId).toBe("w1");
  });

  it("selects none when the last connected wallet disconnects", () => {
    const state = addConnectedWallet(EMPTY_MULTI_WALLET_STATE, { type: "freighter", publicKey: "GA" }, "w1");
    const next = disconnectWallet(state, "w1");
    expect(next.wallets).toHaveLength(0);
    expect(next.activeWalletId).toBeNull();
    expect(getActiveWallet(next)).toBeNull();
  });

  it("ignores unknown ids", () => {
    const state = withWallets();
    expect(disconnectWallet(state, "missing")).toBe(state);
  });
});

describe("multiWalletState — switch", () => {
  it("switches the active wallet", () => {
    const next = setActiveWallet(withWallets(), "w3");
    expect(next.activeWalletId).toBe("w3");
    expect(getActiveWallet(next)?.type).toBe("xbull");
  });

  it("ignores unknown or disconnected wallets", () => {
    const state = withWallets();
    expect(setActiveWallet(state, "missing")).toBe(state);

    const withDisconnected: MultiWalletState = {
      ...state,
      wallets: state.wallets.map((w) => (w.id === "w2" ? { ...w, isConnected: false } : w)),
    };
    expect(setActiveWallet(withDisconnected, "w2").activeWalletId).toBe("w1");
  });

  it("reconnects a previously disconnected wallet in place", () => {
    const state = withWallets();
    const withDisconnected: MultiWalletState = {
      ...state,
      wallets: state.wallets.map((w) => (w.id === "w2" ? { ...w, isConnected: false } : w)),
    };
    const next = addConnectedWallet(withDisconnected, { type: "albedo", publicKey: "GB" });
    expect(next.wallets).toHaveLength(3);
    expect(next.wallets.find((w) => w.id === "w2")?.isConnected).toBe(true);
  });
});
