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
import ResourceHints from "@/components/ResourceHints";
import CryptoSaltInitializer from "@/components/CryptoSaltInitializer";
import PerformanceMonitor from "@/components/PerformanceMonitor";
import FontPreload from "@/components/FontPreload";

/**
 * Inter font configuration with performance optimizations:
 * - Subsets: latin + latin-ext for European languages
 * - display: "swap" - Shows fallback immediately, swaps when loaded (FOUT strategy)
 * - preload: true - Eager load for LCP improvements
 * - adjustFontFallback: "Arial" - Smooth visual transition on swap
 * 
 * Font subsetting reduces file size by ~60% for most use cases.
 * See: https://web.dev/articles/variable-fonts-optimize-performance
 */
const inter = Inter({ 
  subsets: ["latin", "latin-ext"], 
  display: "swap",
  variable: "--font-inter",
  preload: true,
  adjustFontFallback: "Arial",
});

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
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <FontPreload />
        <ResourceHints />
      </head>
      <body className={`${inter.className} font-sans antialiased`}>
        <div className="radial-bg" />
        <PerformanceMonitor />
        <CryptoSaltInitializer />
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
