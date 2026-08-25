import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import EarningsPage from "@/app/(dashboard)/earnings/page";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock("@/hooks/useFilterQueryState", () => ({
  useFilterQueryState: () => ({
    filters: { page: 1, pageSize: 20 },
    updateFilters: jest.fn(),
    resetFilters: jest.fn(),
  }),
}));

jest.mock("@/app/lib/analytics", () => ({
  __esModule: true,
  default: { trackEarningsExport: jest.fn() },
}));

jest.mock("@/components/dashboard/EarningsTable", () => ({
  __esModule: true,
  default: ({ transactions }: { transactions: { description: string }[] }) => (
    <table data-testid="earnings-table">
      <tbody>
        {transactions.map((tx) => (
          <tr key={tx.description}>
            <td>{tx.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

jest.mock("@/components/dashboard/StatCard", () => ({
  __esModule: true,
  default: ({ label }: { label: string }) => <div data-testid="stat-card">{label}</div>,
}));

const mockEarningsPayload = {
  data: {
    summary: { total: "120.00", completed: "100.00", pending: "20.00" },
    trends: {
      totalTrend: "+5%",
      completedTrend: "+3%",
      pendingTrend: "0%",
    },
    taxReady: true,
    transactions: [
      {
        id: "tx-1",
        date: "2026-01-01",
        description: "YouTube Ad Revenue",
        amount: 42.5,
        platform: "YouTube",
        status: "completed",
        taxId: "TAX-1",
      },
    ],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  },
};

describe("EarningsPage", () => {
  const openMock = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    (usePathname as jest.Mock).mockReturnValue("/earnings");

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockEarningsPayload,
    }) as jest.Mock;

    openMock.mockReturnValue({
      document: { write: jest.fn(), close: jest.fn() },
      focus: jest.fn(),
      print: jest.fn(),
    });
    window.open = openMock;

    URL.createObjectURL = jest.fn(() => "blob:mock");
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the earnings table after data loads", async () => {
    render(<EarningsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("earnings-table")).toBeInTheDocument();
    });

    expect(screen.getByText("YouTube Ad Revenue")).toBeInTheDocument();
  });

  it("exports CSV when CSV is selected from the export menu", async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(<EarningsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("earnings-table")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Export options"));
    fireEvent.click(screen.getByText("CSV"));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  it("opens a print window for PDF export", async () => {
    render(<EarningsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("earnings-table")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Export options"));
    fireEvent.click(screen.getByText("PDF"));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith("", "_blank");
    });
  });
});
