"use client";

import React, { useState } from "react";
import { MockApi } from "@/app/lib/mockApi";
import { Loader2, Link2, User as UserIcon, MonitorPlay, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";

// Same inline SVGs for perfect styling
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState(user?.profile?.username || "");
  const [niche, setNiche] = useState(user?.profile?.niche || "");

  const step = user?.onboardingStep === 1 ? 1 : 2;

  const completeStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    await MockApi.saveOnboarding(user.id, 2, { username, niche });
    setUser({ ...user, onboardingStep: 2, profile: { ...user.profile, username, niche } });
    setLoading(false);
  };

  const completeStep2 = async () => {
    if (!user) return;
    setLoading(true);
    await MockApi.saveOnboarding(user.id, 3, { socialsConnected: true });
    setUser({ ...user, onboardingStep: 3, profile: { ...user.profile, socialsConnected: true } });
    setLoading(false);
  };

  return (
    <div className="min-h-screen text-white font-sans flex flex-col relative overflow-hidden bg-[#080C0B]">
      {/* Background Orbs */}
      <div className="fixed top-0 left-0 w-[800px] h-[800px] bg-brand/10 rounded-full blur-[150px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.07] rounded-full blur-[120px] pointer-events-none translate-x-1/3" />
      
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 flex items-center z-10 relative">
        
        {step === 1 ? (
          <div className="w-full flex flex-col lg:flex-row items-start justify-between gap-16 lg:gap-8 animate-in fade-in duration-700 zoom-in-95 mt-[-20px]">
            {/* Left side - Progress */}
            <div className="flex-1 space-y-8 max-w-[500px]">
              <div className="text-brand text-[11px] font-bold tracking-[0.1em] uppercase">ONBOARDING EXPERIENCE</div>
              
              <h1 className="text-[64px] font-extrabold leading-[1.05] tracking-tight">
                Turn your long-<br/>form <span className="text-brand">content into</span><br/>
                <span className="text-brand">gold.</span>
              </h1>
              
              <p className="text-[#a1a1aa] text-[16px] max-w-[420px] leading-[1.6]">
                Our AI identifies the most viral moments from your videos and formats them for every platform instantly.
              </p>
              
              {/* Progress Card */}
              <div className="bg-[#0C1411] border border-[#1A2620] rounded-[20px] p-[24px] mt-8 w-full shadow-lg">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <div className="text-[#64746D] text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5">CURRENT PROGRESS</div>
                    <div className="font-bold text-white text-[15px]">Step 1 of 2: Profile Setup</div>
                  </div>
                  <div className="text-[28px] font-extrabold text-brand leading-none">
                    50%
                  </div>
                </div>
                <div className="w-full h-[10px] bg-[#17201C] rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full shadow-[0_0_10px_rgba(0,229,143,0.5)]" style={{ width: "50%" }} />
                </div>
              </div>

              <div className="flex items-center gap-4 text-[13px] text-[#71717A] pt-4">
                <div className="flex -space-x-2.5">
                  <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-800 flex items-center justify-center overflow-hidden"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Nico&backgroundColor=c0aede" alt="" className="w-full h-full object-cover"/></div>
                  <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-700 flex items-center justify-center overflow-hidden"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jane&backgroundColor=b6e3f4" alt="" className="w-full h-full object-cover"/></div>
                  <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-600 flex items-center justify-center overflow-hidden"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jack&backgroundColor=c0aede" alt="" className="w-full h-full object-cover"/></div>
                </div>
                <div>Joined by <span className="font-bold text-white">2,500+</span> top creators this month.</div>
              </div>
            </div>

            {/* Right side - Forms container Stack */}
            <div className="w-full max-w-[440px] flex flex-col gap-6">
              
              {/* Active Step 1 Form Card */}
              <div className="bg-[#0C1712]/90 backdrop-blur-md rounded-[20px] p-[38px] shadow-[0_4px_40px_rgba(0,0,0,0.5)] border border-[#1A2D23] relative overflow-hidden">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-9 h-9 rounded-[8px] bg-brand/10 border border-brand/20 text-brand flex items-center justify-center">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-[18px] font-bold text-white tracking-tight">Basic Information</h2>
                </div>
                
                <form onSubmit={completeStep1} className="space-y-[18px]">
                  <div>
                    <label className="block text-[13px] font-medium text-[#c1c9c6] mb-2">Username</label>
                    <input 
                      type="text" required
                      value={username} onChange={e => setUsername(e.target.value)}
                      className="w-full bg-[#131A17] border border-[#1E2A24] text-white focus:border-brand/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:bg-[#161F1A] transition-colors placeholder-[#3A4A43]"
                      placeholder="e.g. alexrivera"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#c1c9c6] mb-2">Creator Type</label>
                    <div className="relative">
                      <select 
                        required value={niche} onChange={e => setNiche(e.target.value)}
                        className="w-full bg-[#131A17] border border-[#1E2A24] text-white focus:border-brand/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:bg-[#161F1A] appearance-none transition-colors [&>option]:text-black"
                      >
                        <option value="" disabled className="text-gray-500">Select your niche</option>
                        <option value="gaming">Gaming</option>
                        <option value="podcast">Podcast</option>
                        <option value="vlog">Vlog & Lifestyle</option>
                        <option value="educational">Educational</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#5A6F65]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    type="submit" disabled={loading}
                    className="w-full bg-brand hover:bg-brand-hover text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center gap-2 mt-[8px] transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5"/> : <>Continue to step 2 <ArrowRight className="w-[18px] h-[18px]"/></>}
                  </button>
                </form>
              </div>
              
              {/* Disabled Step 2 Preview Card */}
              <div className="bg-[#0A0F0D]/60 backdrop-blur-md rounded-[20px] p-[38px] border border-[#151D19] opacity-70 saturate-50 pointer-events-none">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-[8px] bg-[#121A16] border border-[#1E2A24] text-[#4A5D54] flex items-center justify-center">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-[18px] font-bold text-[#8e9895] tracking-tight">Connect Social Accounts</h2>
                </div>
                
                <div className="space-y-3">
                  {["TikTok", "Instagram", "YouTube"].map((name, i) => (
                    <div key={i} className="w-full bg-[#131A17] border border-[#1E2A24] rounded-[12px] px-4 py-3.5 flex items-center gap-3">
                      <div className="w-[22px] h-[22px] rounded-full bg-[#1A2621] text-[#4A5D54] flex items-center justify-center">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                      <span className="text-[#8e9895] text-[14px] font-medium">{name}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Step 2 Full Screen Centered Flow */
          <div className="w-full flex-col items-center justify-center animate-in zoom-in-95 fade-in duration-500 mt-20">
            <div className="text-center mb-12">
              <h2 className="text-[32px] font-bold tracking-tight text-white mb-3">Step 2: Connect your first social account</h2>
              <p className="text-[#8e9895] text-[16px]">Connect to start importing your content automatically.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-6 max-w-4xl mx-auto">
              {[
                {name: "TikTok", icon: <MonitorPlay className="w-[38px] h-[38px]"/>, desc: "Short-form mastery", color: "bg-black", hover: "hover:border-[#3A4A43]", iconBg: "bg-black"},
                {name: "Instagram", icon: <InstagramIcon className="w-[38px] h-[38px]"/>, desc: "Reels & Engagement", color: "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]", hover: "hover:border-[#dc2743]", iconBg: "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]"},
                {name: "YouTube", icon: <YoutubeIcon className="w-[38px] h-[38px]"/>, desc: "Long-form & Shorts", color: "bg-[#FF0000]", hover: "hover:border-[#FF0000]", iconBg: "bg-[#FF0000]"}
              ].map(platform => (
                <button 
                  key={platform.name}
                  onClick={completeStep2}
                  className={`w-full sm:w-[260px] bg-[#0E1512]/80 backdrop-blur-md rounded-[20px] p-[40px] flex flex-col items-center justify-center gap-5 border border-[#1E2A24] transition-all transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group`}
                >
                  <div className={`w-[80px] h-[80px] rounded-[24px] flex items-center justify-center text-white ${platform.iconBg} shadow-lg group-hover:scale-105 transition-transform`}>
                    {platform.icon}
                  </div>
                  <div className="text-center mt-2">
                    <div className="font-bold text-[18px] text-white">{platform.name}</div>
                    <div className="text-[#5A6F65] text-[13px] mt-1">{platform.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="flex justify-center mt-[60px]">
              <button 
                onClick={completeStep2}
                className="px-8 py-3.5 rounded-[12px] border border-[#1E2A24] text-[#8e9895] hover:text-white hover:bg-[#1A221E] transition-all text-[14px] font-medium"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
