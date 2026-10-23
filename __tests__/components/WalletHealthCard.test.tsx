/**
 * Tests for components/wallet/WalletHealthCard.tsx — verifies the UI state
 * for passing, failing and timed-out checks, the Refresh button and analytics.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import * as diagnostics from "@/app/lib/walletDiagnostics";
import type { DiagnosticCheck, DiagnosticReport } from "@/app/lib/walletDiagnostics";
import WalletHealthCard from "@/components/wallet/WalletHealthCard";

const PUBLIC_KEY = "GA" + "A".repeat(54);
const mockTrackEvent = jest.fn();

jest.mock("@/app/hooks/useAutoStellarWallet", () => ({
  useAutoStellarWallet: () => ({
    publicKey: null,
    network: "testnet",
    networkLabel: "Testnet",
    status: "idle",
    balance: null,
    error: null,
  }),
}));

jest.mock("@/app/lib/analytics", () => ({
  analytics: { trackEvent: (...args: unknown[]) => mockTrackEvent(...args) },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function check(
  id: DiagnosticCheck["id"],
  status: DiagnosticCheck["status"],
  extra: Partial<DiagnosticCheck> = {}
): DiagnosticCheck {
  return { id, label: diagnostics.CHECK_LABELS[id], status, message: `${id} ${status}`, ...extra };
}

function report(checks: DiagnosticCheck[]): DiagnosticReport {
  return { checks, healthy: checks.every((c) => c.status !== "fail"), checkedAt: Date.now() };
}

const allPass = report([
  check("rpc", "pass"),
  check("account", "pass"),
  check("balance", "pass"),
  check("trustline", "pass"),
  check("contract", "pass"),
]);

let runSpy: jest.SpiedFunction<typeof diagnostics.runWalletDiagnostics>;

beforeEach(() => {
  mockTrackEvent.mockClear();
  runSpy = jest.spyOn(diagnostics, "runWalletDiagnostics");
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("WalletHealthCard", () => {
  it("renders nothing without a wallet", () => {
    const { container } = render(<WalletHealthCard publicKey={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("runs diagnostics on mount and shows a pass indicator for each check", async () => {
    runSpy.mockResolvedValue(allPass);
    render(<WalletHealthCard publicKey={PUBLIC_KEY} />);

    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: PUBLIC_KEY, network: "testnet" })
    );
    await waitFor(() => expect(screen.getByText("All checks passed.")).toBeInTheDocument());
    for (const id of ["rpc", "account", "balance", "trustline", "contract"]) {
      expect(screen.getByTestId(`diagnostic-${id}`)).toHaveAttribute("data-status", "pass");
    }
    expect(screen.getAllByLabelText("Passed")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /fund account/i })).not.toBeInTheDocument();
  });

  it("shows fail indicators with Fix actions for failed checks", async () => {
    runSpy.mockResolvedValue(
      report([
        check("rpc", "pass"),
        check("account", "fail", { fix: { kind: "fund", label: "Fund account" } }),
        check("balance", "fail", { fix: { kind: "fund", label: "Fund account" } }),
        check("trustline", "fail", {
          fix: { kind: "link", label: "Add trustline", href: "/settings#panel-wallet" },
        }),
        check("contract", "pass"),
      ])
    );
    render(<WalletHealthCard publicKey={PUBLIC_KEY} />);

    await waitFor(() => expect(screen.getByText("3 checks failed.")).toBeInTheDocument());
    expect(screen.getByTestId("diagnostic-account")).toHaveAttribute("data-status", "fail");
    expect(screen.getAllByRole("button", { name: "Fund account" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Add trustline" })).toHaveAttribute(
      "href",
      "/settings#panel-wallet"
    );
  });

  it("shows a timed-out check as failed with a Retry action that re-runs checks", async () => {
    runSpy.mockResolvedValueOnce(
      report([
        check("rpc", "fail", {
          message: "Could not reach the Soroban RPC (timed out).",
          timedOut: true,
          fix: { kind: "retry", label: "Retry" },
        }),
        check("account", "pass"),
        check("balance", "pass"),
        check("trustline", "skipped"),
        check("contract", "pass"),
      ])
    );
    runSpy.mockResolvedValueOnce(allPass);
    render(<WalletHealthCard publicKey={PUBLIC_KEY} />);

    await waitFor(() => expect(screen.getByText(/timed out/i)).toBeInTheDocument());
    expect(screen.getByTestId("diagnostic-rpc")).toHaveAttribute("data-status", "fail");
    expect(screen.getByTestId("diagnostic-trustline")).toHaveAttribute("data-status", "skipped");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("All checks passed.")).toBeInTheDocument());
    expect(runSpy).toHaveBeenCalledTimes(2);
  });

  it("re-runs all checks when Refresh is clicked", async () => {
    runSpy.mockResolvedValue(allPass);
    render(<WalletHealthCard publicKey={PUBLIC_KEY} />);
    await waitFor(() => expect(screen.getByText("All checks passed.")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /refresh wallet diagnostics/i }));
    });
    await waitFor(() => expect(runSpy).toHaveBeenCalledTimes(2));
  });

  it("logs each diagnostic result to analytics", async () => {
    runSpy.mockResolvedValue(
      report([
        check("rpc", "fail", { timedOut: true }),
        check("account", "pass"),
        check("balance", "fail"),
        check("trustline", "pass"),
        check("contract", "pass"),
      ])
    );
    render(<WalletHealthCard publicKey={PUBLIC_KEY} />);

    await waitFor(() =>
      expect(mockTrackEvent).toHaveBeenCalledWith("wallet_health_check", {
        network: "testnet",
        healthy: false,
        failedChecks: "rpc,balance",
        timedOutChecks: "rpc",
      })
    );
  });

  it("funds the account via Friendbot and re-runs checks", async () => {
    const fundSpy = jest.spyOn(diagnostics, "fundWithFriendbot").mockResolvedValue();
    runSpy
      .mockResolvedValueOnce(
        report([
          check("rpc", "pass"),
          check("account", "fail", { fix: { kind: "fund", label: "Fund account" } }),
          check("balance", "pass"),
          check("trustline", "skipped"),
          check("contract", "pass"),
        ])
      )
      .mockResolvedValueOnce(allPass);
    render(<WalletHealthCard publicKey={PUBLIC_KEY} />);

    await waitFor(() => screen.getByRole("button", { name: "Fund account" }));
    fireEvent.click(screen.getByRole("button", { name: "Fund account" }));

    await waitFor(() => expect(fundSpy).toHaveBeenCalledWith(PUBLIC_KEY, "testnet"));
    await waitFor(() => expect(screen.getByText("All checks passed.")).toBeInTheDocument());
  });
});
