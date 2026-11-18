"use client";

import React from "react";
import Link from "next/link";
import LandingLayout from "@/components/shared/LandingLayout";
import {
  Upload,
  Cpu,
  Flame,
  Type,
  Share2,
  Bot,
  Wallet,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Layers,
  Zap,
} from "lucide-react";

export default function DocsPage() {
  const steps = [
    {
      number: "01",
      title: "Account Setup & Authentication",
      icon: Wallet,
      summary: "Sign up via secure email or 1-click Stellar Web3 wallet authentication.",
      details: [
        "Create an account in seconds with your email and password, or connect your Stellar wallet (Freighter, Lobstr, Albedo).",
        "Choose your creator niche (Gaming, Podcast, Vlog, or Educational) to help the AI calibrate its retention hooks.",
        "Set your creator handle and public profile name in Settings to personalize your clipping workspace.",
      ],
      tip: "Connecting a Stellar wallet unlocks automated on-chain tip tracking and access to autonomous clipping agents.",
    },
    {
      number: "02",
      title: "Importing Your Video Source",
      icon: Upload,
      summary: "Upload local files or paste direct links from YouTube, TikTok, or Vimeo.",
      details: [
        "File Upload: Drag & drop MP4, MOV, AVI, WEBM, or MKV files up to 1GB directly into the upload zone.",
        "Link Import: Paste any public YouTube video link, TikTok clip, or Vimeo URL for instant server-side ingestion.",
        "Our high-throughput download pipeline parses the video stream and preps high-fidelity audio for transcription.",
      ],
      tip: "Long-form conversational videos (podcasts, live stream highlights, interviews) generate the highest virality scores.",
    },
    {
      number: "03",
      title: "AI Analysis & Viral Moment Extraction",
      icon: Cpu,
      summary: "Proprietary AI analyzes speech cadence, engagement spikes, and hook potential.",
      details: [
        "Whisper Speech-to-Text: Generates an accurate timestamped transcript of every sentence spoken.",
        "Hook Detection: AI evaluates conversational energy, keywords, and audience retention markers.",
        "Virality Scoring: Each extracted clip receives a 0–100 score (High: 80–100, Medium: 50–79, Low: <50).",
        "Contextual Titles: AI automatically assigns custom, click-worthy titles tailored to the clip's specific highlight.",
      ],
      tip: "You can watch real-time extraction progress on the Live Processing screen with streaming status indicators.",
    },
    {
      number: "04",
      title: "Smart Reframing & Dynamic Captions",
      icon: Type,
      summary: "Automatic 9:16 vertical conversion with animated karaoke-style subtitles.",
      details: [
        "Face & Subject Tracking: Converts horizontal 16:9 footage into standard 9:16 vertical video without losing context.",
        "Dynamic Captions: Generates word-by-word highlighted captions designed for silent mobile viewing on TikTok & Reels.",
        "Emoji & Keyword Accents: Key phrases are emphasized to keep viewer retention above 85%.",
      ],
      tip: "Over 70% of mobile short-form video viewers watch without headphones—captions boost engagement by up to 3x.",
    },
    {
      number: "05",
      title: "Reviewing, Scrubbing & Managing Clips",
      icon: Layers,
      summary: "Preview video playback with instant thumbnail scrubbing and batch selection.",
      details: [
        "Access all generated moments in the Projects tab, organized with virality badges and duration indicators.",
        "Hover or scrub video cards to preview exact visual moments without opening new tabs.",
        "Use multi-selection to batch download clips or purge unwanted takes with one click.",
      ],
      tip: "Filter clips by virality score to prioritize the top 5 highest-retention clips for peak posting hours.",
    },
    {
      number: "06",
      title: "Multi-Platform Syndication & Distribution",
      icon: Share2,
      summary: "One-click publishing to TikTok, Instagram Reels, YouTube Shorts, and X.",
      details: [
        "Connect your social creator accounts seamlessly in the Platforms hub.",
        "Publish rendered clips directly to TikTok and YouTube Shorts without manual file transfers.",
        "Schedule daily distribution batches to maintain consistent algorithm presence across all channels.",
      ],
      tip: "Stagger posting times across different platforms by 2–3 hours to maximize organic cross-platform reach.",
    },
    {
      number: "07",
      title: "AI Agent Marketplace & Stellar Monetization",
      icon: Bot,
      summary: "Deploy autonomous clipping agents and receive Stellar micro-tips.",
      details: [
        "Hire specialized autonomous AI agents from the Agent Marketplace for dedicated vertical editing.",
        "Micro-payments & Subscriptions: Fund jobs friction-free using USDC or XLM on the low-fee Stellar network.",
        "Track live tip earnings and transaction hashes directly on your Creator Earnings dashboard.",
      ],
      tip: "Stellar transactions settle in 3–5 seconds with fractions of a cent in fees, perfect for micro-tipping.",
    },
  ];

  const faqs = [
    {
      q: "What video formats and limits are supported?",
      a: "We support MP4, MOV, WEBM, AVI, and MKV files up to 1GB via direct upload, as well as YouTube, TikTok, and Vimeo links of any standard duration.",
    },
    {
      q: "How long does processing take?",
      a: "Typical processing takes 2 to 5 minutes depending on the length of the source video. You can safely navigate away; your job continues in the cloud and resumes upon return.",
    },
    {
      q: "Do I need a cryptocurrency wallet to use enclips?",
      a: "No. You can create an account and generate clips using standard email & password authentication. Stellar wallets are optional for on-chain tipping and hiring marketplace agents.",
    },
    {
      q: "How are clip titles generated?",
      a: "Titles are generated contextually by our AI based on the actual transcript dialogue and emotional peak of each specific clip—no generic placeholder titles.",
    },
  ];

  return (
    <LandingLayout>
      <div className="w-full max-w-6xl mx-auto py-8 sm:py-16 space-y-16 animate-in fade-in duration-700">
        
        {/* Header Hero */}
        <div className="space-y-6 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#B6FF4A]/15 border border-[#B6FF4A]/30 text-[#B6FF4A] text-[12px] font-black tracking-wider uppercase">
            <BookOpen className="w-4 h-4" />
            enclips AI Documentation & User Guide
          </div>

          <h1 className="text-[40px] sm:text-[56px] font-black text-[#F4F7EF] tracking-tight leading-[1.1]">
            How enclips AI Works
          </h1>

          <p className="text-[#90A89C] text-base sm:text-lg leading-relaxed">
            A comprehensive, step-by-step walkthrough of turning any long-form video into dozens of viral, engagement-optimized clips ready for TikTok, Instagram Reels, and YouTube Shorts.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/signup"
              className="px-8 py-3.5 rounded-full bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] font-black text-[14px] transition-all shadow-[0_0_20px_rgba(57,255,20,0.25)] hover:shadow-[0_0_30px_rgba(57,255,20,0.4)] active:scale-[0.98]"
            >
              Start Clipping Free
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-3.5 rounded-full bg-[#06351C] hover:bg-[#084223] border border-[#0e4d2a] text-[#F4F7EF] font-bold text-[14px] transition-all active:scale-[0.98]"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>

        {/* Core Value Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl p-6 space-y-3 relative overflow-hidden group hover:border-[#39FF14]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#B6FF4A]">
              <Flame className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#F4F7EF]">Virality Retention Engine</h3>
            <p className="text-sm text-[#90A89C] leading-relaxed">
              Detects narrative hooks and peak conversational moments with scoring calibrated on over 500,000 viral shorts.
            </p>
          </div>

          <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl p-6 space-y-3 relative overflow-hidden group hover:border-[#39FF14]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#B6FF4A]">
              <Type className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#F4F7EF]">Dynamic Visual Captions</h3>
            <p className="text-sm text-[#90A89C] leading-relaxed">
              Animated word-by-word highlights styled to stop thumbs on TikTok, Reels, and YouTube Shorts feeds.
            </p>
          </div>

          <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl p-6 space-y-3 relative overflow-hidden group hover:border-[#39FF14]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#B6FF4A]">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#F4F7EF]">Autonomous Agent Hub</h3>
            <p className="text-sm text-[#90A89C] leading-relaxed">
              Hire specialized AI clipping bots paid seamlessly via fast, micro-fee Stellar blockchain transactions.
            </p>
          </div>
        </div>

        {/* Steps Walkthrough Section */}
        <div className="space-y-8 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#0e4d2a] pb-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#F4F7EF] tracking-tight">
                Step-by-Step Application Guide
              </h2>
              <p className="text-sm text-[#90A89C] mt-1">
                Follow this sequential pipeline from video ingestion to viral social distribution.
              </p>
            </div>
            <span className="text-xs font-black text-[#B6FF4A] uppercase tracking-wider">
              7 Key Stages
            </span>
          </div>

          <div className="space-y-6">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl p-6 sm:p-8 space-y-5 hover:border-[#39FF14]/40 transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl sm:text-3xl font-black text-[#B6FF4A] font-mono">
                        {step.number}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#B6FF4A]">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-black text-[#F4F7EF]">
                          {step.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-[#90A89C]">
                          {step.summary}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    {step.details.map((detail, idx) => (
                      <div
                        key={idx}
                        className="bg-[#042413] border border-[#0e4d2a] rounded-xl p-4 flex items-start gap-3"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#B6FF4A] shrink-0 mt-0.5" />
                        <p className="text-xs text-[#F4F7EF] leading-relaxed">
                          {detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  {step.tip && (
                    <div className="bg-[#042413] border border-[#B6FF4A]/25 rounded-xl px-4 py-3 flex items-center gap-3">
                      <Zap className="w-4 h-4 text-[#B6FF4A] shrink-0" />
                      <p className="text-xs text-[#F4F7EF] font-medium">
                        <strong className="font-bold text-[#B6FF4A]">Pro Tip: </strong>
                        {step.tip}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQs */}
        <div className="space-y-6 pt-6 border-t border-[#0e4d2a]">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-[#B6FF4A]" />
            <h2 className="text-2xl sm:text-3xl font-black text-[#F4F7EF] tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl p-6 space-y-2 hover:border-[#39FF14]/40 transition-all"
              >
                <h3 className="text-base font-bold text-[#F4F7EF] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14]" />
                  {faq.q}
                </h3>
                <p className="text-sm text-[#90A89C] leading-relaxed pl-3.5">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA Card */}
        <div className="bg-gradient-to-r from-[#06351C] via-[#042413] to-[#06351C] border border-[#00C853]/40 rounded-3xl p-8 sm:p-12 text-center space-y-6 relative overflow-hidden shadow-[0_0_50px_rgba(57,255,20,0.1)]">
          <div className="absolute top-0 right-1/4 w-60 h-60 bg-[#39FF14]/10 rounded-full blur-[80px] pointer-events-none" />
          
          <h2 className="text-3xl sm:text-4xl font-black text-[#F4F7EF] tracking-tight">
            Ready to 10x your short-form content?
          </h2>
          <p className="text-[#90A89C] max-w-xl mx-auto text-sm sm:text-base">
            Join thousands of creators turning hours of footage into viral clips in minutes.
          </p>
          <div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] font-black text-[15px] transition-all shadow-[0_0_25px_rgba(57,255,20,0.3)] hover:shadow-[0_0_35px_rgba(57,255,20,0.5)] active:scale-[0.98]"
            >
              Get Started with enclips <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>
    </LandingLayout>
  );
}
