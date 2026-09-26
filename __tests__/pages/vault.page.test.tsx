import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import VaultPage from "@/app/(dashboard)/vault/page";

const mockMintSubmit = jest.fn().mockResolvedValue({ id: "collection-1" });

jest.mock("@/components/vault/VaultSidebar", () => ({
  __esModule: true,
  default: ({
    onFilterChange,
  }: {
    onFilterChange: (filter: string) => void;
  }) => (
    <div data-testid="vault-sidebar">
      <button type="button" onClick={() => onFilterChange("listed")}>
        Listed
      </button>
    </div>
  ),
}));

jest.mock("@/components/vault/NFTGrid", () => ({
  __esModule: true,
  default: ({ loading }: { loading: boolean }) => (
    <div data-testid="nft-grid">{loading ? "Loading NFTs" : "NFT Grid"}</div>
  ),
}));

jest.mock("@/components/projects/MintConfigForm", () => ({
  __esModule: true,
  default: ({ onSubmit }: { onSubmit: (data: unknown) => Promise<unknown> }) => (
    <form
      data-testid="mint-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          collectionName: "Test Collection",
          description: "Vault test",
          creatorRoyalty: "10",
          listingPrice: "1",
        });
      }}
    >
      <button type="submit">Submit Mint</button>
    </form>
  ),
}));

jest.mock("@/__mocks__/app/lib/mockApi", () => ({
  MockApi: {
    mintCollection: (...args: unknown[]) => mockMintSubmit(...args),
  },
}));

describe("VaultPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockMintSubmit.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders the NFT grid after loading", async () => {
    render(<VaultPage />);

    expect(screen.getByText("Loading NFTs")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    expect(screen.getByTestId("nft-grid")).toHaveTextContent("NFT Grid");
  });

  it("submits the mint form with vault configuration", async () => {
    render(<VaultPage />);

    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    fireEvent.click(screen.getByRole("button", { name: /Configure Mint/i }));

    fireEvent.submit(screen.getAllByTestId("mint-form")[0]);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockMintSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: "Test Collection" })
    );
  });
});
