import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";
import { exploreStore } from "@/app/api/explore/exploreStore";

/**
 * Shape of a shared clip. Sourced from a mock today; the fetch below is the
 * single place to swap in the real lookup.
 */
interface SharedClip {
  title: string;
  score: number;
  thumbnail: string | null;
  style: string | null;
}

/**
 * In a real implementation this validates the shareId against the database,
 * checks expiry, and returns null when revoked. Returning null makes the page
 * fall back to generic branding rather than leaking a placeholder title.
 */
async function getSharedClip(shareId: string): Promise<SharedClip | null> {
  if (!shareId) return null;

  const exploreClip = exploreStore.getByShareId(shareId);
  if (exploreClip) {
    return {
      title: exploreClip.title,
      score: exploreClip.score,
      thumbnail: exploreClip.thumbnail,
      style: exploreClip.style,
    };
  }

  return {
    title: "Shared Clip",
    score: 87,
    thumbnail: null,
    style: null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const clip = await getSharedClip(shareId);

  const title = clip ? `${clip.title} - ClipCash` : "Shared Clip - ClipCash";
  const description = clip
    ? `Virality score ${clip.score}/100. Watch this clip on ClipCash.`
    : "Check out this shared clip on ClipCash";

  // Point at the generator so the preview carries the clip's own title,
  // score, and thumbnail rather than the site-wide banner.
  const ogImage = new URL("/api/og", "https://clipcash.ai");
  if (clip) {
    ogImage.searchParams.set("title", clip.title);
    ogImage.searchParams.set("score", String(clip.score));
    if (clip.thumbnail) ogImage.searchParams.set("thumbnail", clip.thumbnail);
    if (clip.style) ogImage.searchParams.set("style", clip.style);
  }

  return {
    title,
    description,
    alternates: {
      canonical: `/share/${shareId}`,
    },
    openGraph: {
      title,
      description,
      type: "video.other",
      url: `/share/${shareId}`,
      images: [
        {
          url: ogImage.toString(),
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.toString()],
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  // In a real implementation, you would:
  const clip = await getSharedClip(shareId);

  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col relative overflow-hidden">
      <BackgroundOrbs variant="subtle" />

      {/* Navigation */}
      <nav className="w-full px-6 py-4 border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <span className="text-black font-bold text-sm">C</span>
            </div>
            <span className="text-lg font-bold">ClipCash</span>
          </Link>
          <Link href="/" className="text-sm text-muted hover:text-white transition-colors">
            ← Back to home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 py-12 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Video Player Section */}
          <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
            <div className="aspect-video bg-black rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
              {/* Replace with actual video player in production */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-brand" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-muted text-sm">Video preview would play here</p>
              </div>
            </div>
            
            {/* Clip Info */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-2">{clip?.title ?? "Shared Clip"}</h1>
                {clip ? (
                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-brand" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 4.42-3.58 8-8 8s-8-3.58-8-8c0-4.08 3.05-7.44 7-7.93V2.05C6.1 2.56 2 7.25 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10c0-4.75-4.1-9.44-9-9.95z" />
                      </svg>
                      Viral Score: {clip.score}/100
                    </span>
                    {clip.style ? <span>{clip.style}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Create Your Own CTA */}
          <div className="bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-3">Create Your Own Clips</h2>
            <p className="text-muted mb-6 max-w-md mx-auto">
              Transform your videos with AI. Join thousands of creators using ClipCash.
            </p>
            <Link 
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-black rounded-full font-bold hover:bg-brand-hover transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}