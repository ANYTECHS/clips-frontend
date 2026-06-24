import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Settings — ClipCash AI",
  description: "Manage your privacy preferences for cookies on ClipCash AI.",
  openGraph: {
    type: "website",
    title: "Cookie Settings — ClipCash AI",
    description: "Manage your privacy preferences for cookies on ClipCash AI.",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cookie Settings — ClipCash AI",
    description: "Manage your privacy preferences for cookies on ClipCash AI.",
    images: ["/og-image.png"],
  },
};

export default function CookiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
