import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import QueryProvider from "@/components/QueryProvider";
import { WalletProvider } from "@/components/WalletProvider";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { I18nProvider } from "@/components/I18nProvider";
import KeyboardShortcutsHelp from "@/components/shared/KeyboardShortcutsHelp";

export const metadata: Metadata = {
  metadataBase: new URL("https://enclips.ai"),
  icons: {
    icon: "/logo.jpeg",
    shortcut: "/logo.jpeg",
    apple: "/logo.jpeg",
  },
  title: "enclips - AI Clipping",
  description: "Turn 1 long video into 100+ viral clips. Preview, pick, post & mint.",
  keywords: ["enclips", "AI clipping", "viral videos", "video editing", "content creation", "SaaS", "video shorts"],
  authors: [{ name: "enclips Team" }],
  openGraph: {
    title: "enclips - AI Clipping",
    description: "Turn 1 long video into 100+ viral clips. Preview, pick, post & mint.",
    url: "https://enclips.ai",
    siteName: "enclips",
    images: [
      {
        url: "/logo.jpeg",
        width: 1200,
        height: 630,
        alt: "enclips AI Clipping",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "enclips - AI Clipping",
    description: "Turn 1 long video into 100+ viral clips. Preview, pick, post & mint.",
    images: ["/logo.jpeg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={arabicLocale.locale} dir={arabicLocale.direction} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#B6FF4A] focus:text-[#020D08] focus:rounded-lg focus:font-bold"
        >
          Skip to content
        </a>
        <div className="radial-bg" />
        <QueryProvider>
          <I18nProvider>
            <WalletProvider>
              <AuthProvider>
                <ToastProvider>
                  <div id="main-content" tabIndex={-1} className="outline-none">
                    {children}
                  </div>
                </ToastProvider>
              </AuthProvider>
            </WalletProvider>
          </I18nProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
