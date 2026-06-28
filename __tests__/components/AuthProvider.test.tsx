import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock("@/app/store", () => ({
  useUserStore: (selector: (state: { setProfile: jest.Mock; clearUser: jest.Mock }) => unknown) =>
    selector({
      setProfile: jest.fn(),
      clearUser: jest.fn(),
    }),
  useDashboardStore: {
    getState: () => ({ fetchDashboard: jest.fn() }),
  },
  useEarningsStore: {
    getState: () => ({ fetchEarnings: jest.fn() }),
  },
}));

function AuthProbe() {
  const { user, setUser, isLoading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="email">{user?.email ?? ""}</span>
      <button
        type="button"
        onClick={() =>
          setUser({
            id: "mock-1",
            email: "mock@example.com",
            onboardingStep: 3,
          })
        }
      >
        mock-login
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (useRouter as jest.Mock).mockReturnValue({ push });
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
  });

  it("populates localStorage from a NextAuth session on login", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          email: "oauth@example.com",
          name: "OAuth User",
          onboardingStep: 3,
        },
      },
      status: "authenticated",
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(localStorage.getItem("clipcash_user")).toContain("oauth@example.com");
    });
  });

  it("does not redirect while session status is loading", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "loading",
    });
    (usePathname as jest.Mock).mockReturnValue("/dashboard");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(push).not.toHaveBeenCalled();
    });
  });

  it("allows authenticated users through protected routes", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          email: "oauth@example.com",
          name: "OAuth User",
          onboardingStep: 3,
        },
      },
      status: "authenticated",
    });
    (usePathname as jest.Mock).mockReturnValue("/dashboard");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(push).not.toHaveBeenCalledWith("/login");
    });
  });

  it("clears localStorage and signs out when the NextAuth session expires", async () => {
    let sessionStatus: "authenticated" | "unauthenticated" = "authenticated";
    let sessionData: { user: { email: string; name: string; onboardingStep: number } } | null =
      {
        user: {
          email: "oauth@example.com",
          name: "OAuth User",
          onboardingStep: 3,
        },
      };

    (useSession as jest.Mock).mockImplementation(() => ({
      data: sessionData,
      status: sessionStatus,
    }));

    const { rerender } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(localStorage.getItem("clipcash_user")).toContain("oauth@example.com");
    });

    sessionStatus = "unauthenticated";
    sessionData = null;

    rerender(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(localStorage.getItem("clipcash_user")).toBeNull();
      expect(signOut).toHaveBeenCalledWith({ redirect: false });
    });
  });

  it("keeps mock login across session unauthenticated state", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    const { getByText, getByTestId } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId("loading")).toHaveTextContent("false");
    });

    await act(async () => {
      getByText("mock-login").click();
    });

    expect(localStorage.getItem("clipcash_user")).toContain("mock@example.com");
    expect(getByTestId("email")).toHaveTextContent("mock@example.com");
  });

  it("redirects unauthenticated users away from protected routes", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });
    (usePathname as jest.Mock).mockReturnValue("/dashboard");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/login");
    });
  });
});
