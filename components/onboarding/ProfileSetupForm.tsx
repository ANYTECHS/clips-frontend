import React from "react";
import { User as UserIcon, Loader2, ArrowRight, Sparkles } from "lucide-react";

interface ProfileSetupFormProps {
  username: string;
  setUsername: (value: string) => void;
  niche: string;
  setNiche: (value: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const CONTENT_NICHES = [
  { value: "tech_ai", label: "🚀 Tech, Coding & AI Tools" },
  { value: "business_finance", label: "💼 Business, Finance & Wealth" },
  { value: "podcast_interviews", label: "🎙️ Podcasts & Longform Interviews" },
  { value: "gaming_esports", label: "🎮 Gaming & Esports Highlights" },
  { value: "education_howto", label: "💡 Education, How-To & Books" },
  { value: "fitness_wellness", label: "🏋️ Fitness, Health & Wellness" },
  { value: "comedy_entertainment", label: "🎬 Comedy, Skits & Entertainment" },
  { value: "lifestyle_vlog", label: "✈️ Lifestyle, Travel & Daily Vlogs" },
  { value: "marketing_creator", label: "📈 Marketing & Creator Economy" },
  { value: "food_cooking", label: "🍳 Cooking, Food Reviews & Recipes" },
  { value: "creative_design", label: "🎨 Art, Music & Creative Design" },
  { value: "news_commentary", label: "📰 News, Commentary & Analysis" },
];

export default function ProfileSetupForm({
  username,
  setUsername,
  niche,
  setNiche,
  loading,
  onSubmit,
}: ProfileSetupFormProps) {
  return (
    <div className="bg-[#06351C]/95 backdrop-blur-md rounded-[24px] p-8 sm:p-[38px] shadow-[0_4px_40px_rgba(0,0,0,0.5)] border border-[#0e4d2a] relative overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] text-[#B6FF4A] flex items-center justify-center">
          <UserIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-[19px] font-bold text-[#F4F7EF] tracking-tight">Creator Profile</h2>
          <p className="text-[12px] text-[#90A89C]">Configure your channel focus</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-[13px] font-semibold text-[#F4F7EF] mb-2">
            Username
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] focus:border-[#39FF14]/70 rounded-[14px] px-4 py-3.5 text-[14px] font-medium focus:outline-none transition-colors placeholder-[#90A89C]"
            placeholder="e.g. alexrivera"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[13px] font-semibold text-[#F4F7EF]">
              Content Niche
            </label>
            <span className="text-[11px] text-[#B6FF4A] font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Tunes AI hooks
            </span>
          </div>

          <div className="relative">
            <select
              required
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full bg-[#042413] border border-[#0e4d2a] focus:border-[#39FF14]/70 text-[#F4F7EF] font-medium rounded-[14px] px-4 py-3.5 text-[14px] focus:outline-none appearance-none transition-all cursor-pointer shadow-sm"
              style={{ colorScheme: "dark" }}
            >
              <option value="" disabled className="bg-[#042413] text-[#90A89C]">
                Select your primary content niche…
              </option>
              {CONTENT_NICHES.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                  className="bg-[#042413] text-[#F4F7EF] py-2"
                >
                  {item.label}
                </option>
              ))}
            </select>

            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#B6FF4A]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <p className="text-[11px] text-[#90A89C] mt-1.5">
            Helps our AI generate tailored captions, hooks, and trending hashtags for your clips.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] py-4 rounded-[14px] font-black text-[15px] flex justify-center items-center gap-2 mt-4 transition-all shadow-[0_0_25px_rgba(57,255,20,0.25)] hover:shadow-[0_0_35px_rgba(57,255,20,0.35)] active:scale-[0.99] disabled:opacity-70 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="animate-spin w-5 h-5" />
          ) : (
            <>
              Complete Setup & Go to Dashboard <ArrowRight className="w-[18px] h-[18px]" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
