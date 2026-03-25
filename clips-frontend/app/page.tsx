
import ProgressCard from "@/components/ProgressCard";
import Image from "next/image";


import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] bg-[url('https://s3-alpha-sig.figma.com/img/848e/8904/0c797449673323565e3b5e4c6c0b3c5a?Expires=1712534400&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4')] bg-cover bg-center px-4">
      
      {/* The Glassmorphism Card */}
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
          <p className="text-sm text-zinc-400">Log in to your account to continue</p>
        </div>

        {/* Social Buttons */}
        <div className="flex flex-col gap-3">
          <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition hover:bg-white/10">
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" loading="lazy" alt="google logo" className="h-5 w-5" />
            Continue with Google
          </button>
          <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition hover:bg-white/10">
            <img src="https://www.svgrepo.com/show/475635/apple-color.svg" loading="lazy" alt="apple logo" className="h-5 w-5 invert" />
            Continue with Apple
          </button>
        </div>

        {/* Separator */}
        <div className="my-6 flex items-center gap-4">
          <div className="h-[1px] flex-1 bg-white/10"></div>
          <span className="text-xs font-medium text-zinc-500">OR EMAIL</span>
          <div className="h-[1px] flex-1 bg-white/10"></div>
        </div>

        {/* Email Form */}
        <div className="space-y-4">
          <div>
            <input 
              type="email" 
              placeholder="Email address" 
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <button className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
            Continue with Email
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>

import Sidebar from "../components/navigation/Sidebar";
import AiInsightCard from "./components/AiInsightCard";

import MetricsCards from "./MetricsCards";
import ProcessDashboard from "./components/ProcessDashboard";
import ConnectAccountsSection from "./components/ConnectAccountsSection";

export default function Home() {
  return (

    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      {/* Responsive container with proper breakpoints */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        
        {/* Hero Section with responsive layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-12">
          
          {/* Hero Content - Left side on desktop, stacks on top for mobile/tablet */}
          <div className="flex flex-col justify-center gap-6 text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
              Transform Your Content with AI-Powered Clips
            </h1>
            <p className="text-base sm:text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              Create viral-ready clips from your long-form content in seconds. 
              Our AI analyzes, edits, and optimizes your videos for maximum engagement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                href="/create"
              >
                Get Started
              </a>
              <a
                className="flex h-12 items-center justify-center rounded-full border border-solid border-black/[.08] px-6 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                href="/learn-more"
              >
                Learn More
              </a>
            </div>
          </div>

          {/* Auth Card / Process Dashboard - Right side on desktop, stacks below on mobile/tablet */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-lg">
              <ProcessDashboard />
            </div>
          </div>
        </div>

        {/* Progress Card Section */}
        <div className="mb-12">
          <ProgressCard
            percentage={87}
            estimatedTimeRemaining="1 minute 15 seconds"
          />
        </div>

        {/* Connect Accounts Section */}
        <div className="mb-12">
          <ConnectAccountsSection />
        </div>

        {/* Metrics Cards at the bottom */}
        <MetricsCards />
      </main>

    <div className="min-h-screen bg-[#0A0A0A] text-white flex">
      {/* Sidebar on the left */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 pl-64 flex flex-col items-center justify-center p-8 gap-12">
        
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Dashboard Overview
          </h1>
          <p className="text-zinc-400 max-w-md mx-auto">
            View your latest video performance and AI-generated insights here.
          </p>
        </div>

        {/* Your AI Insight Card! */}
        <div className="w-full flex justify-center">
          <AiInsightCard />
        </div>

        {/* Other metrics below */}
        <div className="w-full max-w-5xl">
          <MetricsCards />
        </div>

      </main>


    </div>
  );
}
