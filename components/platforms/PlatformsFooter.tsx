"use client";

import React from "react";
import Link from "next/link";

export default function PlatformsFooter() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="mt-20 pt-12 pb-16 border-t border-[#0e4d2a]">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-wrap justify-center gap-8 text-[13px] font-semibold text-[#90A89C]">
          <Link href="#" className="hover:text-[#F4F7EF] transition-colors">Privacy Policy</Link>
          <Link href="#" className="hover:text-[#F4F7EF] transition-colors">Terms of Service</Link>
          <Link href="#" className="hover:text-[#F4F7EF] transition-colors">API Documentation</Link>
          <Link href="#" className="hover:text-[#F4F7EF] transition-colors">Pricing</Link>
        </div>
        
        <div className="text-[13px] text-[#90A89C] font-medium tracking-tight">
          © {currentYear} enclips. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
