import {
  BIP39_WORDLIST,
  deriveSeedFromMnemonic,
  generateMnemonic,
  createRandomWallet,
  restoreWalletFromMnemonic,
  submitTransaction,
  getStellarNetwork,
} from "./stellar";

describe("stellar BIP39 wallet", () => {
  it("uses the official 2048-word BIP39 English wordlist", () => {
    expect(BIP39_WORDLIST).toHaveLength(2048);
    expect(BIP39_WORDLIST[0]).toBe("abandon");
    expect(BIP39_WORDLIST[2047]).toBe("zoo");
  });

  it("generates a 12-word mnemonic from the BIP39 wordlist", () => {
    const mnemonic = generateMnemonic();
    const words = mnemonic.split(" ");
    expect(words).toHaveLength(12);
    for (const word of words) {
      expect(BIP39_WORDLIST).toContain(word);
    }
  });

  it("derives the BIP39 test vector seed via PBKDF2", async () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const seed = await deriveSeedFromMnemonic(mnemonic);
    expect(Buffer.from(seed).toString("hex")).toBe(
      "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc1"
    );
  });

  it("creates and restores a wallet from the same mnemonic", async () => {
    const created = await createRandomWallet();
    const restored = await restoreWalletFromMnemonic(created.mnemonic);

    expect(restored.publicKey).toBe(created.publicKey);
    expect(restored.secretKey).toBe(created.secretKey);
    expect(restored.mnemonic).toBe(created.mnemonic);
  });

  it("rejects invalid mnemonics", async () => {
    await expect(
      deriveSeedFromMnemonic("not a valid mnemonic phrase at all")
    ).rejects.toThrow("Invalid BIP39 mnemonic phrase");
  });
});

describe("submitTransaction", () => {
  const mockSignedXdr = "AAAAAgAAAAA...";

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("successfully submits a transaction", async () => {
    const mockResponse = {
      hash: "test-hash",
      ledger: 12345,
      envelope_xdr: "envelope-xdr",
      result_xdr: "result-xdr",
      result_meta_xdr: "meta-xdr",
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await submitTransaction({ signedXdr: mockSignedXdr });

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/transactions"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: expect.stringContaining("tx="),
      })
    );
  });

  it("throws SUBMISSION_ERROR when response is not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        title: "Transaction failed",
        extras: {
          result_codes: {
            transaction: "tx_bad_seq",
          },
        },
      }),
    });

    await expect(submitTransaction({ signedXdr: mockSignedXdr })).rejects.toMatchObject({
      code: "tx_bad_seq",
      message: "Transaction failed",
      extras: expect.any(Object),
    });
  });

  it("throws TIMEOUT on AbortError", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";

    (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

    await expect(submitTransaction({ signedXdr: mockSignedXdr })).rejects.toMatchObject({
      code: "TIMEOUT",
      message: "Transaction submission timed out",
    });
  });

  it("throws NETWORK_ERROR on generic network failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network unreachable"));

    await expect(submitTransaction({ signedXdr: mockSignedXdr })).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "Network unreachable",
    });
  });

  it("re-throws SubmitTransactionError with code property", async () => {
    const customError = {
      code: "CUSTOM_ERROR",
      message: "Custom error message",
      extras: { detail: "Some detail" },
    };

    (global.fetch as jest.Mock).mockRejectedValueOnce(customError);

    await expect(submitTransaction({ signedXdr: mockSignedXdr })).rejects.toEqual(
      customError
    );
  });

  it("uses correct Horizon URL for mainnet", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hash: "test" }),
    });

    await submitTransaction({ signedXdr: mockSignedXdr, network: "mainnet" });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://horizon.stellar.org/transactions",
      expect.any(Object)
    );
  });

  it("uses correct Horizon URL for testnet", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hash: "test" }),
    });

    await submitTransaction({ signedXdr: mockSignedXdr, network: "testnet" });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://horizon-testnet.stellar.org/transactions",
      expect.any(Object)
    );
  });
});
