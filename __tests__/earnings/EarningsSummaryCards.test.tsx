import React from "react";
import { render, screen } from "@testing-library/react";
import EarningsSummaryCards from "@/components/dashboard/EarningsSummaryCards";
import { useEarningsStore } from "@/app/store/earningsStore";
import "@testing-library/jest-dom";

// Mock the Zustand store
jest.mock("@/app/store/earningsStore");

describe("EarningsSummaryCards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders green arrow and correct text for positive trend", () => {
    (useEarningsStore as unknown as jest.Mock).mockReturnValue({
      fetchEarnings: jest.fn(),
      loading: false,
      totalFiat: { value: "$1,200.00", change: 12.5 },
      cryptoRevenue: { value: "0.5 ETH", change: 5.2 },
      pendingPayouts: { value: "$300.00", change: 0 },
    });

    render(<EarningsSummaryCards />);
    
    // Total Fiat card with positive trend
    const fiatTrend = screen.getByText("+12.5%");
    expect(fiatTrend).toBeInTheDocument();
    
    // Positive trend container has text-green-500 class
    expect(fiatTrend.parentElement).toHaveClass("text-green-500");
  });

  it("renders red arrow and correct text for negative trend", () => {
    (useEarningsStore as unknown as jest.Mock).mockReturnValue({
      fetchEarnings: jest.fn(),
      loading: false,
      totalFiat: { value: "$1,200.00", change: -8.2 },
      cryptoRevenue: { value: "0.5 ETH", change: -2.1 },
      pendingPayouts: { value: "$300.00", change: 0 },
    });

    render(<EarningsSummaryCards />);
    
    // Total Fiat card with negative trend
    const fiatTrend = screen.getByText("-8.2%");
    expect(fiatTrend).toBeInTheDocument();
    
    // Negative trend container has text-red-500 class
    expect(fiatTrend.parentElement).toHaveClass("text-red-500");
  });

  it("renders Steady text for zero trend", () => {
    (useEarningsStore as unknown as jest.Mock).mockReturnValue({
      fetchEarnings: jest.fn(),
      loading: false,
      totalFiat: { value: "$1,200.00", change: 0 },
      cryptoRevenue: { value: "0.5 ETH", change: 0 },
      pendingPayouts: { value: "$300.00", change: 0 },
    });

    render(<EarningsSummaryCards />);
    
    // Total Fiat card with zero trend
    const steadyTrends = screen.getAllByText("Steady");
    expect(steadyTrends.length).toBe(3); // One for each card
    
    // Steady trend container has text-gray-400 class
    expect(steadyTrends[0].parentElement).toHaveClass("text-gray-400");
  });
});
