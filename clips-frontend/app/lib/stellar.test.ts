import {
  BIP39_WORDLIST,
  deriveSeedFromMnemonic,
  generateMnemonic,
  createRandomWallet,
  restoreWalletFromMnemonic,
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
