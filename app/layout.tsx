import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { StellarWalletProvider } from "@/components/StellarWalletProvider";
import { NetworkProvider } from "@/app/context/NetworkContext";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ToastProvider";
import { I18nProvider } from "@/app/lib/i18n/I18nProvider";
import CookieConsent from "@/components/CookieConsent";
import RateLimitToast from "@/components/RateLimitToast";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import ErrorBoundary from "@/components/ErrorBoundary";
import AnalyticsProvider from "@/components/AnalyticsProvider";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://clipcash.ai"),
  title: "ClipCash - AI Clipping V2.0",
  description: "Turn 1 long video into 100+ viral clips. Preview, pick, post & mint.",
  openGraph: {
    type: "website",
    title: "ClipCash - AI Clipping V2.0",
    description: "Turn 1 long video into 100+ viral clips. Preview, pick, post & mint.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ClipCash - AI Video Clipping Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClipCash - AI Clipping V2.0",
    description: "Turn 1 long video into 100+ viral clips. Preview, pick, post & mint.",
    images: ["/og-image.png"],
  },
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
          <ErrorBoundary>
            <I18nProvider>
              <AuthProvider>
                <ToastProvider>
                  <NetworkProvider>
                    <WalletProvider>
                      <StellarWalletProvider>
                      <AnalyticsProvider />
                      <KeyboardShortcuts />
                      {children}
                      <RateLimitToast />
                      </StellarWalletProvider>
                    </WalletProvider>
                  </NetworkProvider>
                </ToastProvider>
              </AuthProvider>
            </I18nProvider>
          </ErrorBoundary>
        </ThemeProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
