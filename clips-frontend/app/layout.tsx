import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { WalletProvider } from "@/components/WalletProvider";
import { ThemeProvider } from "@/components/theme-provider";
import CookieConsent from "@/components/CookieConsent";
import RateLimitToast from "@/components/RateLimitToast";
import { SessionProvider } from "next-auth/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://clipcash.ai"),
  title: "ClipCash - AI Clipping V2.0",
  description: "Turn 1 long video into 100+ viral clips. Preview, pick, post & mint.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="radial-bg" />
        <ThemeProvider>
          <SessionProvider>
            <AuthProvider>
              <WalletProvider>
                {children}
                <RateLimitToast />
              </WalletProvider>
            </AuthProvider>
          </SessionProvider>
        </ThemeProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
