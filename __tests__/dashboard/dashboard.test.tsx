import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardPage from "@/app/(dashboard)/dashboard/page";

jest.mock("@/app/hooks/useDashboardData", () => ({
  useDashboardData: jest.fn(),
}));

jest.mock("@/app/hooks/useAutoStellarWallet", () => ({
  useAutoStellarWallet: () => ({ publicKey: null }),
}));

jest.mock("@/components/dashboard/StatCard", () => ({
  __esModule: true,
  default: () => <div data-testid="stat-card" />,
}));

jest.mock("@/components/dashboard/RevenueChart", () => ({
  __esModule: true,
  default: () => <div data-testid="revenue-chart" />,
}));

jest.mock("@/components/dashboard/PlatformDistribution", () => ({
  __esModule: true,
  default: () => <div data-testid="platform-distribution" />,
}));

jest.mock("@/components/dashboard/AIInsightCard", () => ({
  __esModule: true,
  default: () => <div data-testid="ai-insight-card" />,
}));

jest.mock("@/components/dashboard/ProjectCard", () => ({
  __esModule: true,
  default: () => <div data-testid="project-card" />,
}));

jest.mock("@/components/dashboard/EarningsSummaryCards", () => ({
  __esModule: true,
  default: () => <div data-testid="earnings-summary" />,
}));

jest.mock("@/components/SendPaymentForm", () => ({
  __esModule: true,
  default: () => <div data-testid="send-payment-form" />,
}));

jest.mock("@/components/dashboard/WalletInfoCard", () => ({
  __esModule: true,
  default: () => <div data-testid="wallet-info-card" />,
}));

jest.mock("@/components/wallet/WalletHealthCard", () => ({
  __esModule: true,
  default: () => <div data-testid="wallet-health-card" />,
}));

jest.mock("@/components/ui/Skeleton", () => ({
  __esModule: true,
  default: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

const { useDashboardData } = jest.requireMock(
  "@/app/hooks/useDashboardData"
);

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders error card when store is in error state", () => {
    useDashboardData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Network error"),
      retry: jest.fn(),
    });

    render(<DashboardPage />);

    expect(screen.getByText("Failed to load dashboard data")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls retry when retry button is clicked in error state", () => {
    const retryMock = jest.fn();
    useDashboardData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Network error"),
      retry: retryMock,
    });

    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(retryMock).toHaveBeenCalledTimes(1);
  });

  it("renders empty state when no data, not loading, and no error", () => {
    useDashboardData.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      retry: jest.fn(),
    });

    render(<DashboardPage />);

    expect(screen.getByText(/upload your first video to get started/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upload video/i })).toBeInTheDocument();
  });
});
