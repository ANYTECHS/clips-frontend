"use client";

import React from "react";
import Link from "next/link";

export default function PlatformsFooter() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="mt-20 pt-12 pb-16 border-t border-white/5">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-wrap justify-center gap-8 text-[13px] font-semibold text-muted-foreground">
          <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="#" className="hover:text-white transition-colors">API Documentation</Link>
          <Link href="#" className="hover:text-white transition-colors">Pricing</Link>
        </div>
        
        <div className="text-[13px] text-subtle font-medium tracking-tight">
          © {currentYear} ClipCash AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
