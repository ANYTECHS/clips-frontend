import React from "react";
import { render, screen } from "@testing-library/react";
import AuthForm from "@/components/auth/AuthForm";

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    prefetch,
    children,
    ...props
  }: {
    href: string;
    prefetch?: boolean;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} data-prefetch={String(prefetch ?? false)} {...props}>
      {children}
    </a>
  ),
}));

describe("AuthForm likely navigation prefetch", () => {
  it("keeps signup as a plain anchor because /signup is not a routable page yet", () => {
    render(<AuthForm mode="login" />);

    const signup = screen.getByRole("link", { name: "Sign up" });
    expect(signup).toHaveAttribute("href", "/signup");
    expect(signup).not.toHaveAttribute("data-prefetch");
  });

  it("uses next/link with prefetch for login from signup mode", () => {
    render(<AuthForm mode="signup" />);

    const login = screen.getByRole("link", { name: "Sign in" });
    expect(login).toHaveAttribute("href", "/login");
    expect(login).toHaveAttribute("data-prefetch", "true");
  });
});
