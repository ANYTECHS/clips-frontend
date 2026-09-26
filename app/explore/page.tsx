import type { Metadata } from "next";
import Link from "next/link";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";
import ExploreFeed from "@/components/explore/ExploreFeed";

export const metadata: Metadata = {
  title: "Explore Trending Clips — ClipCash",
  description:
    "Discover viral creator clips trending on ClipCash. Browse top-performing short-form content and create your own.",
  alternates: {
    canonical: "/explore",
  },
  openGraph: {
    title: "Explore Trending Clips — ClipCash",
    description:
      "Discover viral creator clips trending on ClipCash. Browse top-performing short-form content.",
    type: "website",
    url: "/explore",
    images: [
      {
        url: "/api/og?title=Explore%20Trending%20Clips&score=95",
        width: 1200,
        height: 630,
        alt: "Explore Trending Clips on ClipCash",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore Trending Clips — ClipCash",
    description: "Discover viral creator clips trending on ClipCash.",
    images: ["/api/og?title=Explore%20Trending%20Clips&score=95"],
  },
};

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
      <BackgroundOrbs />

      <header className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold text-brand">
            ClipCash
          </Link>
          <Link
            href="/login"
            className="px-5 py-2 bg-brand text-black rounded-xl text-sm font-bold hover:bg-brand-hover transition-colors"
            data-analytics-event="explore_cta_click"
          >
            Create my own clips
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">
            Explore Trending Clips
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Discover what&apos;s going viral. Browse top creator clips ranked by virality score.
          </p>
        </div>

        <ExploreFeed />

        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">Ready to create your own viral clips?</p>
          <Link
            href="/login"
            className="inline-flex px-8 py-3 bg-brand text-black rounded-2xl text-base font-bold hover:bg-brand-hover transition-colors shadow-[0_0_30px_rgba(0,229,143,0.3)]"
            data-analytics-event="explore_cta_click"
          >
            Create my own clips
          </Link>
        </div>
      </main>
    </div>
  );
}
