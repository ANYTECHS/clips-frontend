import type { Metadata } from "next";
import LandingLayout from "@/components/layout/LandingLayout";
import LandingHero from "@/components/layout/LandingHero";

export const metadata: Metadata = {
  title: "ClipCash - AI-Powered Video Clips for Creators",
  description:
    "Transform your videos into viral clips with AI. Create, share, and monetize short-form content on ClipCash. Join thousands of creators growing their audience.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ClipCash - AI-Powered Video Clips for Creators",
    description:
      "Transform your videos into viral clips with AI. Create, share, and monetize short-form content on ClipCash.",
    type: "website",
    url: "/",
    images: [
      {
        url: "/api/og?title=ClipCash&score=95",
        width: 1200,
        height: 630,
        alt: "ClipCash - AI-Powered Video Clips",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClipCash - AI-Powered Video Clips for Creators",
    description: "Transform your videos into viral clips with AI.",
    images: ["/api/og?title=ClipCash&score=95"],
  },
};

export default function Home() {
  return (
    <LandingLayout
      hero={<LandingHero />}
      showAuthLoadingSkeleton={true}
      authFormMode="login"
    />
  );
}
