import { render, screen } from "@testing-library/react";
import ClipsPage from "@/app/clips/page";
import { useSession } from "next-auth/react";
import { POST } from "@/app/api/upload/route";
import { NextRequest } from "next/server";

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

// Mock components that don't exist yet
jest.mock("../../components/clips/ClipsNavbar", () => function MockClipsNavbar() { return <div data-testid="clips-navbar" />; });
jest.mock("../../components/clips/Hero", () => function MockHero() { return <div data-testid="hero" />; });
jest.mock("../../components/clips/CreateClipsForm", () => function MockCreateClipsForm() { return <div data-testid="create-clips-form" />; });
jest.mock("../../components/clips/ClipsStats", () => function MockClipsStats() { return <div data-testid="clips-stats" />; });

// Mock auth for API
jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/app/lib/auth";

describe("Clips Authentication Guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Client-side protection (/clips)", () => {
    it("renders loading state while checking session", () => {
      (useSession as jest.Mock).mockReturnValue({ status: "loading" });
      render(<ClipsPage />);
      expect(screen.getByRole("status", { hidden: true }) || screen.queryByText(/loading/i) || document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("renders redirect message and hides content when unauthenticated", () => {
      (useSession as jest.Mock).mockReturnValue({ status: "unauthenticated" });
      render(<ClipsPage />);
      expect(screen.getByText(/Redirecting to login/i)).toBeInTheDocument();
      expect(screen.queryByTestId("create-clips-form")).not.toBeInTheDocument();
      expect(screen.queryByTestId("clips-stats")).not.toBeInTheDocument();
    });

    it("renders content when authenticated", () => {
      (useSession as jest.Mock).mockReturnValue({ status: "authenticated" });
      render(<ClipsPage />);
      expect(screen.getByTestId("create-clips-form")).toBeInTheDocument();
      expect(screen.getByTestId("clips-stats")).toBeInTheDocument();
    });
  });

  describe("Server-side protection (/api/upload)", () => {
    it("returns 401 when no session is present", async () => {
      (auth as jest.Mock).mockResolvedValue(null);
      
      const req = new NextRequest("http://localhost/api/upload", {
        method: "POST",
      });

      const response = await POST(req);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });
  });
});
