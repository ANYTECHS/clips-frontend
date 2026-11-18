import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full flex justify-center flex-col items-center">
      <div className="w-full relative h-[120px] sm:h-[160px] flex justify-center flex-col overflow-hidden">
        <div className="absolute inset-0 bg-[#020D08]/90 backdrop-blur-sm z-10 
          [mask-image:linear-gradient(to_right,rgba(0,0,0,1)_0%,rgba(0,0,0,0)_15%,rgba(0,0,0,0)_85%,rgba(0,0,0,1)_100%),linear-gradient(to_bottom,rgba(0,0,0,1)_0%,rgba(0,0,0,0)_50%,rgba(0,0,0,1)_100%)] 
          [-webkit-mask-composite:destination-out] [mask-composite:exclude]" />
        
        <div className="w-full max-w-6xl mx-auto px-6 flex justify-around sm:justify-between items-center opacity-40 z-0">
          <div className="font-[900] text-[16px] sm:text-[22px] md:text-[24px] tracking-wider text-[#90A89C] font-sans">YOUTUBE</div>
          <div className="font-[900] text-[16px] sm:text-[22px] md:text-[24px] tracking-wider text-[#90A89C] font-sans">TWITCH</div>
          <div className="font-[900] text-[16px] sm:text-[22px] md:text-[24px] tracking-wider text-[#90A89C] font-sans">TIKTOK</div>
          <div className="font-[900] text-[16px] sm:text-[22px] md:text-[24px] tracking-wider text-[#90A89C] font-sans">INSTA</div>
        </div>
      </div>

      <div className="w-full bg-[#010805] border-t border-[#0e4d2a] py-8 sm:py-10 z-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <Link href="/" className="flex items-center gap-2.5 text-[14px] font-bold text-[#B6FF4A] hover:opacity-80 transition-opacity">
              <div className="relative w-5 h-5 rounded-[4px] overflow-hidden flex-shrink-0">
                <Image
                  src="/logo.jpeg"
                  alt="enclips logo"
                  width={20}
                  height={20}
                  className="object-contain w-full h-full rounded-[4px]"
                />
              </div>
              <span className="font-extrabold tracking-tight text-[#B6FF4A]">enclips</span>
            </Link>
            <span className="hidden sm:inline text-[#0e4d2a]">•</span>
            <div className="text-[12px] text-[#90A89C] font-medium">
              © {currentYear} enclips. All rights reserved.
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-[#90A89C] font-medium">
            <a href="#" className="hover:text-[#F4F7EF] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#F4F7EF] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#F4F7EF] transition-colors">Cookie Settings</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
