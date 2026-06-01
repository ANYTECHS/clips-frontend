import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <div className="w-full flex justify-center flex-col items-center">
      {/* Logos Strip with heavy gradient masking */}
      <div className="w-full relative h-[180px] flex justify-center flex-col overflow-hidden">
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-10 
          [mask-image:linear-gradient(to_right,rgba(0,0,0,1)_0%,rgba(0,0,0,0)_20%,rgba(0,0,0,0)_80%,rgba(0,0,0,1)_100%),linear-gradient(to_bottom,rgba(0,0,0,1)_0%,rgba(0,0,0,0)_50%,rgba(0,0,0,1)_100%)] 
          [-webkit-mask-composite:destination-out] [mask-composite:exclude]" />
        
        <div className="w-full max-w-6xl mx-auto px-6 flex justify-between items-center opacity-40 z-0">
          <div className="font-[900] text-[24px] tracking-tight text-muted font-sans">YOUTUBE</div>
          <div className="font-[900] text-[24px] tracking-tight text-muted font-sans">TWITCH</div>
          <div className="font-[900] text-[24px] tracking-tight text-muted font-sans">TIKTOK</div>
          <div className="font-[900] text-[24px] tracking-tight text-muted font-sans">INSTA</div>
        </div>
      </div>

      {/* Main Bottom Footer */}
      <div className="w-full bg-background border-t border-surface py-8 z-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[14px] font-bold text-white">
              <div className="w-4 h-4 bg-brand rounded-[4px] flex items-center justify-center text-black text-[9px]">
                ⚡
              </div>
              ClipCash
            </div>
            <div className="text-[12px] text-muted-foreground font-medium">
              © 2024 ClipCash AI. All rights reserved.
            </div>
          </div>
          <div className="flex items-center gap-6 text-[12px] text-[#5b6b63] font-medium">
            <Link href="/privacy" className="hover:text-[#8e9895] transition-colors">Privacy Policy</Link>
            <Link href="/terms"   className="hover:text-[#8e9895] transition-colors">Terms of Service</Link>
            <Link href="/cookies" className="hover:text-[#8e9895] transition-colors">Cookie Settings</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
